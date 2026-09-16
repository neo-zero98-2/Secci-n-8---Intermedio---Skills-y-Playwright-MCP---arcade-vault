"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";
import {
  type BlockColor,
  drawFrame,
  drawSprite,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  LEVELS,
  loadSpritesheet,
  type Spritesheet,
} from "@/components/games/arkanoid-assets";

// Resolución interna fija del original. Es el 4:3 exacto del marco CRT, así que
// el canvas se estira al marco completo sin deformarse y toda la matemática de
// posiciones, rebotes y colisiones sigue siendo válida en píxeles del canvas.
const W = 800;
const H = 600;

// El original no capa el delta. Sin el cap, volver de una pestaña en segundo
// plano avanzaría la pelota cientos de píxeles en un frame y la haría atravesar
// la pala y los bloques. El dt se mantiene en segundos, como el original, porque
// todas sus magnitudes son píxeles por segundo.
const MAX_DT = 0.05;

const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";

// Geometría y velocidad de la pala, portadas sin cambio de valor.
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const PADDLE_SPEED = 400;

// Geometría y velocidad base de la pelota. La `speed` del nivel las escala.
const BALL_SIZE = 16;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

// Ventana de tolerancia del rebote en la pala: el original acepta el golpe
// hasta 8 px por debajo de su borde superior, para que una pelota rápida no se
// cuele entre dos frames.
const PADDLE_TOLERANCIA = 8;

// Parrilla de bloques. `BLOCKS_ORIGIN_X` es el `(800 − 10 × 64) / 2` del
// original, ya resuelto. Las columnas y filas no hacen falta como constantes:
// las codifica la propia parrilla de `LEVELS`.
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = 80;
const BLOCKS_ORIGIN_Y = 80;
const PUNTOS_POR_BLOQUE = 10;

// Las dos únicas teclas del juego. No se portan `P`, `p` ni `Escape`: el único
// modo de pausar es el botón "PAUSA" del HUD, igual que en ROCAS y en CAÍDA.
const TECLA_IZQUIERDA = "ArrowLeft";
const TECLA_DERECHA = "ArrowRight";

// Monoespaciada del sistema: `app/layout.tsx` no cablea `next/font`.
const LOADING_FONT = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y creado dentro del efecto: los globals de módulo del original
// desaparecen para que dos montajes no compartan mundo.

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};

/** `elapsed` en milisegundos: es la única magnitud del juego que no va en segundos. */
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
};

type GameState = {
  paddle: { x: number; y: number; w: number; h: number };
  ball: { x: number; y: number; w: number; h: number; vx: number; vy: number };
  blocks: Block[];
  explosions: Explosion[];
  score: number;
  level: number; // 1–5
};

/** Teclas pulsadas. Fuera del estado del juego: `restart()` lo limpia aparte. */
type Teclas = { izquierda: boolean; derecha: boolean };

function crearEstado(): GameState {
  const g: GameState = {
    paddle: { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
    ball: { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 },
    blocks: [],
    explosions: [],
    score: 0,
    level: 1,
  };
  cargarNivel(g, 1);
  return g;
}

/** El `loadLevel()` del original: repone bloques y pelota, no toca puntuación. */
function cargarNivel(g: GameState, n: number) {
  g.level = n;
  g.blocks = LEVELS[n - 1].blocks.map((b) => ({
    x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
    y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
    w: BLOCK_W,
    h: BLOCK_H,
    color: b.color,
    alive: true,
  }));
  g.explosions = [];
  colocarPelotaSobrePala(g);
}

/** El `initBall()` del original: pelota sobre la pala y a la velocidad del nivel. */
function colocarPelotaSobrePala(g: GameState) {
  const { speed } = LEVELS[g.level - 1];
  g.ball.x = g.paddle.x + (g.paddle.w - g.ball.w) / 2;
  g.ball.y = g.paddle.y - g.ball.h;
  g.ball.vx = BASE_BALL_VX * speed;
  g.ball.vy = BASE_BALL_VY * speed;
}

function limitarPala(x: number) {
  return Math.max(0, Math.min(W - PADDLE_W, x));
}

// ── Actualización ─────────────────────────────────────────────────────────────

function actualizar(g: GameState, dt: number, teclas: Teclas) {
  if (teclas.izquierda)
    g.paddle.x = limitarPala(g.paddle.x - PADDLE_SPEED * dt);
  if (teclas.derecha) g.paddle.x = limitarPala(g.paddle.x + PADDLE_SPEED * dt);

  const { ball, paddle } = g;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Muros izquierdo, derecho y superior: se reposiciona además de invertir, para
  // que la pelota no se quede pegada rebotando dentro de la pared.
  if (ball.x <= 0) {
    ball.x = 0;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + ball.w >= W) {
    ball.x = W - ball.w;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y <= 0) {
    ball.y = 0;
    ball.vy = Math.abs(ball.vy);
  }

  // Pala. Como en el original, el rebote no recalcula `vx`: el ángulo de la
  // pelota no cambia en toda la partida. Es un port, no un rediseño.
  if (
    ball.vy > 0 &&
    ball.x + ball.w > paddle.x &&
    ball.x < paddle.x + paddle.w &&
    ball.y + ball.h >= paddle.y &&
    ball.y + ball.h <= paddle.y + paddle.h + PADDLE_TOLERANCIA
  ) {
    ball.y = paddle.y - ball.h;
    ball.vy = -Math.abs(ball.vy);
  }

  // Bloques: como en el original, un bloque por frame y `vy` invertida sin
  // mirar por qué cara entró la pelota.
  for (const block of g.blocks) {
    if (!block.alive) continue;
    if (!colisiona(ball, block)) continue;
    block.alive = false;
    g.explosions.push({
      x: block.x,
      y: block.y,
      w: block.w,
      h: block.h,
      color: block.color,
      elapsed: 0,
    });
    g.score += PUNTOS_POR_BLOQUE;
    ball.vy = -ball.vy;
    break;
  }

  // `EXPLOSION_DURATION` va en milisegundos, así que el delta se convierte aquí,
  // igual que en la fuente.
  for (const exp of g.explosions) exp.elapsed += dt * 1000;
  g.explosions = g.explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);
}

function colisiona(ball: GameState["ball"], block: Block) {
  return (
    ball.x < block.x + block.w &&
    ball.x + ball.w > block.x &&
    ball.y < block.y + block.h &&
    ball.y + ball.h > block.y
  );
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
// El HUD del original —puntuación, nivel y las pelotas de vidas— no se porta:
// esos tres datos los pinta una sola vez el HUD de React.

function dibujar(
  ctx: CanvasRenderingContext2D,
  sheet: Spritesheet,
  g: GameState,
) {
  fondo(ctx);
  for (const block of g.blocks) {
    if (block.alive)
      drawSprite(ctx, sheet, block.color, block.x, block.y, block.w, block.h);
  }
  for (const exp of g.explosions) {
    const i = Math.min(
      Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
      EXPLOSION_FRAMES[exp.color].length - 1,
    );
    drawFrame(
      ctx,
      sheet,
      EXPLOSION_FRAMES[exp.color][i],
      exp.x,
      exp.y,
      exp.w,
      exp.h,
    );
  }
  drawSprite(
    ctx,
    sheet,
    "paddle",
    g.paddle.x,
    g.paddle.y,
    g.paddle.w,
    g.paddle.h,
  );
  drawSprite(ctx, sheet, "ball", g.ball.x, g.ball.y, g.ball.w, g.ball.h);
}

function fondo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
}

// El original arranca el juego entero dentro del callback de `loadSpritesheet()`
// y hasta entonces no pinta nada. Aquí el canvas ya está montado, así que
// mientras el PNG viaja se anuncia la espera.
function dibujarCargando(ctx: CanvasRenderingContext2D) {
  fondo(ctx);
  ctx.fillStyle = "#e6e9ff";
  ctx.font = LOADING_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CARGANDO…", W / 2, H / 2);
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ArkanoidGame({ ref, ...props }: GameEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Las props viven en un ref para que el efecto del loop no dependa de su
  // identidad: si dependiera, cada render de GamePlayer reiniciaría la partida.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  // El efecto publica aquí sus acciones; useImperativeHandle solo delega.
  const apiRef = useRef<GameEngineHandle | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      restart: () => apiRef.current?.restart(),
      forceGameOver: () => apiRef.current?.forceGameOver(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dibujarCargando(ctx);

    const g = crearEstado();
    const teclas: Teclas = { izquierda: false, derecha: false };

    apiRef.current = {
      restart: () => {},
      forceGameOver: () => {},
    };

    // Teclado en `window`, con `e.code` como el resto del proyecto, y
    // `preventDefault()` para que las flechas no hagan scroll de la página.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === TECLA_IZQUIERDA) {
        e.preventDefault();
        teclas.izquierda = true;
      } else if (e.code === TECLA_DERECHA) {
        e.preventDefault();
        teclas.derecha = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === TECLA_IZQUIERDA) teclas.izquierda = false;
      else if (e.code === TECLA_DERECHA) teclas.derecha = false;
    };

    // Control primario del original. El canvas está estirado por CSS, así que
    // sin el escalado por `getBoundingClientRect` la pala no seguiría al cursor.
    const onMouseMove = (e: MouseEvent) => {
      if (propsRef.current.paused) return;
      const rect = canvas.getBoundingClientRect();
      const escalaX = canvas.width / rect.width;
      const ratonX = (e.clientX - rect.left) * escalaX;
      g.paddle.x = limitarPala(ratonX - g.paddle.w / 2);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousemove", onMouseMove);

    // El spritesheet solo existe a partir de su `onload`; el loop no corre antes.
    let sheet: Spritesheet | null = null;
    let frame = 0;
    // `lastTime` se refresca en cada frame, también en pausa: si no, al reanudar
    // llegaría un delta de varios segundos de golpe.
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      // dt en segundos, capado: ver MAX_DT.
      const dt =
        lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
      lastTime = ts;

      if (sheet) {
        // En pausa no se actualiza, pero se sigue dibujando: el último frame
        // queda estático detrás del modal de GamePlayer.
        if (!propsRef.current.paused) actualizar(g, dt, teclas);
        dibujar(ctx, sheet, g);
      }

      frame = requestAnimationFrame(loop);
    };

    // El loop no arranca hasta que el spritesheet resuelve: si arrancara antes,
    // la partida correría invisible unos frames y la pelota podría perderse sin
    // haberse visto. Si el componente se desmonta durante la carga, `cancelar`
    // impide que el `onload` arranque un loop huérfano.
    const cancelarCarga = loadSpritesheet(SPRITESHEET_SRC, (cargado) => {
      sheet = cargado;
      frame = requestAnimationFrame(loop);
    });

    return () => {
      apiRef.current = null;
      cancelarCarga();
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

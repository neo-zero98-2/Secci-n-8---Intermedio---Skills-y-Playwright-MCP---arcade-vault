"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";
import {
  drawSprite,
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

// Las dos únicas teclas del juego. No se portan `P`, `p` ni `Escape`: el único
// modo de pausar es el botón "PAUSA" del HUD, igual que en ROCAS y en CAÍDA.
const TECLA_IZQUIERDA = "ArrowLeft";
const TECLA_DERECHA = "ArrowRight";

// Monoespaciada del sistema: `app/layout.tsx` no cablea `next/font`.
const LOADING_FONT = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y creado dentro del efecto: los globals de módulo del original
// desaparecen para que dos montajes no compartan mundo.

type GameState = {
  paddle: { x: number; y: number; w: number; h: number };
};

/** Teclas pulsadas. Fuera del estado del juego: `restart()` lo limpia aparte. */
type Teclas = { izquierda: boolean; derecha: boolean };

function crearEstado(): GameState {
  return {
    paddle: { x: (W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
  };
}

function limitarPala(x: number) {
  return Math.max(0, Math.min(W - PADDLE_W, x));
}

// ── Actualización ─────────────────────────────────────────────────────────────

function actualizar(g: GameState, dt: number, teclas: Teclas) {
  if (teclas.izquierda)
    g.paddle.x = limitarPala(g.paddle.x - PADDLE_SPEED * dt);
  if (teclas.derecha) g.paddle.x = limitarPala(g.paddle.x + PADDLE_SPEED * dt);
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
  drawSprite(
    ctx,
    sheet,
    "paddle",
    g.paddle.x,
    g.paddle.y,
    g.paddle.w,
    g.paddle.h,
  );
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

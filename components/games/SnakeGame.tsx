"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";
import type { FruitKey } from "@/components/games/snake-assets";

// SERPENTINA no es un port: no hay `game.js` de origen, solo el atlas de
// frutas. Las reglas —velocidad, vidas, puntuación y reaparición— las fija
// `specs/08-snake-juego-real.md`. Lo que sí se hereda intacto es el chasis de
// SPEC 04: estado en refs, loop de `requestAnimationFrame`, HUD solo en React y
// fin de partida solo en el modal de `GamePlayer`.

// ── Tablero ───────────────────────────────────────────────────────────────────
// 32 × 25 = 800 y 24 × 25 = 600: la grilla encaja sin resto en el 4:3 exacto del
// marco CRT, así que no hay franjas muertas ni celdas partidas y el registro no
// necesita `fitHeight`.
const CELL = 25;
const COLS = 32;
const ROWS = 24;
const W = COLS * CELL;
const H = ROWS * CELL;

// ── Reglas ────────────────────────────────────────────────────────────────────
const START_LIVES = 3;
/** Segmentos al nacer y al reaparecer. */
const START_LEN = 3;

// El delta va en segundos y se capa: sin el cap, volver de una pestaña en
// segundo plano acumularía decenas de ticks de golpe y la serpiente se
// estrellaría sola. Con 0,05 s nunca entra más de un tick por frame, ni
// siquiera a 20 pasos/s.
const MAX_DT = 0.05;

// Monoespaciada del sistema: `app/layout.tsx` no cablea `next/font`.
const LOADING_FONT = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y creado dentro del efecto: a nivel de módulo solo viven constantes y
// funciones puras, para que dos montajes no compartan mundo.

/** Coordenadas de grilla, no de píxel. */
type Cell = { x: number; y: number };

type Phase = "loading" | "playing" | "dying" | "gameover";

type GameState = {
  /** Índice 0 = cabeza; la longitud son los segmentos vivos. */
  snake: Cell[];
  /** Dirección aplicada en el último tick. */
  dir: Cell;
  /** Giros pendientes, máximo 2: se desencola uno por tick. */
  queued: Cell[];
  fruit: { cell: Cell; key: FruitKey } | null;
  /** Segundos acumulados hacia el próximo tick. */
  acc: number;
  /** Frutas comidas en la partida; de aquí se deriva el nivel. */
  eaten: number;
  score: number;
  lives: number;
  level: number; // 1–10
  phase: Phase;
  /** Cuenta atrás de la reaparición, en milisegundos. */
  dyingMs: number;
};

/** Serpiente de `START_LEN` segmentos en el centro, mirando a la derecha. */
function serpienteInicial(): Cell[] {
  const y = Math.floor(ROWS / 2);
  const x = Math.floor(COLS / 2);
  return Array.from({ length: START_LEN }, (_, i) => ({ x: x - i, y }));
}

function crearEstado(): GameState {
  return {
    snake: serpienteInicial(),
    dir: { x: 1, y: 0 },
    queued: [],
    fruit: null,
    acc: 0,
    eaten: 0,
    score: 0,
    lives: START_LIVES,
    level: 1,
    // La partida no arranca hasta que el atlas resuelve.
    phase: "loading",
    dyingMs: 0,
  };
}

// ── Actualización ─────────────────────────────────────────────────────────────

function actualizar(g: GameState, dt: number) {
  if (g.phase !== "playing") return;
  g.acc += dt;
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
// Dentro del canvas no se pinta HUD alguno: puntuación, vidas y nivel salen una
// sola vez, en React.

function fondo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
}

/** Grilla tenue de 25 px: da escala al tablero sin competir con la serpiente. */
function grilla(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  // El medio píxel evita que las líneas salgan borrosas a dos píxeles de ancho.
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, H);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(W, r * CELL + 0.5);
  }
  ctx.stroke();
}

function dibujar(ctx: CanvasRenderingContext2D, g: GameState) {
  fondo(ctx);
  grilla(ctx);
  if (g.phase === "loading") rotuloCargando(ctx);
}

// El canvas ya está montado mientras el PNG viaja, así que la espera se anuncia
// en vez de dejar el tablero en negro.
function rotuloCargando(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#e6e9ff";
  ctx.font = LOADING_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CARGANDO…", W / 2, H / 2);
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function SnakeGame({ ref, ...props }: GameEngineProps) {
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
  const gameRef = useRef<GameState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    gameRef.current = crearEstado();
    // Los callbacks se emiten solo cuando el valor cambia respecto al último
    // emitido, nunca en cada frame. El -1 inicial fuerza la primera emisión.
    const emitido = { score: -1, lives: -1, level: -1 };
    let gameOverEmitido = false;

    apiRef.current = {
      restart: () => {
        gameRef.current = crearEstado();
        emitido.score = -1;
        emitido.lives = -1;
        emitido.level = -1;
        gameOverEmitido = false;
      },
      forceGameOver: () => {
        const g = gameRef.current;
        if (!g) return;
        g.phase = "gameover";
      },
    };

    let frame = 0;
    // `lastTime` se refresca en cada frame, también en pausa: si no, al reanudar
    // llegaría un delta de varios segundos de golpe.
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      const dt =
        lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
      lastTime = ts;

      const g = gameRef.current;
      if (g) {
        // En pausa no se actualiza, pero se sigue dibujando: el último frame
        // queda estático detrás del modal de GamePlayer.
        if (!propsRef.current.paused) actualizar(g, dt);
        dibujar(ctx, g);

        if (g.score !== emitido.score) {
          emitido.score = g.score;
          propsRef.current.onScoreChange(g.score);
        }
        if (g.lives !== emitido.lives) {
          emitido.lives = g.lives;
          propsRef.current.onLivesChange?.(g.lives);
        }
        if (g.level !== emitido.level) {
          emitido.level = g.level;
          propsRef.current.onLevelChange(g.level);
        }
        if (g.phase === "gameover" && !gameOverEmitido) {
          gameOverEmitido = true;
          propsRef.current.onGameOver(g.score);
        }
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      apiRef.current = null;
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

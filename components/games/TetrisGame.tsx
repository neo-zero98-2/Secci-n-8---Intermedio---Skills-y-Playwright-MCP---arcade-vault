"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";

// Resolución interna fija, igual que el juego original: toda la matemática de
// colisión, fantasma y merge vive en este espacio de coordenadas. El canvas no
// es 4:3, así que el registro lo declara `fitHeight` y el CSS lo centra a
// altura completa dentro del marco CRT.
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK; // 300
const H = ROWS * BLOCK; // 600

// El original no capa el delta. Sin el cap, volver de una pestaña en segundo
// plano vaciaría `dropAccum` de golpe y bajaría la pieza varias filas.
// A diferencia de ROCAS, aquí el dt se mantiene en milisegundos: toda la
// cadencia del juego (`dropInterval`, `dropAccum`) ya está en ms.
const MAX_DT = 50;

// El original leía `--grid-line` de `document.body`, una variable que en este
// proyecto no existe. Se fija con el valor de `--line` del design system para
// no atar el canvas al tema de la página.
const GRID_LINE = "rgba(0, 245, 255, 0.18)";

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y en un ref: el loop corre a ~60 fps y re-renderizar React a esa
// cadencia es inviable. No hay campo `paused` (lo manda la prop del mismo
// nombre) ni `lives` (este juego no tiene).
type GameState = {
  board: number[][]; // ROWS×COLS; 0 = vacío, 1–8 = índice de color
  score: number;
  lines: number;
  level: number;
  dropInterval: number; // ms hasta la siguiente bajada automática
  dropAccum: number; // ms acumulados
  gameOver: boolean;
};

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function createGame(): GameState {
  return {
    board: createBoard(),
    score: 0,
    lines: 0,
    level: 1,
    dropInterval: 1000,
    dropAccum: 0,
    gameOver: false,
  };
}

// ── Actualización ─────────────────────────────────────────────────────────────
function update(g: GameState, dt: number) {
  // La gravedad y el bloqueo de piezas entran en el paso 6; de momento el loop
  // solo hace correr el reloj del juego.
  g.dropAccum += dt;
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, H);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(W, r * BLOCK);
    ctx.stroke();
  }
}

// El tablero, el fantasma, el panel y la pieza actual se van sumando aquí en
// los pasos siguientes; el orden de pintado importa y queda en un solo sitio.
function draw(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx);
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function TetrisGame({ ref, ...props }: GameEngineProps) {
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

    gameRef.current = createGame();

    apiRef.current = {
      restart: () => {
        gameRef.current = createGame();
      },
      forceGameOver: () => {
        const g = gameRef.current;
        if (g) g.gameOver = true;
      },
    };

    let frame = 0;
    // `lastTime` se refresca en cada frame, también en pausa: si no, al reanudar
    // llegaría un delta de varios segundos y la pieza bajaría de golpe.
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
      lastTime = ts;

      const g = gameRef.current;
      if (g) {
        // En pausa y tras el game over no se actualiza, pero se sigue dibujando:
        // el último frame queda estático detrás del modal de GamePlayer.
        if (!propsRef.current.paused && !g.gameOver) update(g, dt);
        draw(ctx);
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

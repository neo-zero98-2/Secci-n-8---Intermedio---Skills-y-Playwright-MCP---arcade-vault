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

// Colores y piezas del original, con sus 9 entradas: el índice 0 es nulo y los
// 1–8 son I, O, T, S, Z, J, L y la "tuerca", una octava pieza inventada que no
// existe en ningún Tetris y que deja un hueco imposible al asentarse.
const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - morado
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const PIECES = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y en un ref: el loop corre a ~60 fps y re-renderizar React a esa
// cadencia es inviable. No hay campo `paused` (lo manda la prop del mismo
// nombre) ni `lives` (este juego no tiene).
type Piece = {
  type: number; // 1–8, índice en PIECES y en COLORS
  shape: number[][]; // matriz cuadrada, 0 = vacío
  x: number; // columna de la esquina superior izquierda
  y: number; // fila
};

type GameState = {
  board: number[][]; // ROWS×COLS; 0 = vacío, 1–8 = índice de color
  current: Piece;
  next: Piece;
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

// Sorteo uniforme entre las 8 piezas, igual que el original: sin bolsa de 7.
function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

// `collide` va parametrizada por el tablero en vez de leer un global: el estado
// vive dentro del efecto y un remount no debe compartirlo.
function collide(
  board: number[][],
  shape: number[][],
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function merge(g: GameState) {
  const { shape, x, y } = g.current;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) g.board[y + r][x + c] = shape[r][c];
}

// `next` pasa a ser la pieza en juego y se sortea la siguiente. La detección de
// fin de partida (la pieza nueva no cabe al entrar) llega en el paso 10.
function spawn(g: GameState) {
  g.current = g.next;
  g.next = randomPiece();
}

// Las filas completas se borran de abajo arriba; `r++` compensa el splice para
// no saltarse la fila que acaba de ocupar su sitio.
function clearLines(g: GameState) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (g.board[r].every((v) => v !== 0)) {
      g.board.splice(r, 1);
      g.board.unshift(new Array<number>(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared) return;
  g.lines += cleared;
  g.score += (LINE_SCORES[cleared] ?? 0) * g.level;
  g.level = Math.floor(g.lines / 10) + 1;
  g.dropInterval = Math.max(100, 1000 - (g.level - 1) * 90);
}

function lockPiece(g: GameState) {
  merge(g);
  clearLines(g);
  spawn(g);
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

// Wall kicks del original: se prueba la rotación en el sitio y, si no cabe,
// desplazada hasta dos celdas a cada lado. No es SRS, y no pretende serlo.
function tryRotate(g: GameState) {
  const rotated = rotateCW(g.current.shape);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collide(g.board, rotated, g.current.x + kick, g.current.y)) {
      g.current.shape = rotated;
      g.current.x += kick;
      return;
    }
  }
}

function softDrop(g: GameState) {
  if (!collide(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
    g.current.y++;
    g.score += 1;
  } else {
    lockPiece(g);
  }
}

// La pieza fantasma del paso 8 reutiliza este mismo cálculo.
function ghostY(g: GameState): number {
  let gy = g.current.y;
  while (!collide(g.board, g.current.shape, g.current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop(g: GameState) {
  const gy = ghostY(g);
  g.score += (gy - g.current.y) * 2;
  g.current.y = gy;
  lockPiece(g);
}

// Teclas que el juego consume: sin preventDefault, las flechas y el espacio
// hacen scroll de la página durante la partida. `KeyP` no se porta: la única
// fuente de pausa es el botón del HUD.
function handleKey(g: GameState, code: string) {
  switch (code) {
    case "ArrowLeft":
      if (!collide(g.board, g.current.shape, g.current.x - 1, g.current.y))
        g.current.x--;
      break;
    case "ArrowRight":
      if (!collide(g.board, g.current.shape, g.current.x + 1, g.current.y))
        g.current.x++;
      break;
    case "ArrowDown":
      softDrop(g);
      break;
    case "ArrowUp":
    case "KeyX":
      tryRotate(g);
      break;
    case "Space":
      hardDrop(g);
      break;
  }
}

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

function createGame(): GameState {
  // init() del original: sortea la pieza en juego y la siguiente.
  return {
    board: createBoard(),
    current: randomPiece(),
    next: randomPiece(),
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
  g.dropAccum += dt;
  if (g.dropAccum < g.dropInterval) return;
  g.dropAccum = 0;
  if (!collide(g.board, g.current.shape, g.current.x, g.current.y + 1)) {
    g.current.y++;
  } else {
    lockPiece(g);
  }
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

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha?: number,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha ?? 1;
  ctx.fillStyle = COLORS[colorIndex]!;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // Brillo superior, igual que en el original.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  y: number,
  alpha?: number,
) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      drawBlock(ctx, piece.x + c, y + r, piece.shape[r][c], BLOCK, alpha);
}

// El fantasma y el panel se suman aquí en los pasos siguientes; el orden de
// pintado importa y queda en un solo sitio.
function draw(ctx: CanvasRenderingContext2D, g: GameState) {
  ctx.clearRect(0, 0, W, H);
  drawGrid(ctx);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) drawBlock(ctx, c, r, g.board[r][c], BLOCK);

  // La silueta translúcida marca dónde va a aterrizar la pieza.
  drawPiece(ctx, g.current, ghostY(g), 0.2);
  drawPiece(ctx, g.current, g.current.y);
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      const g = gameRef.current;
      if (!g || g.gameOver || propsRef.current.paused) return;
      handleKey(g, e.code);
    };
    window.addEventListener("keydown", onKeyDown);

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
        draw(ctx, g);
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      apiRef.current = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

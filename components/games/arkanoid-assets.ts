// Datos puros del Arkanoid original (`references/started-games/04-arkanoid/`):
// las tablas de `assets/spritesheet.js` y `levels.js`, más el cargador del
// spritesheet y el pool de sonido. Aquí no vive ni una línea de lógica de
// juego, y a nivel de módulo solo hay constantes y funciones puras: los
// globals del original (`ssImg`, `ssLoaded`, `ssCallbacks`, los dos `Audio`)
// desaparecen para que dos montajes no compartan mundo.

export type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

/** Recorte dentro del spritesheet. */
export type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };

// ── Spritesheet ───────────────────────────────────────────────────────────────
// Portado sin cambios de `assets/spritesheet.js`.

export const SPRITES: {
  paddle: SpriteFrame;
  ball: SpriteFrame;
  blocks: Record<BlockColor, SpriteFrame>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

/** 4 frames por color. `gray` reutiliza los de `red`, como en el original. */
export const EXPLOSION_FRAMES: Record<BlockColor, SpriteFrame[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

/** Milisegundos que dura la animación completa de 4 frames. */
export const EXPLOSION_DURATION = 150;

function explosionRow(sy: number): SpriteFrame[] {
  return [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));
}

// ── Niveles ───────────────────────────────────────────────────────────────────
// El original genera los 5 niveles con un IIFE lleno de bucles y tablas de
// huecos. Aquí van ya resueltos, como parrilla de caracteres: los valores son
// idénticos, pero el patrón se ve de un vistazo y no queda lógica que mantener.
//
//   R rojo   Y amarillo   C cian   M magenta   P rosa   G verde   A gris
//   .        hueco

const LEVEL_CHARS: Record<string, BlockColor> = {
  R: "red",
  Y: "yellow",
  C: "cyan",
  M: "magenta",
  P: "hotpink",
  G: "green",
  A: "gray",
};

export type LevelBlock = { col: number; row: number; color: BlockColor };
export type Level = { speed: number; blocks: LevelBlock[] };

const LEVEL_GRIDS: { speed: number; rows: string[] }[] = [
  // 1 — parrilla completa
  {
    speed: 1.0,
    rows: [
      "RRRRRRRRRR",
      "YYYYYYYYYY",
      "CCCCCCCCCC",
      "MMMMMMMMMM",
      "PPPPPPPPPP",
      "GGGGGGGGGG",
    ],
  },
  // 2 — pirámide
  {
    speed: 1.1,
    rows: [
      "....AA....",
      "...CCCC...",
      "..PPPPPP..",
      ".YYYYYYYY.",
      "MMMMMMMMMM",
      "GGGGGGGGGG",
    ],
  },
  // 3 — tablero de ajedrez
  {
    speed: 1.21,
    rows: [
      "Y.Y.Y.Y.Y.",
      ".Y.Y.Y.Y.Y",
      "Y.Y.Y.Y.Y.",
      ".M.M.M.M.M",
      "M.M.M.M.M.",
      ".M.M.M.M.M",
    ],
  },
  // 4 — filas con huecos
  {
    speed: 1.33,
    rows: [
      "CC.CC.CC.C",
      ".MMM.MM.M.",
      "G.G.GG.GGG",
      "YY.YY.YY..",
      ".PPP.PP.PP",
      "R.R.RR.RR.",
    ],
  },
  // 5 — marco con cruz central
  {
    speed: 1.46,
    rows: [
      "CCCCCCCCCC",
      "C...P....C",
      "CPPPPPPPPC",
      "C...P....C",
      "C...P....C",
      "CCCCCCCCCC",
    ],
  },
];

export const LEVELS: Level[] = LEVEL_GRIDS.map(({ speed, rows }) => ({
  speed,
  blocks: rows.flatMap((line, row) =>
    [...line].flatMap((ch, col) => {
      const color = LEVEL_CHARS[ch];
      return color ? [{ col, row, color }] : [];
    }),
  ),
}));

// ── Carga del spritesheet ─────────────────────────────────────────────────────
// El original guarda la imagen en globals de módulo y arranca el juego entero
// desde el callback. Aquí la imagen se devuelve al que la pide y la carga se
// puede cancelar: si el componente se desmonta antes de que el PNG resuelva,
// el `onload` no hace nada y no se arranca ningún loop.
//
// Se conserva el truco del original de volcar el PNG a un canvas offscreen
// antes de usarlo como fuente de `drawImage`.

export type Spritesheet = HTMLCanvasElement;

export function loadSpritesheet(
  src: string,
  onReady: (sheet: Spritesheet) => void,
): () => void {
  let cancelado = false;
  const rawImg = new Image();

  rawImg.onload = () => {
    if (cancelado) return;
    const oc = document.createElement("canvas");
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    oc.getContext("2d")?.drawImage(rawImg, 0, 0);
    onReady(oc);
  };
  rawImg.onerror = () => {
    console.error("No se pudo cargar el spritesheet de BLOQUE BUSTER");
  };
  rawImg.src = src;

  return () => {
    cancelado = true;
  };
}

/** Recorte arbitrario del spritesheet: lo usan las explosiones. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: Spritesheet,
  frame: SpriteFrame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

/** Sprite con nombre: `paddle`, `ball` o un color de bloque. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: Spritesheet,
  name: "paddle" | "ball" | BlockColor,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const sprite =
    name === "paddle" || name === "ball" ? SPRITES[name] : SPRITES.blocks[name];
  drawFrame(ctx, sheet, sprite, x, y, w, h);
}

// ── Sonido ────────────────────────────────────────────────────────────────────
// El original hace `cloneNode().play()` en cada rebote, creando decenas de
// elementos `Audio` por partida. Aquí hay un pool fijo por sonido que se
// reproduce por turno reiniciando `currentTime`. El pool se crea en el efecto
// del componente y se libera en su cleanup, así que dos montajes de StrictMode
// no comparten elementos.

const POOL_SIZE = 6;
const POOL_VOLUME = 0.35;

export type SoundPool = {
  /** Dispara la siguiente voz del pool. Nunca lanza. */
  play: () => void;
  /** Corta el sonido y suelta los elementos. */
  dispose: () => void;
};

export function createSoundPool(src: string): SoundPool {
  const voces = Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(src);
    audio.volume = POOL_VOLUME;
    audio.preload = "auto";
    return audio;
  });
  let siguiente = 0;

  return {
    play() {
      const audio = voces[siguiente];
      siguiente = (siguiente + 1) % voces.length;
      audio.currentTime = 0;
      // Si el navegador bloquea la reproducción por su política de autoplay,
      // el fallo se traga: el juego no depende del audio.
      void audio.play().catch(() => {});
    },
    dispose() {
      for (const audio of voces) {
        audio.pause();
        audio.src = "";
      }
    },
  };
}

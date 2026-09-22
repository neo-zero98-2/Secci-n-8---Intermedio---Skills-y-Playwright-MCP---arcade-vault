// Datos puros del atlas de frutas de SERPENTINA
// (`references/source-assets/snake-assets/sprites.js`): los 22 recortes de
// `fruits.png` más el cargador de la imagen. Aquí no vive ni una línea de
// lógica de juego, y a nivel de módulo solo hay constantes y funciones puras:
// el global `window.SPRITE_ATLAS` del fuente desaparece para que dos montajes
// no compartan mundo.
//
// Los recortes del fuente son `{x, y, w, h}` y aquí pasan a `{sx, sy, sw, sh}`,
// que es el nombre que ya usa `arkanoid-assets.ts` y el orden de argumentos de
// `drawImage`. Los números son idénticos.

/** Recorte dentro del atlas. */
export type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };

export type FruitKey =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

// ── Atlas ─────────────────────────────────────────────────────────────────────
// Hoja de 3790×442 px con fondo transparente. Fila usada: y=136–295 (160 px de
// alto); los anchos van de 110 a 170, así que el dibujado conserva proporción.

export const FRUITS: Record<FruitKey, SpriteFrame> = {
  banana: { sx: 34, sy: 136, sw: 110, sh: 160 },
  orange: { sx: 186, sy: 136, sw: 150, sh: 160 },
  grape: { sx: 378, sy: 136, sw: 110, sh: 160 },
  garlic: { sx: 540, sy: 136, sw: 130, sh: 160 },
  eggplant: { sx: 712, sy: 136, sw: 130, sh: 160 },
  strawberry: { sx: 894, sy: 136, sw: 110, sh: 160 },
  cherry: { sx: 1066, sy: 136, sw: 110, sh: 160 },
  carrot: { sx: 1228, sy: 136, sw: 130, sh: 160 },
  mushroom: { sx: 1400, sy: 136, sw: 130, sh: 160 },
  broccoli: { sx: 1582, sy: 136, sw: 110, sh: 160 },
  watermelon: { sx: 1734, sy: 136, sw: 150, sh: 160 },
  pepper: { sx: 1906, sy: 136, sw: 150, sh: 160 },
  kiwi: { sx: 2068, sy: 136, sw: 170, sh: 160 },
  lemon: { sx: 2250, sy: 136, sw: 140, sh: 160 },
  peach: { sx: 2432, sy: 136, sw: 130, sh: 160 },
  peanut: { sx: 2604, sy: 136, sw: 130, sh: 160 },
  apple: { sx: 2786, sy: 136, sw: 110, sh: 160 },
  tomato: { sx: 2948, sy: 136, sw: 130, sh: 160 },
  berries: { sx: 3110, sy: 136, sw: 150, sh: 160 },
  grapes2: { sx: 3302, sy: 136, sw: 110, sh: 160 },
  pineapple: { sx: 3454, sy: 136, sw: 150, sh: 160 },
  melon: { sx: 3637, sy: 136, sw: 130, sh: 160 },
};

/** Las 22 claves, para el sorteo de la fruta. */
export const FRUIT_KEYS = Object.keys(FRUITS) as FruitKey[];

/** El PNG se sirve estático desde `public/`; `sprites.js` no viaja. */
export const FRUITS_SRC = "/games/serpentina/fruits.png";

// ── Carga del atlas ───────────────────────────────────────────────────────────
// Mismo patrón que `loadSpritesheet` de BLOQUE BUSTER: la imagen se devuelve al
// que la pide y la carga se puede cancelar, así que si el componente se
// desmonta antes de que el PNG resuelva, el `onload` no hace nada. Se vuelca a
// un canvas offscreen antes de usarse como fuente de `drawImage` para que el
// primer dibujado no dé un tirón.

export type FruitsAtlas = HTMLCanvasElement;

export function loadFruitsAtlas(
  src: string,
  onReady: (atlas: FruitsAtlas) => void,
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
    console.error("No se pudo cargar el atlas de frutas de SERPENTINA");
  };
  rawImg.src = src;

  return () => {
    cancelado = true;
  };
}

// ── Dibujado ──────────────────────────────────────────────────────────────────

/**
 * Dibuja una fruta escalada al lado `size` conservando su proporción y
 * centrada en la celda que empieza en (`x`, `y`). Los recortes miden 160 px de
 * alto y de 110 a 170 de ancho: estirarlos todos a un cuadrado deformaría la
 * mitad del atlas.
 */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  atlas: FruitsAtlas,
  key: FruitKey,
  x: number,
  y: number,
  size: number,
) {
  const f = FRUITS[key];
  const escala = size / Math.max(f.sw, f.sh);
  const dw = f.sw * escala;
  const dh = f.sh * escala;
  ctx.drawImage(
    atlas,
    f.sx,
    f.sy,
    f.sw,
    f.sh,
    x + (size - dw) / 2,
    y + (size - dh) / 2,
    dw,
    dh,
  );
}

"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";
import {
  drawFruit,
  FRUIT_KEYS,
  FRUITS_SRC,
  type FruitKey,
  type FruitsAtlas,
  loadFruitsAtlas,
} from "@/components/games/snake-assets";

// SERPENTINA no es un port: no hay `game.js` de origen, solo el atlas de
// frutas. Las reglas —velocidad, vidas, puntuación y reaparición— las fija
// `specs/08-snake-juego-real.md`. Lo que sí se hereda intacto es el chasis de
// SPEC 04: estado en refs, loop de `requestAnimationFrame`, HUD solo en React y
// fin de partida solo en el modal de `GamePlayer`.

/** Coordenadas de grilla, no de píxel. */
type Cell = { x: number; y: number };

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

/**
 * Pasos por segundo, índice = `level - 1`; el tick dura `1 / valor` segundos.
 * Es una tabla explícita y no una fórmula: "+2 por nivel" llegaría a 26 pasos/s
 * en el nivel 10 y haría el juego injugable, mientras que la tabla aterriza
 * exactamente en el tope decidido y se ajusta sin tocar código.
 */
const STEPS_PER_SEC = [8, 9, 10, 11, 12, 13, 15, 17, 18, 20];

// Las cuatro únicas teclas del juego. Sin WASD: SERPENTINA se controla como
// ROCAS y CAÍDA, y separarla no aportaría nada.
const TECLAS: Record<string, Cell> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Más de dos giros pendientes serían teclazos que el jugador ya no recuerda. */
const MAX_QUEUED = 2;

/** Puntos por fruta: siempre `POINTS_PER_FRUIT * level`. */
const POINTS_PER_FRUIT = 10;

/** Frutas que hacen falta para subir un escalón, y tope de la escalera. */
const FRUITS_PER_LEVEL = 5;
const MAX_LEVEL = 10;

// Pausa tras chocar, antes de reaparecer. Los muros matan: con wrap toroidal
// solo se moriría por autocolisión y las vidas casi nunca entrarían en juego.
const DYING_MS = 1500;
/** Periodo del parpadeo mientras dura `dying`. */
const BLINK_MS = 150;

// El delta va en segundos y se capa: sin el cap, volver de una pestaña en
// segundo plano acumularía decenas de ticks de golpe y la serpiente se
// estrellaría sola. Con 0,05 s nunca entra más de un tick por frame, ni
// siquiera a 20 pasos/s.
const MAX_DT = 0.05;

// ── Paleta ────────────────────────────────────────────────────────────────────
// Los valores salen del sistema de diseño de `app/globals.css` —`--green` y
// `--cyan`—, escritos aquí en crudo porque el canvas no resuelve variables CSS.
// El fondo es un punto más azulado que `--bg` para que el tablero se despegue
// del marco del CRT sin romper la gama.
const COLOR_FONDO = "#0a0a18";
const COLOR_GRILLA = "rgba(0, 245, 255, 0.055)";
const COLOR_BORDE = "rgba(0, 245, 255, 0.28)";
const COLOR_CUERPO = "#00ff88"; // --green
const COLOR_CABEZA = "#7dffc0";
const RADIO_SEGMENTO = 5;
const GLOW_CABEZA = 18;
const GLOW_CUERPO = 10;

// Monoespaciada del sistema: `app/layout.tsx` no cablea `next/font`.
const LOADING_FONT = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Estado ────────────────────────────────────────────────────────────────────
// Mutable y creado dentro del efecto: a nivel de módulo solo viven constantes y
// funciones puras, para que dos montajes no compartan mundo.

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
  const g: GameState = {
    snake: serpienteInicial(),
    dir: { x: 1, y: 0 },
    queued: [],
    fruit: null,
    acc: 0,
    eaten: 0,
    score: 0,
    lives: START_LIVES,
    level: nivelPara(0),
    // La partida no arranca hasta que el atlas resuelve.
    phase: "loading",
    dyingMs: 0,
  };
  sortearFruta(g);
  return g;
}

/**
 * Coloca una fruta nueva: celda uniformemente aleatoria entre las **libres** y
 * clave uniformemente aleatoria entre las 22 del atlas.
 *
 * Se sortea sobre la lista de celdas libres y no por reintentos aleatorios: con
 * la serpiente ocupando casi todo el tablero, reintentar degeneraría en decenas
 * de tiradas fallidas, mientras que así siempre termina. Si no queda ninguna
 * celda libre, la fruta se queda a `null` y el tablero se ha completado.
 */
function sortearFruta(g: GameState) {
  const ocupadas = new Set(g.snake.map((c) => c.y * COLS + c.x));
  const libres: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!ocupadas.has(y * COLS + x)) libres.push({ x, y });
    }
  }
  if (libres.length === 0) {
    g.fruit = null;
    return;
  }
  const cell = libres[Math.floor(Math.random() * libres.length)];
  const key = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
  g.fruit = { cell, key };
}

// ── Actualización ─────────────────────────────────────────────────────────────

/**
 * El nivel es derivado, no un contador aparte: por eso sobrevive solo a la
 * pérdida de una vida —`eaten` no se resetea— y no puede desincronizarse.
 */
function nivelPara(eaten: number) {
  return Math.min(Math.floor(eaten / FRUITS_PER_LEVEL) + 1, MAX_LEVEL);
}

/** Duración del tick en segundos, según el nivel en curso. */
function intervaloTick(g: GameState) {
  return 1 / STEPS_PER_SEC[g.level - 1];
}

// El loop va a `requestAnimationFrame`, pero el juego avanza por ticks
// discretos: entre tick y tick no hay interpolación, la serpiente se dibuja
// siempre alineada a la grilla. El cap de `dt` acota a un tick por frame.
function actualizar(g: GameState, dt: number) {
  // Tras chocar, el juego se queda quieto mientras la serpiente parpadea; al
  // agotarse la cuenta atrás renace en el centro sin tocar marcador ni fruta.
  if (g.phase === "dying") {
    g.dyingMs -= dt * 1000;
    if (g.dyingMs <= 0) renacer(g);
    return;
  }
  if (g.phase !== "playing") return;
  g.acc += dt;
  const intervalo = intervaloTick(g);
  while (g.acc >= intervalo) {
    g.acc -= intervalo;
    tick(g);
  }
}

function tick(g: GameState) {
  // Un giro por tick: dos flechas pulsadas dentro del mismo tick se aplican en
  // ticks consecutivos en vez de pisarse.
  const giro = g.queued.shift();
  if (giro) g.dir = giro;

  const cabeza = g.snake[0];
  const nueva: Cell = { x: cabeza.x + g.dir.x, y: cabeza.y + g.dir.y };

  // Muro o cuerpo propio: el mismo desenlace. La cola no cuenta como choque
  // porque en este mismo tick la suelta, salvo que la serpiente esté creciendo.
  const contraMuro =
    nueva.x < 0 || nueva.x >= COLS || nueva.y < 0 || nueva.y >= ROWS;
  const contraCola = g.snake.some(
    (seg, i) => i < g.snake.length - 1 && seg.x === nueva.x && seg.y === nueva.y,
  );
  if (contraMuro || contraCola) {
    chocar(g);
    return;
  }

  g.snake.unshift(nueva);

  // Comer es, literalmente, no soltar la cola este tick: la serpiente crece
  // exactamente un segmento y el resto del movimiento es el de siempre. Las
  // 22 frutas valen lo mismo; quien premia jugar rápido es el multiplicador
  // por nivel. Todavía no hay colisiones: la serpiente sale del tablero sin
  // consecuencias.
  const comida =
    g.fruit !== null &&
    nueva.x === g.fruit.cell.x &&
    nueva.y === g.fruit.cell.y;
  if (comida) {
    g.eaten++;
    // La fruta se paga al nivel que estaba en vigor al morderla; el escalón
    // que ella misma desbloquea se cobra a partir de la siguiente.
    g.score += POINTS_PER_FRUIT * g.level;
    g.level = nivelPara(g.eaten);
    sortearFruta(g);
  } else {
    g.snake.pop();
  }
}

/**
 * Descuenta una vida. Con vidas de sobra la serpiente entra en `dying` y
 * reaparece; con la última, fin de partida: el modal de `GamePlayer` es el
 * único final, el canvas no dibuja ningún "GAME OVER" ni acepta reinicio.
 */
function chocar(g: GameState) {
  g.lives--;
  if (g.lives <= 0) {
    g.lives = 0;
    g.phase = "gameover";
    return;
  }
  g.phase = "dying";
  g.dyingMs = DYING_MS;
}

/**
 * Serpiente nueva de `START_LEN` segmentos en el centro, mirando a la derecha.
 * `score`, `eaten`, `level` y la fruta en juego quedan intactos: reaparecer con
 * la longitud acumulada obligaría a resolver el caso de una serpiente que ya no
 * cabe estirada en el centro, y reiniciar el nivel castigaría dos veces el
 * mismo error.
 */
function renacer(g: GameState) {
  g.snake = serpienteInicial();
  g.dir = { x: 1, y: 0 };
  g.queued = [];
  g.acc = 0;
  g.dyingMs = 0;
  g.phase = "playing";
  // La fruta pudo quedar bajo la serpiente recién nacida: solo en ese caso se
  // vuelve a sortear, para no cambiarle al jugador la fruta que ya perseguía.
  const fruta = g.fruit;
  if (fruta && g.snake.some((c) => c.x === fruta.cell.x && c.y === fruta.cell.y)) {
    sortearFruta(g);
  }
}

/**
 * Encola un giro. Se descarta el que invierte la dirección **aplicada** en el
 * último tick —no la última encolada—, que es lo que evita que un doble giro
 * rápido acabe en un 180° y la serpiente se muerda el cuello.
 */
function encolarGiro(g: GameState, dir: Cell) {
  if (g.queued.length >= MAX_QUEUED) return;
  const anterior = g.queued.length > 0 ? g.queued[g.queued.length - 1] : g.dir;
  if (dir.x === -anterior.x && dir.y === -anterior.y) return;
  if (dir.x === anterior.x && dir.y === anterior.y) return;
  g.queued.push(dir);
}

// ── Dibujo ────────────────────────────────────────────────────────────────────
// Dentro del canvas no se pinta HUD alguno: puntuación, vidas y nivel salen una
// sola vez, en React.

function fondo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLOR_FONDO;
  ctx.fillRect(0, 0, W, H);
}

/** Grilla tenue de 25 px: da escala al tablero sin competir con la serpiente. */
function grilla(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = COLOR_GRILLA;
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

/**
 * Borde del tablero en cian tenue. No es adorno: marca exactamente la línea que
 * cuesta una vida, que si no queda a merced del bisel del marco CRT.
 */
function borde(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = COLOR_BORDE;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

function dibujar(
  ctx: CanvasRenderingContext2D,
  g: GameState,
  atlas: FruitsAtlas | null,
) {
  fondo(ctx);
  grilla(ctx);
  borde(ctx);
  if (g.phase === "loading" || !atlas) {
    rotuloCargando(ctx);
    return;
  }
  if (g.fruit) {
    // Sin sombra heredada: la fruta es un sprite, no una fuente de luz.
    ctx.shadowBlur = 0;
    drawFruit(
      ctx,
      atlas,
      g.fruit.key,
      g.fruit.cell.x * CELL,
      g.fruit.cell.y * CELL,
      CELL,
    );
  }
  serpiente(ctx, g);
}

/**
 * Cuerpo, cabeza y ojos. Durante `dying` la serpiente parpadea con periodo
 * `BLINK_MS`: es la única señal de que se ha perdido una vida dentro del
 * canvas, porque el recuento vive en el HUD de React.
 */
function serpiente(ctx: CanvasRenderingContext2D, g: GameState) {
  if (g.phase === "dying" && Math.floor(g.dyingMs / BLINK_MS) % 2 === 0) return;

  ctx.save();
  // De la cola a la cabeza, para que la cabeza quede encima en los giros
  // cerrados y su brillo no lo tape el segmento siguiente.
  for (let i = g.snake.length - 1; i >= 0; i--) {
    const seg = g.snake[i];
    const esCabeza = i === 0;
    // El brillo se apaga hacia la cola: el rastro de fósforo del CRT que enmarca
    // todo el sitio, y de paso deja leer de un vistazo hacia dónde va.
    const desvanecido = 1 - (i / Math.max(g.snake.length, 1)) * 0.55;
    ctx.globalAlpha = esCabeza ? 1 : desvanecido;
    ctx.fillStyle = esCabeza ? COLOR_CABEZA : COLOR_CUERPO;
    ctx.shadowColor = esCabeza ? COLOR_CABEZA : COLOR_CUERPO;
    ctx.shadowBlur = esCabeza ? GLOW_CABEZA : GLOW_CUERPO * desvanecido;
    ctx.beginPath();
    ctx.roundRect(
      seg.x * CELL + 1.5,
      seg.y * CELL + 1.5,
      CELL - 3,
      CELL - 3,
      RADIO_SEGMENTO,
    );
    ctx.fill();
  }
  ctx.restore();
  ojos(ctx, g);
}

/**
 * Dos ojos mirando hacia donde se mueve la serpiente. Van perforados en el
 * color del tablero en vez de pintados en negro, así que son literalmente
 * huecos por los que se ve el fondo.
 */
function ojos(ctx: CanvasRenderingContext2D, g: GameState) {
  const cabeza = g.snake[0];
  const cx = cabeza.x * CELL + CELL / 2;
  const cy = cabeza.y * CELL + CELL / 2;
  // Perpendicular a la marcha: separa los dos ojos sin depender de la dirección.
  const px = -g.dir.y;
  const py = g.dir.x;
  const avance = CELL * 0.17;
  const separacion = CELL * 0.2;

  ctx.save();
  ctx.fillStyle = COLOR_FONDO;
  for (const lado of [1, -1]) {
    ctx.beginPath();
    ctx.arc(
      cx + g.dir.x * avance + px * separacion * lado,
      cy + g.dir.y * avance + py * separacion * lado,
      2.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
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
      // "JUGAR DE NUEVO": partida limpia. Resetear la caché a -1 fuerza a
      // reemitir 0 puntos, 3 vidas y nivel 1; bajar el flag permite que el
      // siguiente fin de partida vuelva a abrir el modal. El estado nuevo llega
      // con `queued` vacío, así que una flecha pulsada mientras el modal estaba
      // abierto no gira la serpiente al reanudar.
      restart: () => {
        gameRef.current = crearEstado();
        // El atlas ya está cargado en este punto, así que la partida nueva no
        // vuelve a pasar por "CARGANDO…" ni espera a nada.
        if (atlas) gameRef.current.phase = "playing";
        emitido.score = -1;
        emitido.lives = -1;
        emitido.level = -1;
        gameOverEmitido = false;
      },
      // Botón "FIN": no abre un camino nuevo. Pone la última vida y ejecuta el
      // mismo choque, igual que `killShip(g)` en ROCAS. Se resuelve aquí y no
      // en el siguiente `actualizar()` porque con el juego en pausa el loop no
      // actualiza y el modal nunca llegaría a abrirse.
      forceGameOver: () => {
        const g = gameRef.current;
        if (!g) return;
        g.lives = 1;
        chocar(g);
      },
    };

    // Teclado en `window`, con `e.code` como el resto del proyecto, y
    // `preventDefault()` en las cuatro flechas para que la página no haga
    // scroll mientras se juega.
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = TECLAS[e.code];
      if (!dir) return;
      // `preventDefault` también en pausa: la flecha no debe hacer scroll de la
      // página aunque el juego esté congelado.
      e.preventDefault();
      // En pausa el giro se descarta en vez de encolarse: si se guardara, al
      // pulsar "REANUDAR" la serpiente saldría en otra dirección.
      if (propsRef.current.paused) return;
      const g = gameRef.current;
      if (g) encolarGiro(g, dir);
    };

    window.addEventListener("keydown", onKeyDown);

    // El atlas solo existe a partir de su `onload`; hasta entonces el loop ya
    // corre, pero pinta el rótulo de espera en vez del tablero.
    let atlas: FruitsAtlas | null = null;
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
        dibujar(ctx, g, atlas);

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

    // Si el componente se desmonta mientras el PNG viaja, `cancelarCarga` impide
    // que el `onload` toque un estado que ya no se dibuja.
    const cancelarCarga = loadFruitsAtlas(FRUITS_SRC, (cargado) => {
      atlas = cargado;
      const g = gameRef.current;
      if (g && g.phase === "loading") g.phase = "playing";
    });

    frame = requestAnimationFrame(loop);

    return () => {
      apiRef.current = null;
      cancelarCarga();
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

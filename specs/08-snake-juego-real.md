# SPEC 08 — Snake real en el slot "SERPENTINA"

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-09-17
> **Objetivo:** Implementar desde cero un motor de Snake en `components/games/SnakeGame.tsx` que reemplaza el simulador falso de `/games/serpentina/play`, dibuja su comida con el atlas de `references/source-assets/snake-assets/` y conecta su puntuación al ranking real de Supabase.

## Por qué este spec

Los tres juegos reales anteriores eran **ports**: había un `game.js` standalone en
`references/started-games/` con la lógica ya resuelta y el trabajo consistía en despegarla de sus
globals y de su HUD. Aquí no hay fuente. Lo único que se entrega son **assets**: `fruits.png`
(atlas de 3790×442 px con 22 frutas) y `sprites.js`, una tabla de recortes. La lógica del juego se
escribe entera en esta spec.

Eso cambia dos cosas respecto a SPEC 04, 06 y 07:

- **No hay sección "qué se retira del original".** No hay HUD interno que borrar ni overlay de
  GAME OVER que desactivar, porque no hay original. En su lugar, el contrato de `registry.ts` se
  respeta desde la primera línea.
- **Las reglas del juego son decisiones de esta spec, no hallazgos de un análisis.** Velocidad,
  vidas, puntuación y reaparición están fijadas abajo con valores concretos, y el plan de
  implementación las da por cerradas.

Lo que sí se hereda intacto es el chasis: el contrato `GameEngineProps` / `GameEngineHandle`, el
HUD de React como único HUD, el modal de `GamePlayer` como único fin de partida y
`POST /api/scores` como única escritura al ranking.

El atlas sí se porta, con el mismo tratamiento que recibió el spritesheet de Arkanoid en SPEC 07:
`window.SPRITE_ATLAS` es un global de navegador y aquí pasa a ser un módulo de datos puros,
`components/games/snake-assets.ts`, sin una sola línea de lógica de juego.

Dos comprobaciones previas, para que conste que las omisiones son deliberadas:

| Comprobación                                   | Resultado                                                    | Consecuencia                                              |
| ---------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| ¿Existe `components/games/registry.ts`?        | Sí, desde SPEC 06; hoy con `rocas`, `caida` y `bloque-buster` | **Se omite el Bloque A**: la plataforma ya está generalizada |
| ¿Tiene `serpentina` fila en `public.games`?    | Sí, desde la semilla de SPEC 05                               | **No hace falta migración**                                |

SERPENTINA es, por tanto, el cuarto motor real y el primero que el registro absorbe sin tocar nada
fuera de su propia línea.

## Scope

**Incluye:**

- Nuevo `components/games/SnakeGame.tsx`: Client Component con `<canvas width={800} height={600}>`
  que implementa el juego completo — serpiente sobre grilla de 32×24 celdas de 25 px, movimiento
  por tick, crecimiento al comer, colisión contra muros y contra la propia cola, tres vidas con
  reaparición, diez escalones de velocidad y puntuación — respetando el contrato
  `GameEngineProps` / `GameEngineHandle` de `components/games/registry.ts`.
- Nuevo `components/games/snake-assets.ts`: los 22 recortes de
  `references/source-assets/snake-assets/sprites.js` como constante tipada, más el cargador de la
  imagen. Datos puros y funciones puras; el global `window.SPRITE_ATLAS` del fuente no sobrevive.
- El asset `fruits.png` copiado a `public/games/serpentina/fruits.png` y referenciado con ruta
  absoluta desde el componente. `sprites.js` no se copia: su contenido vive ya en
  `snake-assets.ts`.
- Una entrada en `GAME_ENGINES`:
  `"serpentina": { Component: SnakeGame, hasLives: true, fitHeight: false }`. Es el único cambio en
  el registro, y con él `GamePlayer`, `/leaderboard` y `/games/[id]` reconocen el juego sin tocar
  una línea más.
- Carga del atlas dentro del componente, con rótulo "CARGANDO…" sobre fondo negro mientras resuelve
  y cancelación limpia si el componente se desmonta antes de que la imagen llegue.
- HUD de React con sus tres casillas: Puntuación = `score`, Vidas = `lives` (3 iniciales),
  Nivel = `level` (1–10).
- `lib/games.ts`: rellenar el campo opcional `controls` de la entrada `serpentina`, hoy vacío, con
  las cuatro flechas. No se toca ninguna otra propiedad de la entrada.
- `serpentina` escribe al ranking real: `POST /api/scores` con `game_id: "serpentina"`, pestaña
  **SERPENTINA** seleccionable en `/leaderboard` y "Mejor global" real en `/games/serpentina`.
- Controles de teclado solo con flechas, leídas como `e.code`, con `preventDefault()` en las cuatro
  para que la página no haga scroll.
- Botones heredados: "PAUSA" congela el loop de verdad, "FIN" equivale a perder la última vida,
  "JUGAR DE NUEVO" arranca una partida limpia y limpia el input pulsado.

**Fuera de alcance (para specs futuros):**

- Controles táctiles o por gestos para móvil. Esta spec es solo teclado, como el resto del sitio.
- WASD como alternativa a las flechas. Se descartó a propósito para no separarse de ROCAS y CAÍDA.
- Sonido. El atlas entregado no trae audio y no se inventa ninguno.
- Frutas con valores distintos entre sí, frutas especiales temporales, obstáculos o power-ups.
- Wrap toroidal, muros configurables o modos de dificultad seleccionables.
- Una portada nueva: `.cover-snake` ya existe en `app/globals.css` y no se toca.
- Que los cuatro juegos restantes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) obtengan motor
  real.
- Autenticación real: el login sigue siendo el simulacro de `localStorage` de `lib/session.tsx`.
- Realtime en el ranking y tests automatizados.

## Data model

No se añaden tipos a `lib/` ni claves nuevas de `localStorage`. Todo vive en dos ficheros nuevos
bajo `components/games/`.

**Contrato del componente.** Es el de `components/games/registry.ts`, sin ampliarlo:

```ts
// components/games/SnakeGame.tsx
export default function SnakeGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  ref,
}: GameEngineProps) { … }
```

`ref` es una prop normal (React 19, sin `forwardRef`) y expone el `GameEngineHandle` de siempre:
`restart()` y `forceGameOver()`. El componente devuelve un único elemento:
`<canvas ref={canvasRef} className="game-canvas" width={800} height={600} />`.

**Datos del atlas** (`components/games/snake-assets.ts`), portados de
`references/source-assets/snake-assets/sprites.js` sin cambiar un solo número:

```ts
export type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };
export type FruitKey = "banana" | "orange" | "grape" | … ; // las 22 claves

export const FRUITS: Record<FruitKey, SpriteFrame>;
export const FRUIT_KEYS: FruitKey[]; // Object.keys(FRUITS), para el sorteo
export const FRUITS_SRC = "/games/serpentina/fruits.png";

/** Mismo patrón que `loadSpritesheet` de SPEC 07: devuelve la función de cancelación. */
export function loadFruitsAtlas(
  src: string,
  onReady: (atlas: HTMLCanvasElement) => void,
): () => void;
```

Los recortes del fuente son `{x, y, w, h}` y aquí pasan a `{sx, sy, sw, sh}`, que es el nombre que
ya usa `arkanoid-assets.ts` y el orden de argumentos de `drawImage`. La imagen se decodifica a un
`HTMLCanvasElement` fuera de pantalla antes de usarse, igual que el spritesheet de Arkanoid, para
que el primer dibujado no dé un tirón.

**Estado interno** (en refs, nunca en `useState`):

```ts
type Cell = { x: number; y: number }; // coordenadas de grilla, no de píxel
type Phase = "loading" | "playing" | "dying" | "gameover";

type GameState = {
  snake: Cell[];      // índice 0 = cabeza; longitud = segmentos vivos
  dir: Cell;          // dirección aplicada en el último tick
  queued: Cell[];     // giros pendientes, máximo 2
  fruit: { cell: Cell; key: FruitKey } | null;
  acc: number;        // segundos acumulados hacia el próximo tick
  eaten: number;      // frutas comidas en la partida
  score: number;
  lives: number;
  level: number;      // 1–10
  phase: Phase;
  dyingMs: number;    // cuenta atrás de la reaparición
};
```

`level` no es un contador independiente: siempre es `min(floor(eaten / 5) + 1, 10)`. Por eso
sobrevive a la pérdida de una vida sin lógica adicional — `eaten` no se resetea.

**Constantes del juego** (a nivel de módulo, que es lo único que puede vivir fuera del efecto):

```ts
const CELL = 25;
const COLS = 32;                // 32 * 25 = 800
const ROWS = 24;                // 24 * 25 = 600
const W = COLS * CELL;
const H = ROWS * CELL;

const START_LIVES = 3;
const START_LEN = 3;            // segmentos al nacer y al reaparecer
const FRUITS_PER_LEVEL = 5;
const MAX_LEVEL = 10;
const POINTS_PER_FRUIT = 10;    // puntos = POINTS_PER_FRUIT * level

/** Pasos por segundo, índice = level - 1. El tick dura 1000 / valor ms. */
const STEPS_PER_SEC = [8, 9, 10, 11, 12, 13, 15, 17, 18, 20];

const DYING_MS = 1500;          // pausa tras chocar, con parpadeo
const BLINK_MS = 150;           // periodo del parpadeo durante "dying"
const MAX_DT = 0.05;            // cap contra el tunneling al volver del blur
```

**Cómo se mueve.** El loop es de `requestAnimationFrame`, pero el juego avanza por ticks discretos:
cada frame suma `dt` a `acc` y, mientras `acc >= 1 / STEPS_PER_SEC[level - 1]`, consume un tick. En
cada tick se desencola un giro (si lo hay y no es de 180°), se calcula la celda de la cabeza y se
resuelve colisión o comida. Entre ticks no hay interpolación: la serpiente se dibuja siempre
alineada a la grilla.

**Dónde aparece la fruta.** Celda uniformemente aleatoria entre las **libres** (las que no ocupa la
serpiente), y `key` uniformemente aleatoria entre las 22 de `FRUIT_KEYS`. Los recortes miden 160 px
de alto y anchos de 110 a 170; se dibujan escalados a `CELL` conservando la proporción y centrados
en la celda, así que una banana no se ve gorda ni una sandía estrecha.

**Las cuatro transiciones de `phase`:**

| De         | A          | Cuándo                                                                                                                                       |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`  | `playing`  | El atlas termina de cargar                                                                                                                   |
| `playing`  | `dying`    | La cabeza entra en un muro o en un segmento del cuerpo, con `lives > 1`                                                                       |
| `dying`    | `playing`  | `dyingMs` llega a 0: serpiente de `START_LEN` al centro mirando a la derecha; `score`, `eaten`, `level` y la fruta intactos                   |
| `playing`  | `gameover` | Choque con `lives === 1`, o `forceGameOver()`. Se emite `onGameOver(score)` una sola vez                                                      |

`forceGameOver()` no abre un camino nuevo: pone `lives = 1` y ejecuta el mismo choque, exactamente
como `killShip(g)` en ROCAS.

## Implementation plan

**Sin Bloque A.** `components/games/registry.ts` existe desde SPEC 06 y ya generaliza `GamePlayer`,
`/leaderboard` y `/games/[id]`. Este plan solo añade una línea a `GAME_ENGINES`.

**Sin paso de migración.** `serpentina` ya tiene fila en `public.games` desde la semilla de SPEC 05,
así que el primer `POST /api/scores` con ese `game_id` no puede fallar por clave foránea.

Cada paso deja el sistema funcionando y es commiteable por separado, con la convención del repo
(`feat(spec8): pasoN <descripción>`).

1. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` a
   `public/games/serpentina/fruits.png`. Crear `components/games/snake-assets.ts` con los 22
   recortes de `sprites.js` renombrados a `{sx, sy, sw, sh}`, `FRUIT_KEYS`, `FRUITS_SRC` y
   `loadFruitsAtlas`. Sin lógica de juego y sin globals.
   _Prueba:_ `http://localhost:3000/games/serpentina/fruits.png` devuelve la imagen y
   `npm run build` pasa.

2. **Esqueleto React↔canvas.** Crear `components/games/SnakeGame.tsx` con las cinco piezas del
   patrón: `propsRef` refrescado por un efecto sin dependencias, `gameRef` con el `GameState`,
   `apiRef` + `useImperativeHandle`, un único `useEffect(…, [])` dueño del `ctx`, los listeners y
   el `rAF`, y el cleanup que cancela el frame, quita los listeners y anula `apiRef`. El loop
   calcula `dt` en segundos capado a `MAX_DT`, salta `update` cuando `paused` y dibuja siempre. De
   momento solo pinta fondo negro, la grilla tenue y "CARGANDO…". Registrar
   `"serpentina": { Component: SnakeGame, hasLives: true, fitHeight: false }` en `GAME_ENGINES`.
   _Prueba:_ `/games/serpentina/play` muestra el canvas dentro del marco CRT en vez de la arena
   decorativa; el HUD marca 0 puntos, 3 vidas y nivel 1 y **no sube solo**; "PAUSA" y "SALIR" no
   rompen nada.

3. **Carga del atlas.** Llamar a `loadFruitsAtlas` dentro del efecto; al resolver, guardar el canvas
   fuera de pantalla y pasar `phase` a `playing`. Cancelar limpiamente si el componente se desmonta
   antes. Dibujar una fruta fija en el centro para validar el escalado a `CELL` conservando
   proporción.
   _Prueba:_ "CARGANDO…" aparece y desaparece; la fruta se ve nítida y centrada en su celda, no
   deformada; salir de la página durante la carga no lanza ningún warning en consola.

4. **Serpiente e input.** Estado inicial de `START_LEN` segmentos en el centro mirando a la derecha.
   Movimiento por ticks (`acc` contra `1 / STEPS_PER_SEC[0]`). Listeners de `keydown`/`keyup` en
   `window` leyendo `e.code`, con `preventDefault()` en las cuatro flechas. Cola `queued` de máximo
   2 giros, uno por tick, descartando el de 180°. Sin colisiones todavía: la serpiente sale del
   tablero y no pasa nada.
   _Prueba:_ la serpiente avanza sola a velocidad constante, gira con las flechas, no se puede
   invertir sobre sí misma, dos flechas rápidas seguidas se aplican en ticks distintos, y las
   flechas **no hacen scroll de la página**.

5. **Fruta, crecimiento y puntuación.** Sortear celda libre y `key` entre las 22. Al comer: no se
   elimina el último segmento ese tick (crecimiento), `eaten++`,
   `score += POINTS_PER_FRUIT * level` y se sortea la siguiente fruta. Emitir `onScoreChange` con
   la caché `emitido` (solo cuando cambia, nunca por frame).
   _Prueba:_ cada bocado alarga la serpiente en un segmento, la fruta reaparece en una celda libre
   distinta y con otro sprite, y la casilla "Puntuación" del HUD sube de 10 en 10 solo al comer.

6. **Colisiones, vidas y fin de partida.** Choque contra muro o contra un segmento del cuerpo:
   `lives--`, `phase = "dying"`, `dyingMs = DYING_MS`. Al agotarse, serpiente de `START_LEN` al
   centro mirando a la derecha conservando `score`, `eaten`, `level` y la fruta. Con la última vida:
   `phase = "gameover"` y `onGameOver(score)` una sola vez (flag `gameOverEmitido`). Emitir
   `onLivesChange`. El canvas **no** dibuja ningún "GAME OVER" ni acepta reinicio con Espacio.
   _Prueba:_ chocar contra un muro y contra la cola resta una vida; la serpiente reaparece tras la
   pausa con la puntuación intacta; la tercera muerte abre el modal de `GamePlayer` con la
   puntuación acumulada.

7. **Niveles y velocidad.** `level = min(floor(eaten / FRUITS_PER_LEVEL) + 1, MAX_LEVEL)`,
   recalculado al comer; el intervalo del tick pasa a leerse de `STEPS_PER_SEC[level - 1]`. Emitir
   `onLevelChange`.
   _Prueba:_ a las 5 frutas el HUD marca nivel 2 y se nota la aceleración; a las 45 frutas se queda
   en nivel 10 y ya no acelera más; morir no baja el nivel; cada fruta pasa a valer `10 × nivel`.

8. **Pulido visual**, invocando `/frontend-design` como exige `CLAUDE.md`. Grilla de 25 px apenas
   visible sobre `#0a0a18`, cuerpo en `var(--green)` con `shadowBlur` y esquinas ligeramente
   redondeadas, cabeza más clara con dos ojos orientados según la dirección, borde del tablero en
   cian tenue, y parpadeo de la serpiente durante `dying` con periodo `BLINK_MS`.
   _Prueba:_ captura con Playwright MCP; el tablero se lee con claridad, la cabeza se distingue del
   cuerpo y el parpadeo de la reaparición es visible.

9. **Puente completo con el HUD.** `restart()`: `score`, `eaten` y `queued` a 0, `lives` a
   `START_LIVES`, `level` a 1, serpiente al centro, fruta nueva, `emitido` a `-1`,
   `gameOverEmitido` abajo y **mapa de teclas limpiado** (sin eso, una flecha pulsada durante el
   modal giraría al reanudar). `forceGameOver()`: `lives = 1` y el mismo camino de choque. Verificar
   que "PAUSA" congela de verdad el tick y que el último frame queda estático. Rellenar `controls`
   de la entrada `serpentina` en `lib/games.ts` con las cuatro flechas.
   _Prueba:_ "PAUSA" detiene la serpiente en seco y "REANUDAR" continúa desde la misma celda; "FIN"
   abre el modal con la puntuación acumulada; "JUGAR DE NUEVO" arranca limpio con 3 vidas y nivel 1;
   el bloque de controles aparece en `/games/serpentina`.

10. **Cierre.** `npm run lint` y `npm run build` sin errores. Prueba end-to-end con **Playwright
    MCP**: jugar, comer varias frutas, pausar, reanudar, terminar con "FIN", guardar la puntuación
    con un nombre, y comprobar que la marca aparece en `/leaderboard` bajo la pestaña SERPENTINA y
    en "Mejor global" de `/games/serpentina`. Verificar además en modo desarrollo (StrictMode) que
    la serpiente no corre al doble de velocidad ni consume dos veces cada pulsación.

## Acceptance criteria

**Heredados del chasis (SPEC 04 / 05 / 06):**

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] `/games/serpentina/play` renderiza un `<canvas>` real de 800×600 dentro del marco CRT, no la
      arena decorativa.
- [ ] Los cuatro juegos sin motor (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen con el
      simulador falso, y ROCAS, CAÍDA y BLOQUE BUSTER no cambian de comportamiento.
- [ ] Las cuatro flechas no provocan scroll de la página mientras se juega.
- [ ] El HUD superior refleja el estado real y no avanza solo cuando el jugador no toca nada.
- [ ] Dentro del canvas no se dibuja HUD alguno: puntuación, vidas y nivel aparecen una sola vez, en
      React.
- [ ] "PAUSA" congela el juego; "REANUDAR" continúa desde la misma celda y con la misma dirección.
- [ ] "FIN" abre el modal con la puntuación acumulada hasta ese momento.
- [ ] Perder la última vida abre el modal, sin overlay "GAME OVER" propio del canvas ni reinicio con
      Espacio.
- [ ] "JUGAR DE NUEVO" arranca una partida limpia: 0 puntos, 3 vidas, nivel 1, serpiente de 3
      segmentos al centro.
- [ ] "SALIR" navega al detalle y al desmontar se cancela el `requestAnimationFrame`, se remueven
      los listeners de teclado y se cancela la carga del atlas si sigue en vuelo.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con `game_id = "serpentina"` y el nombre y
      la puntuación reales.
- [ ] La marca aparece después en `/leaderboard`, bajo una pestaña **SERPENTINA** seleccionable, y
      en "Mejor global" de `/games/serpentina`.
- [ ] En desarrollo (StrictMode) la serpiente no corre al doble de velocidad ni consume dos veces
      cada pulsación.

**Propios de SERPENTINA:**

- [ ] La serpiente avanza sola a ritmo constante desde que el atlas carga, sin esperar a ninguna
      tecla.
- [ ] Mientras el atlas carga se ve "CARGANDO…" sobre fondo negro, y desaparece al resolver.
- [ ] Un giro de 180° se ignora: la serpiente nunca se muerde el cuello por pulsar la dirección
      contraria.
- [ ] Dos flechas pulsadas dentro del mismo tick se aplican en ticks consecutivos, no se pisan ni se
      pierden.
- [ ] Comer una fruta alarga la serpiente exactamente un segmento y suma `10 × nivel` puntos.
- [ ] La fruta nueva nunca aparece sobre una celda ocupada por la serpiente.
- [ ] Los sprites se reparten entre las 22 frutas del atlas y se dibujan sin deformar: una banana
      estrecha se ve estrecha y una sandía ancha se ve ancha.
- [ ] Tocar cualquiera de los cuatro muros cuesta una vida.
- [ ] Morderse la cola cuesta una vida.
- [ ] Al perder una vida la serpiente parpadea ~1,5 s y reaparece con 3 segmentos en el centro
      mirando a la derecha.
- [ ] Tras reaparecer, la puntuación, el nivel y la fruta en juego siguen intactos.
- [ ] El HUD muestra la casilla "Vidas" con tres corazones al empezar y uno menos tras cada choque.
- [ ] El nivel sube exactamente cada 5 frutas comidas y se detiene en 10.
- [ ] La velocidad sigue la tabla `STEPS_PER_SEC`: 8 pasos/s en el nivel 1 y 20 en el nivel 10, sin
      pasar de ahí.
- [ ] Perder una vida no baja el nivel ni la velocidad.
- [ ] `/games/serpentina` muestra el bloque de controles con las cuatro flechas.

## Decisions

**Heredadas del chasis, sin discusión:**

- **Sí:** el estado del juego vive en refs mutables y se dibuja por `requestAnimationFrame`.
  Re-renderizar React a 60 fps es inviable.
- **Sí:** los callbacks al HUD se emiten solo cuando el valor cambia, con la caché `emitido`
  inicializada a `-1`, nunca en cada frame.
- **Sí:** un solo HUD, el de React. El canvas no dibuja puntuación, vidas ni nivel.
- **Sí:** un solo flujo de fin de partida, el modal de `GamePlayer`. `forceGameOver()` recorre el
  mismo camino que perder la última vida, no uno paralelo.
- **Sí:** "PAUSA" congela de verdad el loop — deja de llamarse `update` y el último frame queda
  estático —, no superpone un overlay decorativo.
- **Sí:** listeners de teclado en `window`, montados y desmontados con el componente, con
  `preventDefault()` en las teclas del juego.
- **Sí:** a nivel de módulo solo constantes y funciones puras. Todo el mundo mutable se crea dentro
  del efecto, para que dos montajes no lo compartan.
- **No:** Bloque A. `components/games/registry.ts` ya existe desde SPEC 06 y la plataforma ya está
  generalizada; añadir SERPENTINA es una línea en `GAME_ENGINES`.
- **No:** migración de base de datos. `serpentina` ya está en `public.games` desde la semilla de
  SPEC 05.
- **No:** tests automatizados. El proyecto sigue sin test runner; la verificación es manual más
  Playwright MCP.

**Propias de esta spec:**

- **Sí:** reutilizar el slot `serpentina` sin tocar su metadata. Su ficha ya describe este juego
  literalmente ("crece sin morder tu propia cola", núcleos que alargan y aceleran) y `.cover-snake`
  ya existe en `globals.css`. Lo único que se rellena es el campo opcional `controls`, hoy vacío. Es
  lo mismo que hicieron SPEC 04 con `rocas` y SPEC 07 con `bloque-buster`.
- **Sí:** canvas 800×600 con celdas de 25 px, es decir una grilla de 32×24. Es el 4:3 exacto del
  marco CRT, así que `fitHeight: false`, no hace falta letterbox y no se toca el CSS del marco. Las
  tres cifras encajan sin resto (32×25 = 800, 24×25 = 600), de modo que no quedan franjas muertas ni
  celdas partidas.
- **Sí:** tres vidas con reaparición, en vez del Snake canónico de una sola muerte. Llena el hueco
  "Vidas" del HUD sin inventar una métrica postiza, y el registro ya soporta `hasLives: true` sin
  cambios. El precio es un estado `dying` que el Snake clásico no tiene.
- **Sí:** al reaparecer se conservan `score`, `eaten`, `level` y la fruta; solo se reinicia la
  serpiente a 3 segmentos en el centro. Reaparecer con la longitud acumulada obligaría a resolver el
  caso de una serpiente que ya no cabe estirada en el centro, y reiniciar el nivel castigaría dos
  veces el mismo error.
- **Sí:** los muros matan. Con wrap toroidal las vidas casi nunca entrarían en juego —solo se
  moriría por autocolisión— y las partidas se alargarían sin aumentar la dificultad.
- **Sí:** `level = min(floor(eaten / 5) + 1, 10)`, derivado y no acumulado. Al no ser un contador
  propio, sobrevive solo a la pérdida de una vida y no puede desincronizarse de `eaten`.
- **Sí:** la velocidad se lee de una tabla explícita de 10 valores,
  `[8, 9, 10, 11, 12, 13, 15, 17, 18, 20]` pasos/s. Una fórmula lineal de "+2 por nivel" llegaría a
  26 pasos/s en el nivel 10 y haría el juego injugable; la tabla aterriza exactamente en el tope
  decidido y se ajusta sin tocar código.
- **Sí:** las 22 frutas del atlas se sortean por igual y todas valen `10 × nivel`. Asignar un valor
  distinto a cada una significaría inventar y equilibrar 22 números sin ninguna fuente que los
  respalde; el multiplicador por nivel ya premia jugar rápido.
- **Sí:** los sprites se escalan a la celda conservando proporción. Los recortes miden 160 px de
  alto pero de 110 a 170 de ancho; estirarlos todos a un cuadrado deformaría la mitad del atlas.
- **Sí:** el global `window.SPRITE_ATLAS` de `sprites.js` pasa a módulo de datos puros
  `components/games/snake-assets.ts`, con los nombres `{sx, sy, sw, sh}` de `arkanoid-assets.ts`. El
  fichero fuente no se copia a `public/`; solo viaja el PNG.
- **Sí:** la partida arranca sola en cuanto el atlas carga, con "CARGANDO…" mientras tanto. Es el
  patrón de ARKANOID y evita un estado `ready` extra que además habría que decidir después de cada
  reaparición.
- **No:** WASD. Solo flechas, como ROCAS y CAÍDA. Añadirlo es trivial, pero separa a este juego del
  resto sin motivo.
- **No:** sonido. El material entregado no trae audio y no se inventa ninguno.

## Risks

| Riesgo                                                                       | Mitigación                                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Globals de módulo compartidos entre dos montajes                             | A nivel de módulo solo constantes y funciones puras; el `GameState` se crea dentro del efecto. `window.SPRITE_ATLAS` desaparece al portarse a `snake-assets.ts`  |
| StrictMode monta el efecto dos veces en dev: dos loops y listeners duplicados | Cleanup que cancela el `rAF`, quita los listeners y cancela la carga del atlas; verificación explícita en dev (paso 10)                                          |
| `dt` enorme al volver de una pestaña en segundo plano                        | `MAX_DT = 0.05` antes de acumular en `acc`. Sin el cap, un `acc` grande consumiría decenas de ticks de golpe y la serpiente se estrellaría sola                  |
| El bucle de consumo de ticks (`while acc >= interval`) se dispara            | El cap de `dt` acota el número de ticks por frame a 1 como máximo incluso a 20 pasos/s                                                                           |
| Giro de 180° o doble giro dentro del mismo tick: suicidio no provocado        | La cola `queued` admite máximo 2 giros, se desencola uno por tick y se descarta el que invierte la dirección **aplicada**, no la encolada                        |
| Una flecha pulsada mientras el modal está abierto gira la serpiente          | `restart()` limpia el mapa de teclas y la cola de giros antes de arrancar                                                                                        |
| El sorteo de celda libre degenera cuando la serpiente ocupa casi todo        | Se sortea sobre la lista de celdas libres, no por reintentos aleatorios: siempre termina, y si no queda ninguna, la partida se da por ganada con `onGameOver`    |
| Los 22 recortes tienen anchos distintos y al escalar se deforman             | Se escala conservando proporción y se centra en la celda; criterio de aceptación explícito                                                                       |
| El PNG pesa 572 KB y tarda en cargar                                          | Rótulo "CARGANDO…" y cancelación limpia si el componente se desmonta antes. Se sirve estático desde `public/`, cacheado tras la primera partida                  |
| El canvas se escala por CSS y el ratio no coincide con las colisiones        | 800×600 es el 4:3 exacto de `.crt-screen`; `fitHeight: false` y ninguna colisión depende de píxeles de pantalla, solo de celdas                                  |
| El HUD parpadea por emisiones en cada frame                                   | Caché `emitido` inicializada a `-1` y flag `gameOverEmitido`                                                                                                     |
| `next@16` / `react@19` posteriores a los datos de entrenamiento              | Leer `node_modules/next/dist/docs/01-app/` antes de escribir, como pide `AGENTS.md`. Recordatorio: `ref` es una prop normal, sin `forwardRef`                    |
| La clave publicable viaja en el bundle: puntuaciones falsificables           | Constraints de la tabla y validación del endpoint. Acotan, no impiden. Sin Auth real no se cierra, y está documentado en `specs/05-leaderboard-supabase.md`      |

## Lo que **no** entra en este spec

- Motor real para los cuatro juegos que siguen siendo decorativos: `gloton`, `invasores`, `ranaria`
  y `duelo-pixel`.
- Controles táctiles, por gestos o WASD. Solo las cuatro flechas.
- Sonido en SERPENTINA.
- Frutas con valores distintos entre sí, frutas especiales temporales, obstáculos, power-ups o modos
  de dificultad.
- Wrap toroidal o muros configurables.
- Cambios en `.cover-snake`, en la copy de la entrada `serpentina` o en cualquier otra propiedad
  suya distinta de `controls`.
- Cambios en `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` o
  `app/games/[id]/play/page.tsx`: ya son genéricos por `game_id`.
- Supabase Auth: login, registro y sesión real. El login sigue siendo el simulacro de
  `localStorage`.
- Realtime: el ranking no se actualiza solo.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.

# SPEC 07 — Arkanoid real en el slot "BLOQUE BUSTER"

> **Estado:** Aprovado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-09-15
> **Objetivo:** Portar el Arkanoid standalone de `references/started-games/04-arkanoid/` a un componente cliente que reemplaza el simulador falso de `/games/bloque-buster/play` y conecta su puntuación al ranking real de Supabase, sumándose al registro de motores que creó SPEC 06.

## Por qué este spec

SPEC 06 pagó la deuda de la generalización: `components/games/registry.ts` ya existe y es el único
sitio que declara qué juegos tienen motor real. **Por eso este spec no lleva Bloque A.** Añadir
Arkanoid es exactamente lo que el registro prometía: una línea en `GAME_ENGINES` y un componente,
sin tocar `GamePlayer`, el salón de la fama ni la página de detalle.

Es además el port más limpio de los tres juegos de `references/started-games/`: su canvas es
800×600, es decir el 4:3 exacto del marco CRT, y llena los tres huecos del HUD (puntuación, vidas y
nivel) sin forzar ningún mapeo. A cambio trae dos cosas que los otros dos no tenían: **assets**
—un spritesheet PNG y dos MP3— y un **arranque asíncrono**, porque todo el juego original vive
dentro del callback de `loadSpritesheet()`. Y le falta una que sí tenían: **no existe reinicio
total**; `loadLevel()` repone bloques y pelota pero nunca resetea puntuación ni vidas, así que
`restart()` hay que escribirlo.

Dos comprobaciones previas, para que conste que las omisiones son deliberadas:

| Comprobación                                   | Resultado                            | Consecuencia            |
| ---------------------------------------------- | ------------------------------------ | ----------------------- |
| ¿Existe `components/games/registry.ts`?        | Sí, desde SPEC 06 (`rocas`, `caida`) | Se omite el Bloque A    |
| ¿Tiene `bloque-buster` fila en `public.games`? | Sí, desde la semilla de SPEC 05      | No hace falta migración |

## Scope

**Incluye:**

- Nuevo `components/games/ArkanoidGame.tsx`: Client Component con `<canvas width={800}
height={600}>` que porta la lógica de `references/started-games/04-arkanoid/game.js`,
  `levels.js` y `assets/spritesheet.js` — pala, pelota, rebotes, bloques, explosiones, vidas,
  puntuación y los 5 niveles — respetando el contrato `GameEngineProps` / `GameEngineHandle` de
  `components/games/registry.ts`.
- Una entrada en `GAME_ENGINES`: `"bloque-buster": { Component: ArkanoidGame, hasLives: true,
fitHeight: false }`. Es el único cambio necesario en el registro, y con él `GamePlayer`,
  `/leaderboard` y `/games/[id]` reconocen el juego sin tocar ni una línea más.
- Assets a `public/games/bloque-buster/`: `spritesheet-breakout.png`,
  `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3`, referenciados con rutas absolutas desde el
  componente.
- Carga del spritesheet dentro del propio componente, con rótulo "CARGANDO…" sobre fondo negro
  mientras resuelve y cancelación limpia si el componente se desmonta antes.
- Sonido de rebote y de rotura de bloque, con un pool de elementos `Audio` y volumen fijo, en
  lugar del `cloneNode().play()` por evento del original.
- Control de la pala con **ratón** (`mousemove` sobre el canvas, con el escalado por
  `getBoundingClientRect` que exige el estirado CSS) **y** con `ArrowLeft` / `ArrowRight` leídas
  como `e.code`, con `preventDefault()`.
- HUD de React con sus tres casillas: Puntuación = `score`, Vidas = `lives`, Nivel =
  `currentLevel` (1–5).
- Limpiar el nivel 5 termina la partida: `onGameOver(score)` y modal "FIN DEL JUEGO", el mismo
  camino que perder la última vida.
- `restart()` **nuevo**, que el original no tiene: puntuación a 0, 3 vidas, nivel 1, bloques
  repuestos, pala centrada y teclas limpiadas.
- `bloque-buster` escribe al ranking real: `POST /api/scores` con `game_id: "bloque-buster"`,
  pestaña **BLOQUE BUSTER** seleccionable en `/leaderboard` y "Mejor global" real en
  `/games/bloque-buster`.
- `lib/games.ts`: rellenar el campo opcional `controls` de la entrada `bloque-buster`, que SPEC 06
  añadió al tipo `Game` y que hoy solo declara `caida`.
- Se retiran del original: el HUD dibujado en `draw()` (puntuación, nivel y las pelotas de vidas),
  `drawOverlay('GAME OVER')`, `drawOverlay('¡Completaste el juego!')`, `drawPauseOverlay()` entero
  con su selector de nivel de 5 botones, el listener de `click` sobre el canvas y las constantes
  `PAUSE_BTN_*`.
- **El juego no se pausa con el teclado.** No se portan `P`, `p` ni `Escape`: el único modo de
  pausar es el botón "PAUSA" del HUD de React, igual que en ROCAS y en CAÍDA. El componente no
  registra ningún listener para esas teclas.

**Fuera de alcance (para specs futuros):**

- **El Bloque A de generalización de la plataforma.** Ya lo hizo SPEC 06: `registry.ts` existe y
  `GamePlayer`, `app/leaderboard/page.tsx` y `app/games/[id]/page.tsx` ya son genéricos. Este spec
  **no los toca**.
- **Migración de Supabase.** `public.games` ya contiene la fila `bloque-buster` desde la semilla de
  SPEC 05. Este spec no toca la base de datos.
- Tocar `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` ni
  `app/games/[id]/play/page.tsx`. Ya son genéricos por `game_id`.
- Modificar la portada `.cover-bricks` ni la metadata de `bloque-buster` (título, cover, color,
  `short`, `long`, `best`, `plays`). `best` deja de leerse en `/games/bloque-buster`, pero el valor
  no se toca.
- Añadir CSS nuevo a `app/globals.css`. El canvas es 4:3, así que `.game-canvas` sirve tal cual y
  no hace falta el modificador `.fit-height` que SPEC 06 creó para CAÍDA.
- Rellenar `controls` para los 6 juegos restantes.
- **Corregir la física del original.** Se porta tal cual: romper un bloque siempre invierte `vy`
  sin mirar la cara de entrada, y el rebote en la pala no recalcula `vx`, así que el ángulo de la
  pelota no cambia en toda la partida. Nada de ángulo por punto de impacto ni de detección del eje
  de colisión.
- Bucle infinito de niveles más allá del 5, niveles nuevos, power-ups, bloques de varios impactos y
  cualquier otra mecánica que el original no tenga.
- Salto manual de nivel en cualquier forma (los 5 botones del overlay de pausa, teclas 1–5 o
  parámetro de URL): falsearía el ranking.
- Botón de silencio en el HUD de `GamePlayer`. El audio es fijo; un control de mute tocaría el
  chasis compartido y afectaría también a ROCAS y CAÍDA.
- Controles táctiles en pantalla para móvil.
- Que los 6 juegos restantes escriban al ranking real.
- Supabase Auth real, rate limiting o firma de puntuaciones. El ranking sigue siendo de confianza,
  con la limitación ya documentada en SPEC 05.
- Realtime en el salón de la fama, paginación o histórico más allá del top 10.
- Wiring de `next/font` para la tipografía pixel.
- Tests automatizados.

## Data model

No se toca la base de datos: `public.games` ya contiene la fila `bloque-buster` desde la semilla de
SPEC 05, y `scores` es genérica por `game_id`. Tampoco se añaden claves nuevas de `localStorage`
ni tipos a `lib/` — el único cambio en `lib/games.ts` es rellenar un campo que ya existe.

### Ficheros nuevos

| Fichero                               | Contenido                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/games/ArkanoidGame.tsx`   | El motor: contrato, estado, loop, física y render.                                                                                                       |
| `components/games/arkanoid-assets.ts` | Datos puros portados de `levels.js` y `assets/spritesheet.js`: `LEVELS`, `SPRITES`, `EXPLOSION_FRAMES`, el cargador del spritesheet y el pool de sonido. |

Se separan porque el original son tres ficheros y unas 90 líneas de esos datos son tablas sin
lógica de juego: dejarlas fuera mantiene `ArkanoidGame.tsx` en el mismo orden de tamaño que
`AsteroidsGame.tsx` (640 líneas). Ninguno de los dos exporta estado mutable a nivel de módulo, solo
constantes y funciones puras.

### Contrato del componente

No se declara ningún tipo nuevo: se importan de `components/games/registry.ts`, que SPEC 06 dejó
como contrato común de motores.

```ts
import type { GameEngineProps, GameEngineHandle } from "@/components/games/registry";

export default function ArkanoidGame({ ref, ...props }: GameEngineProps) { … }
```

`ref` es una prop normal (React 19, sin `forwardRef`). El componente devuelve un único elemento:

```tsx
<canvas ref={canvasRef} className="game-canvas" width={800} height={600} />
```

`onLivesChange` **sí** se emite: es el primer motor junto a ROCAS que lo hace.

### Entrada en el registry — `components/games/registry.ts`

```ts
export const GAME_ENGINES: Record<string, GameEngine> = {
  rocas: { Component: AsteroidsGame, hasLives: true, fitHeight: false },
  caida: { Component: TetrisGame, hasLives: false, fitHeight: true },
  "bloque-buster": {
    Component: ArkanoidGame,
    hasLives: true,
    fitHeight: false,
  },
};
```

`fitHeight: false` porque el canvas es 800×600, el 4:3 exacto de `.crt-screen`: se estira al marco
completo sin deformar y toda la matemática interna sigue siendo válida en píxeles del canvas.
`hasLives: true` porque el juego tiene 3 vidas y `GamePlayer` debe renderizar la casilla "Vidas".

### Estado interno del juego — `components/games/ArkanoidGame.tsx`

Mutable, dentro de un ref creado **en el efecto**. Nunca en `useState`: el loop corre a ~60 fps.
Todos los globals de módulo del original (`paddle`, `ball`, `blocks`, `explosions`, `lives`,
`score`, `gameState`, `currentLevel`, `isPaused`, `keys`, los dos `Audio`) desaparecen como tales.

```ts
type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
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
  lives: number; // arranca en 3
  level: number; // 1–5
  phase: "playing" | "gameover";
};
```

Dos ausencias deliberadas frente al original:

- **No hay campo `paused`.** La pausa la manda la prop del mismo nombre, leída desde `propsRef` en
  el loop, igual que en `AsteroidsGame` y `TetrisGame`. El `isPaused` global desaparece.
- **No hay fase `"win"`.** Limpiar el nivel 5 lleva a `phase = "gameover"` como cualquier otro
  final. Un solo camino de salida, un solo modal.

### Constantes portadas sin cambio de valor

De `game.js`: `W = 800`, `H = 600`, `PADDLE_SPEED = 400`, `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`,
`BLOCK_W = 64`, `BLOCK_H = 24`, `BLOCKS_ORIGIN_X = 80` (el `(800 − 10×64) / 2` del original, ya
resuelto), `BLOCKS_ORIGIN_Y = 80`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = −300`, la geometría de la
pala (`w = 81`, `h = 14`, `y = 560`), la de la pelota (`16×16`), `VIDAS_INICIALES = 3` y los 10
puntos por bloque.

De `assets/spritesheet.js`: `SPRITES` (paleta 162×14, pelota 16×16 y los 7 bloques de 32×16),
`EXPLOSION_FRAMES` (4 frames por color, `gray` reutiliza los de `red`) y
`EXPLOSION_DURATION = 150` ms.

De `levels.js`: los 5 niveles con sus `speed` — `1.00`, `1.10`, `1.21`, `1.33`, `1.46` — y sus
patrones (parrilla completa, pirámide, tablero de ajedrez, filas con huecos, marco + cruz). Se
portan **como tabla de datos ya resuelta**, no como el IIFE que los genera: los valores son los
mismos, pero el resultado se lee de un vistazo y no hay lógica que mantener.

`BLOCK_COLORS` del original no se porta: está declarado y nunca se usa.

**Constante nueva:** `MAX_DT = 0.05` — cap del delta **en segundos**. El original no lo tiene, así
que volver de una pestaña en segundo plano haría avanzar la pelota cientos de píxeles en un frame y
atravesar la pala y los bloques (tunneling). `dt` se mantiene en segundos, como el original, porque
todas sus magnitudes son píxeles por segundo; `EXPLOSION_DURATION` es el único valor en
milisegundos y se sigue acumulando con `dt * 1000`, igual que en la fuente.

### Assets y carga asíncrona

Los ficheros se copian a `public/` y se referencian con rutas absolutas:

| Origen                            | Destino                                               | Referencia desde el componente                  |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `assets/spritesheet-breakout.png` | `public/games/bloque-buster/spritesheet-breakout.png` | `/games/bloque-buster/spritesheet-breakout.png` |
| `assets/sounds/ball-bounce.mp3`   | `public/games/bloque-buster/sounds/ball-bounce.mp3`   | `/games/bloque-buster/sounds/ball-bounce.mp3`   |
| `assets/sounds/break-sound.mp3`   | `public/games/bloque-buster/sounds/break-sound.mp3`   | `/games/bloque-buster/sounds/break-sound.mp3`   |

El `loadSpritesheet(cb)` del original guarda la imagen en un global de módulo (`ssImg`, `ssLoaded`,
`ssCallbacks`) y arranca el juego entero desde su callback. Aquí:

- La carga vive **dentro del efecto**, con un flag `cancelado` que el cleanup levanta: si el
  componente se desmonta antes de que el PNG resuelva, el `onload` no hace nada y no se arranca
  ningún `requestAnimationFrame`.
- Mientras carga, el canvas pinta fondo negro y el rótulo **"CARGANDO…"** centrado, en monoespaciada
  del sistema. Cuando resuelve, arranca el loop.
- Se conserva el truco del original de volcar el PNG a un canvas offscreen antes de usarlo como
  fuente de `drawImage`.
- `drawSprite` / `drawFrame` pasan a recibir la imagen como parámetro en vez de leerla de un global.

### Sonido

`cloneNode().play()` por evento crea un elemento `Audio` nuevo en cada rebote, decenas por partida.
Se sustituye por un **pool**: N elementos `Audio` precargados por sonido, con volumen fijo, que se
reproducen por turno reiniciando `currentTime`. El pool se crea en el efecto y se libera en el
cleanup, así que dos montajes de StrictMode no comparten elementos.

Si el navegador bloquea la reproducción por su política de autoplay, el fallo se traga en silencio:
el juego no depende del audio.

### Campo `controls` en `lib/games.ts`

El tipo `Game` ya declara `controls?: GameControl[]` desde SPEC 06. Solo hay que rellenarlo en la
entrada `bloque-buster`:

| Teclas  | Acción                            |
| ------- | --------------------------------- |
| `Ratón` | Mover la pala siguiendo el cursor |
| `←` `→` | Mover la pala                     |

Ni `P` ni `Escape` aparecen: el juego no se pausa con el teclado.

## Implementation plan

**Sin Bloque A.** SPEC 06 ya generalizó la plataforma: `components/games/registry.ts` existe y
`GamePlayer`, `app/leaderboard/page.tsx` y `app/games/[id]/page.tsx` consultan el registro en vez de
comparar contra un `id` literal. Este spec solo añade un motor y lo registra.

Consecuencia de eso: **ningún paso toca un fichero de App Router** — ni rutas, ni layouts, ni
Route Handlers, ni `page.tsx` alguno. El bloque de controles del paso 12 ya lo renderiza
`app/games/[id]/page.tsx` de forma condicional desde SPEC 06; aquí solo se rellenan los datos. Si
durante la implementación algún paso pareciera necesitar tocar App Router, es señal de que el
diseño se ha torcido y hay que parar, no improvisar.

Tampoco se ejecuta `/frontend-design`: este spec no añade ni reforma interfaz. No hay CSS nuevo, la
portada `.cover-bricks` no se toca y el bloque de controles ya tiene sus estilos.

Cada paso deja el proyecto compilando y es commiteable por separado, con la convención del repo:
`feat(spec7): pasoN <descripción en español>`.

1. **Assets y tablas de datos.** Copiar `spritesheet-breakout.png`, `ball-bounce.mp3` y
   `break-sound.mp3` a `public/games/bloque-buster/` (los dos MP3 bajo `sounds/`). Crear
   `components/games/arkanoid-assets.ts` con `SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`,
   los 5 `LEVELS` como tabla ya resuelta, el cargador del spritesheet (que devuelve el canvas
   offscreen y acepta cancelación) y el constructor del pool de sonido. Sin estado mutable a nivel
   de módulo. **Prueba:** los tres assets se sirven en `/games/bloque-buster/…` con el dev server y
   `npm run build` pasa.

2. **Esqueleto del componente y registro.** Crear `components/games/ArkanoidGame.tsx` como Client
   Component: `<canvas className="game-canvas" width={800} height={600}>`, `propsRef` refrescado
   por un efecto sin array de dependencias, `apiRef` + `useImperativeHandle`, y un único
   `useEffect(…, [])` dueño del `ctx`, la carga del spritesheet con flag `cancelado`, el loop
   `requestAnimationFrame` con `dt` en segundos capado a `MAX_DT`, y el cleanup que anula `apiRef`,
   cancela el frame y quita listeners. De momento pinta "CARGANDO…" y luego solo fondo negro.
   Registrar `"bloque-buster": { Component: ArkanoidGame, hasLives: true, fitHeight: false }` en
   `GAME_ENGINES`. **Prueba:** `/games/bloque-buster/play` muestra un canvas negro a pantalla
   completa dentro del marco CRT en lugar de la arena decorativa, con el HUD de tres casillas; la
   puntuación deja de subir sola; la consola no tiene errores.

3. **Pala e input.** Estado de la pala centrada, `PADDLE_SPEED` con las flechas leídas como
   `e.code` en listeners de `window` con `preventDefault()`, y `mousemove` sobre el canvas con el
   escalado por `getBoundingClientRect` (el canvas está estirado por CSS, sin él la pala no sigue
   al cursor). Clamp a `[0, W − paddle.w]`. Dibujar el sprite `paddle`. **Prueba:** la pala sigue
   al ratón y se mueve con `←` / `→`, no se sale por ningún borde, y la página no hace scroll al
   pulsar las flechas.

4. **Pelota y rebotes.** Posición inicial sobre la pala, velocidad `BASE_BALL_VX` / `BASE_BALL_VY`
   escalada por la `speed` del nivel, integración por `dt`, rebote contra las paredes izquierda,
   derecha y superior con reposicionamiento, y rebote contra la pala con la ventana de tolerancia
   de 8 px del original. Dibujar el sprite `ball`. **Prueba:** la pelota sale de la pala, rebota en
   los tres muros sin quedarse pegada, y la pala la devuelve; por abajo se pierde y sale del canvas.

5. **Bloques y colisión.** Cargar el nivel 1 desde `LEVELS` situando cada bloque en
   `BLOCKS_ORIGIN_X/Y`, dibujarlos con `drawSprite('block_' + color)`, y la colisión AABB del
   original: marca el bloque como muerto, suma 10 puntos, invierte `vy` y **corta el bucle**
   (un bloque por frame). **Prueba:** el nivel 1 muestra la parrilla 10×6 coloreada por filas; cada
   impacto borra un bloque y la puntuación sube de 10 en 10.

6. **Explosiones.** Al romper un bloque, encolar una explosión con su color y geometría; acumular
   `elapsed += dt * 1000`; filtrar las que superan `EXPLOSION_DURATION`; dibujarlas con `drawFrame`
   escogiendo el frame por `elapsed / EXPLOSION_DURATION`. **Prueba:** romper un bloque reproduce
   una animación de 4 frames en su hueco y desaparece a los 150 ms sin dejar residuo.

7. **Vidas y progresión de nivel.** Perder la pelota por abajo descuenta una vida y la repone sobre
   la pala; a 0 vidas, `phase = "gameover"`. Limpiar todos los bloques carga el nivel siguiente con
   su multiplicador de velocidad; limpiar el **nivel 5** también lleva a `phase = "gameover"`, no a
   una fase de victoria. **Prueba:** perder tres pelotas termina la partida; limpiar el nivel 1 hace
   aparecer la pirámide del nivel 2 con la pelota visiblemente más rápida, conservando puntuación y
   vidas.

8. **Sonido.** Crear los dos pools en el efecto y dispararlos en los rebotes (muro y pala) y al
   romper un bloque, con volumen fijo; liberarlos en el cleanup; tragar en silencio el rechazo de
   la política de autoplay. **Prueba:** se oye el rebote y la rotura, no se acumulan elementos
   `Audio` en el DOM, y salir de la partida corta el sonido.

9. **Sincronización con React.** Caché `emitido = { score: -1, lives: -1, level: -1 }` para invocar
   `onScoreChange`, `onLivesChange` y `onLevelChange` **solo** cuando el valor cambia, nunca por
   frame. `onGameOver(score)` al entrar en `phase = "gameover"`, con un flag `gameOverEmitido` para
   no repetirlo. **Prueba:** el HUD muestra puntuación, vidas y nivel reales en vivo; perder las
   tres vidas abre el modal "FIN DEL JUEGO" con la puntuación correcta, sin overlay dentro del
   canvas; limpiar el nivel 5 abre el mismo modal.

10. **Botones del HUD.** `paused` deja de invocar `update(dt)` pero se sigue dibujando, así que el
    último frame queda estático con la pelota en el aire. `forceGameOver()` pone `lives = 1` y
    fuerza la pérdida de la pelota, recorriendo el mismo camino que perder la última vida.
    `restart()` —función nueva, el original no la tiene— recrea el estado completo: puntuación 0,
    3 vidas, nivel 1, bloques repuestos, explosiones vacías, pala centrada, pelota sobre la pala,
    `emitido` a `-1`, `gameOverEmitido` abajo y el mapa de teclas limpiado. **Prueba:** PAUSA
    congela la pelota en el aire y REANUDAR la continúa desde el mismo punto y dirección; FIN abre
    el modal con la puntuación acumulada; JUGAR DE NUEVO arranca en el nivel 1 con 0 puntos y 3
    vidas, sin heredar una flecha que estuviera pulsada durante el modal.

11. **Ranking real de extremo a extremo** (habilitado por el paso 2, sin código nuevo): guardar una
    puntuación desde el modal, comprobar la fila con el MCP de Supabase, y ver la pestaña
    **BLOQUE BUSTER** en `/leaderboard` con su podio y su estado vacío propio, más "Mejor global"
    real en `/games/bloque-buster`. **Prueba:** existe una fila en `public.scores` con
    `game_id = 'bloque-buster'`; el salón la lista bajo su pestaña; ROCAS y CAÍDA conservan las
    suyas intactas.

12. **Bloque de controles.** Rellenar el campo `controls` de la entrada `bloque-buster` en
    `lib/games.ts` con las dos filas (ratón y flechas). No se toca `app/games/[id]/page.tsx`: ya
    renderiza el bloque cuando el juego declara `controls`. **Prueba:** `/games/bloque-buster`
    muestra el bloque de instrucciones con sus dos filas; `/games/caida` conserva las suyas; los 6
    juegos sin `controls` siguen sin bloque y con su layout de dos columnas.

13. **Cierre.** `npm run lint` y `npm run build` sin errores, y prueba end-to-end con el
    **Playwright MCP** en `/games/bloque-buster/play`: jugar una partida, pausar, reanudar,
    terminar con FIN, guardar la puntuación, verla en `/leaderboard`, y comprobar que
    `/games/rocas/play` y `/games/caida/play` no han sufrido regresiones. Verificar en dev que
    StrictMode no duplica el loop: la pelota no va al doble de velocidad, una pulsación de `←` no
    mueve la pala el doble y cada rebote suena una sola vez.

## Acceptance criteria

**Base**

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] `/games/bloque-buster/play` renderiza un `<canvas>` real de 800×600 dentro del marco CRT, en
      lugar de la arena decorativa.
- [ ] El canvas llena el marco sin franjas y sin deformación: un bloque mide en pantalla 64×24
      escalados, no un rectángulo de otra proporción.
- [ ] El HUD superior muestra las tres casillas —Puntuación, Vidas y Nivel— con datos reales.
- [ ] La puntuación no sube sola cuando el jugador no toca nada.
- [ ] Dentro del canvas no se dibuja puntuación, ni nivel, ni las pelotas de vidas: esos tres datos
      aparecen una sola vez, en el HUD de React.
- [ ] Mientras carga el spritesheet, el canvas muestra fondo negro con el rótulo "CARGANDO…", y el
      juego arranca cuando la imagen resuelve.
- [ ] Salir de la partida antes de que el spritesheet cargue no deja ningún `requestAnimationFrame`
      corriendo ni lanza errores en consola.

**Controles**

- [ ] Mover el ratón sobre el canvas mueve la pala siguiendo el cursor, con el canvas escalado por
      CSS a cualquier ancho de ventana.
- [ ] `←` y `→` mueven la pala a `PADDLE_SPEED`.
- [ ] La pala nunca sale del canvas por ninguno de los dos bordes.
- [ ] Las flechas no provocan scroll de la página mientras se juega.
- [ ] **Pulsar `P`, `p` o `Escape` durante la partida no hace absolutamente nada:** el juego sigue
      corriendo y no aparece overlay alguno. El único modo de pausar es el botón "PAUSA" del HUD.
- [ ] Hacer clic sobre el canvas no hace nada: no existe el selector de nivel de 5 botones del
      original, ni por clic ni por ninguna otra vía.

**Juego**

- [ ] La pelota rebota en las paredes izquierda, derecha y superior sin quedarse pegada a ninguna.
- [ ] La pala devuelve la pelota cuando la intercepta; si no, la pelota se pierde por abajo.
- [ ] Golpear un bloque lo destruye, suma 10 puntos e invierte la dirección vertical de la pelota.
- [ ] Un mismo frame destruye como máximo un bloque.
- [ ] Al destruir un bloque se reproduce la animación de explosión de 4 frames de su color, que
      desaparece a los 150 ms.
- [ ] Perder la pelota descuenta una vida y la repone sobre la pala; el HUD refleja la vida perdida.
- [ ] Limpiar todos los bloques carga el nivel siguiente conservando puntuación y vidas, con su
      patrón propio y la pelota más rápida según el multiplicador de la tabla (×1.00, ×1.10, ×1.21,
      ×1.33, ×1.46).
- [ ] Los 5 niveles muestran sus patrones correctos: parrilla completa, pirámide, tablero de
      ajedrez, filas con huecos y marco con cruz central.
- [ ] Se oye el sonido de rebote al chocar contra muro o pala, y el de rotura al destruir un bloque.
- [ ] El audio no acumula elementos `Audio` nuevos por evento, y salir de la partida corta el sonido.
- [ ] Si el navegador bloquea la reproducción por su política de autoplay, el juego sigue
      funcionando sin errores en consola.
- [ ] Volver a la pestaña tras dejarla en segundo plano no hace que la pelota atraviese la pala ni
      varios bloques de golpe.

**Fin de partida y botones del HUD**

- [ ] Perder la última vida abre el modal "FIN DEL JUEGO" con la puntuación real, sin overlay
      "GAME OVER" dibujado en el canvas.
- [ ] Limpiar el nivel 5 abre el **mismo** modal con la puntuación final, sin el mensaje
      "¡Completaste el juego!" del original y sin fase de victoria distinta.
- [ ] "PAUSA" congela la pelota en el aire dejando el último frame visible; "REANUDAR" la continúa
      desde la misma posición y dirección, sin saltos.
- [ ] Con el juego en pausa, el canvas no muestra el overlay "PAUSA" del original ni su selector de
      nivel.
- [ ] "FIN" abre el modal con la puntuación acumulada hasta ese momento.
- [ ] "JUGAR DE NUEVO" arranca una partida limpia: nivel 1, 0 puntos, 3 vidas, bloques repuestos y
      pala centrada.
- [ ] Ninguna tecla que estuviera pulsada durante el modal sigue teniendo efecto tras "JUGAR DE
      NUEVO".
- [ ] "SALIR" navega a `/games/bloque-buster` y al desmontar se cancela el `requestAnimationFrame`
      y se quitan los listeners de teclado y de ratón.
- [ ] En desarrollo con StrictMode la pelota no va al doble de velocidad, una pulsación de `←` no
      mueve la pala el doble y cada rebote suena una sola vez.

**Ranking e instrucciones**

- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en `public.scores` con `game_id = 'bloque-buster'`, el
      nombre y la puntuación, verificable con el MCP de Supabase.
- [ ] Esa marca aparece en `/leaderboard` bajo la pestaña BLOQUE BUSTER y **no** bajo las de ROCAS
      o CAÍDA.
- [ ] `/leaderboard` muestra **tres** pestañas seleccionables —ROCAS, CAÍDA y BLOQUE BUSTER— y las
      otras 5 atenuadas con "PRÓXIMAMENTE".
- [ ] Con la pestaña BLOQUE BUSTER y sin marcas, el bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL
      PRIMERO" enlaza a `/games/bloque-buster/play`.
- [ ] El "Mejor global" de `/games/bloque-buster` muestra la puntuación real más alta, o `———` si
      no hay ninguna, en lugar del `best` decorativo.
- [ ] `/games/bloque-buster` muestra el bloque de instrucciones con sus dos filas de controles.
- [ ] Todo el texto nuevo de cara al usuario está en español y los números usan `es-ES`.

**No regresión**

- [ ] `/games/rocas/play` conserva su comportamiento completo: nave, HUD de tres casillas, PAUSA,
      FIN, JUGAR DE NUEVO y guardado al ranking real.
- [ ] `/games/caida/play` conserva el suyo: tablero 300×600 centrado, HUD sin casilla "Vidas" y
      guardado al ranking real.
- [ ] Los 5 juegos sin motor (p. ej. `/games/serpentina/play`) siguen mostrando la arena
      decorativa, su simulador de puntuación falso y su guardado a `av_scores` de `localStorage`.
- [ ] Los 5 juegos sin motor siguen mostrando su `best` decorativo en el `stat-strip`.
- [ ] Los 6 juegos sin `controls` no muestran bloque de instrucciones y conservan su layout de dos
      columnas.

## Decisions

**Heredadas de SPEC 04 y SPEC 06, confirmadas para este juego**

- **Sí:** el estado del juego vive en refs mutables y se dibuja por `requestAnimationFrame`, no en
  estado de React. Re-renderizar a 60 fps es inviable; React solo recibe cambios discretos.
- **Sí:** los callbacks al HUD se emiten solo cuando el valor cambia respecto al último emitido,
  nunca por frame. El `-1` inicial de la caché fuerza la primera emisión.
- **Sí:** un solo HUD, el de React. No se porta el bloque de `draw()` que pinta puntuación, nivel y
  las pelotas de vidas dentro del canvas.
- **Sí:** un solo flujo de fin de partida, el modal de `GamePlayer`. Se eliminan `drawOverlay()` y
  sus dos mensajes.
- **Sí:** "PAUSA" congela de verdad el loop —deja de invocarse `update(dt)` y el último frame queda
  estático— en vez de superponer un overlay decorativo.
- **Sí:** "FIN" recorre el mismo camino que perder: `forceGameOver()` pone `lives = 1` y fuerza la
  pérdida de la pelota. Un solo final, no dos.
- **Sí:** listeners de teclado en `window`, montados y desmontados con el componente, con
  `preventDefault()` en las teclas del juego.
- **Sí:** todo el estado se crea dentro del efecto. A nivel de módulo solo quedan constantes y
  funciones puras, para que dos montajes no compartan mundo.
- **No:** tests automatizados. El proyecto sigue sin test runner; la verificación es manual más
  Playwright MCP.

**Propias de este spec**

- **No:** Bloque A de generalización. SPEC 06 ya creó `components/games/registry.ts` y quitó las
  cuatro comparaciones contra `"rocas"`. Añadir este juego es una línea en `GAME_ENGINES`; repetir
  el refactor no tendría objeto.
- **No:** migración de Supabase. La fila `bloque-buster` ya existe en `public.games` desde la
  semilla de SPEC 05, así que la clave foránea de `scores` está satisfecha desde el primer `POST`.
- **Sí:** reutilizar el slot `bloque-buster` en vez de crear un `Game` nuevo. Su ficha ya describe
  Arkanoid literalmente —"una nave-paleta", "muros de bloques cromáticos", categoría ARCADE, portada
  `.cover-bricks`— y reutilizarla evita tocar la biblioteca, la portada y la base de datos. Mismo
  criterio que SPEC 04 con `rocas` y SPEC 06 con `caida`.
- **Sí:** canvas 800×600 estirado al marco completo, `fitHeight: false`. Es el 4:3 exacto de
  `.crt-screen`, así que no hay deformación y toda la matemática de posiciones, rebotes y colisiones
  del original sigue siendo válida en píxeles internos. Es el único de los tres juegos portados que
  encaja sin trucos: CAÍDA necesitó letterbox.
- **No:** reescalar el canvas a otra resolución. Obligaría a recalcular `BLOCK_W`, `BLOCK_H`, los
  orígenes de la parrilla, `PADDLE_SPEED` y las velocidades base, sin ganancia visible porque el CSS
  ya escala.
- **Sí:** mapeo directo del HUD —Puntuación = `score`, Vidas = `lives`, Nivel = `currentLevel`— con
  `hasLives: true`. Es el único de los tres motores que llena los tres huecos sin forzar nada.
- **No:** mostrar "Nivel 3/5" en el HUD. Obligaría a tocar `GamePlayer`, que pinta un número pelado
  para todos los motores, por una mejora cosmética.
- **Sí:** ratón **y** flechas. El `mousemove` es el control primario del original y Arkanoid se
  juega mucho mejor con él; las flechas garantizan que el juego sea jugable solo con teclado, como
  los otros dos motores. El `mousemove` aplica el escalado por `getBoundingClientRect` porque el
  canvas está estirado por CSS.
- **Sí:** normalizar el input de `e.key` a `e.code`, como el resto del proyecto.
- **No:** pausa por teclado. No se portan `P`, `p` ni `Escape`, ni se registra listener para ellas:
  el único modo de pausar es el botón "PAUSA" del HUD, igual que en ROCAS y CAÍDA. Dos mecanismos de
  pausa desincronizados —uno en el canvas y otro en React— es justo la clase de costura que este
  patrón existe para evitar.
- **No:** salto manual de nivel, en ninguna forma. Se eliminan los 5 botones dibujados del overlay
  de pausa, su listener de `click` y las constantes `PAUSE_BTN_*`, y no se sustituyen por teclas
  1–5 ni por un parámetro de URL. Con ranking real, poder empezar en el nivel 5 lo falsearía.
- **Sí:** portar el audio, con pool de elementos `Audio` y volumen fijo. Es el primer juego del
  sitio con sonido. El `cloneNode().play()` del original crea un elemento nuevo en cada rebote,
  decenas por partida; el pool reproduce por turno reiniciando `currentTime`. El rechazo por
  política de autoplay se traga en silencio: el juego no depende del audio.
- **No:** botón de silencio en el HUD. Tocaría la barra de acciones compartida de `GamePlayer` y
  afectaría también a ROCAS y CAÍDA; va en su propio spec si hace falta.
- **Sí:** limpiar el nivel 5 es fin de partida y abre el modal con la puntuación final. Desaparece
  la fase `"win"`: un solo camino de salida, y la puntuación queda acotada, que es coherente con un
  ranking sobre 5 niveles fijos.
- **No:** bucle infinito de niveles tras el 5. Habría que inventar una progresión de velocidad más
  allá de ×1.46 que el original no define, y convertiría el ranking en una prueba de resistencia sin
  techo.
- **Sí:** escribir `restart()` desde cero. El original **no tiene reinicio total**: `loadLevel()`
  repone bloques y pelota pero nunca resetea puntuación ni vidas, así que no hay nada que portar.
- **Sí:** portar la física tal cual, con sus asperezas: romper un bloque siempre invierte `vy` sin
  mirar por qué cara entró la pelota, y el rebote en la pala tampoco recalcula `vx`, así que el
  ángulo no cambia en toda la partida. Esto es un port, no un rediseño del juego; mejorarlo iría en
  su propio spec.
- **Sí:** `dt` en segundos, como el original, con un cap nuevo `MAX_DT = 0.05`. Todas las magnitudes
  del juego son píxeles por segundo; `EXPLOSION_DURATION` es el único valor en milisegundos y se
  sigue acumulando con `dt * 1000`. El cap no está en la fuente y hace falta: sin él, volver de una
  pestaña en segundo plano haría avanzar la pelota cientos de píxeles en un frame y atravesar la
  pala y los bloques.
- **Sí:** carga del spritesheet dentro del efecto, con rótulo "CARGANDO…" y flag `cancelado`. El
  original arranca el juego entero dentro del callback de `loadSpritesheet()` y guarda la imagen en
  globals de módulo; aquí el componente puede desmontarse antes de que el PNG resuelva, y en ese
  caso no debe arrancar ningún loop.
- **No:** arrancar el loop antes de que el spritesheet cargue. `drawSprite` no pintaría nada y la
  partida correría invisible unos frames: la pelota podría perderse antes de verse.
- **Sí:** partir el port en `ArkanoidGame.tsx` y `arkanoid-assets.ts`. El original ya son tres
  ficheros y unas 90 líneas son tablas de datos sin lógica; separarlas mantiene el componente en el
  orden de tamaño de `AsteroidsGame.tsx`.
- **Sí:** portar `LEVELS` como tabla ya resuelta en vez de como el IIFE que la genera. Los valores
  son idénticos, pero el resultado se lee de un vistazo y no queda lógica que mantener.
- **No:** añadir CSS a `app/globals.css` ni ejecutar `/frontend-design`. Este spec no añade ni
  reforma interfaz: el canvas es 4:3 y `.game-canvas` sirve tal cual, la portada `.cover-bricks` no
  se toca y el bloque de controles ya tiene sus estilos desde SPEC 06.

## Risks

| Riesgo                                                                                                                                                     | Mitigación                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Globals de módulo del original (`paddle`, `ball`, `blocks`, `lives`, `score`, `gameState`, `isPaused`, `ssImg`, `ssLoaded`) compartidos entre dos montajes | Todo el estado se crea dentro del efecto; a nivel de módulo solo quedan constantes y funciones puras. El cargador del spritesheet devuelve la imagen en vez de guardarla en un global                            |
| StrictMode monta el efecto dos veces en dev: dos loops, listeners duplicados y sonidos dobles                                                              | Cleanup que cancela el `rAF`, quita los listeners de teclado y de ratón y libera los pools de audio; verificación explícita en dev (paso 13)                                                                     |
| `dt` enorme al volver de una pestaña en segundo plano: la pelota atraviesa la pala y varios bloques                                                        | `MAX_DT = 0.05` — cap nuevo, el original no lo tiene                                                                                                                                                             |
| El componente se desmonta antes de que el spritesheet resuelva y el `onload` arranca un loop huérfano                                                      | Flag `cancelado` que el cleanup levanta; el `onload` comprueba el flag antes de hacer nada                                                                                                                       |
| Las rutas de assets del original son relativas (`assets/…`) y en Next no resuelven desde la ruta de la página                                              | Los tres ficheros van a `public/games/bloque-buster/` y se referencian con rutas absolutas desde el componente                                                                                                   |
| El `mousemove` no sigue al cursor porque el canvas está estirado por CSS                                                                                   | Se conserva el escalado por `getBoundingClientRect` del original, que es justo lo que corrige eso; verificar a varios anchos de ventana                                                                          |
| El navegador bloquea el audio por su política de autoplay y lanza una promesa rechazada                                                                    | El fallo se traga en silencio; el juego no depende del sonido y ningún criterio de aceptación lo condiciona                                                                                                      |
| `restart()` es código nuevo sin equivalente en el original: fácil dejar estado residual (explosiones, teclas pulsadas, velocidad del nivel anterior)       | El paso 10 enumera cada campo a resetear, y los criterios de aceptación comprueban nivel 1, 0 puntos, 3 vidas y que ninguna tecla pulsada durante el modal siga teniendo efecto                                  |
| A ×1.46 de velocidad en el nivel 5 la pelota podría atravesar un bloque entre dos frames, y el original solo resuelve una colisión por frame               | Es el comportamiento de la fuente y se porta tal cual; el cap de `dt` acota el caso patológico. Si aparece de forma reproducible en el paso 7, se anota para su propio spec en vez de rediseñar la colisión aquí |
| Copiar la carpeta `assets/` arrastra los `.DS_Store` que trae el repo de referencia                                                                        | Copiar los tres ficheros uno a uno, no el directorio                                                                                                                                                             |
| Tocar `GamePlayer`, `/leaderboard` o `/games/[id]` "ya que estamos" y romper ROCAS o CAÍDA                                                                 | El plan no incluye ningún paso que los toque; los criterios de no regresión cubren los dos motores existentes y los 5 juegos decorativos                                                                         |
| `next@16` / `react@19` posteriores a los datos de entrenamiento                                                                                            | Este spec no toca App Router; si aun así hiciera falta, leer `node_modules/next/dist/docs/01-app/` antes de escribir, como pide `AGENTS.md`                                                                      |
| La clave publicable viaja en el bundle: puntuaciones falsificables                                                                                         | Constraints de la tabla y validación del endpoint. Acotan, no impiden. Sin Auth no se cierra; limitación ya aceptada y documentada en SPEC 05                                                                    |

## Lo que **no** entra en este spec

Repetición deliberada de lo que el scope ya excluye, para que durante la implementación no haya
tentación de colarlo "ya que estamos":

- **Generalizar la plataforma.** Ya está hecho por SPEC 06. No se toca `components/GamePlayer.tsx`,
  `app/leaderboard/page.tsx` ni `app/games/[id]/page.tsx`.
- **Tocar la base de datos.** La fila `bloque-buster` ya existe en `public.games`. Sin migraciones.
- **Tocar `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` ni
  `app/games/[id]/play/page.tsx`.** Ya son genéricos por `game_id`.
- **CSS nuevo en `app/globals.css`**, y por tanto tampoco `/frontend-design`. El canvas es 4:3 y no
  necesita el modificador `.fit-height`; la portada `.cover-bricks` no se toca.
- **Cambiar la metadata de `bloque-buster`**: título, `cover`, `color`, `short`, `long`, `best` y
  `plays` se quedan como están. `best` deja de leerse en la página de detalle, pero el valor no se
  modifica.
- **Rellenar `controls` para los 6 juegos restantes.**
- **Corregir la física del original.** Nada de ángulo de rebote según el punto de impacto en la
  pala, ni detección de la cara de colisión del bloque. Se porta tal cual.
- **Pausa por teclado.** Ni `P`, ni `p`, ni `Escape`.
- **Salto manual de nivel**, en ninguna forma: ni los 5 botones dibujados del original, ni teclas
  1–5, ni parámetro de URL.
- **Bucle infinito de niveles** más allá del 5, niveles nuevos, power-ups, bloques de varios
  impactos, pala que se encoge y cualquier otra mecánica que la fuente no tenga.
- **Botón de silencio en el HUD.** El audio es fijo; un control de mute tocaría el chasis compartido.
- **Lógica real para los 6 juegos restantes.** Siguen con el simulador decorativo y con `av_scores`.
- **Controles táctiles en pantalla para móvil.**
- **Supabase Auth real**, rate limiting o firma de puntuaciones. El ranking sigue siendo de
  confianza.
- **Realtime en el salón de la fama**, paginación o histórico más allá del top 10.
- **Wiring de `next/font`** para la tipografía pixel.
- **Tests automatizados.**

Cada uno, si llega, va en su propio spec.

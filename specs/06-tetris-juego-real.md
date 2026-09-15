# SPEC 06 — Tetris real en el slot "CAÍDA"

> **Estado:** Aprovado
> **Depende de:** SPEC 01, SPEC 04, SPEC 05
> **Fecha:** 2026-09-14
> **Objetivo:** Portar el Tetris standalone de `references/started-games/03-tetris/game.js` a un componente cliente que reemplaza el simulador falso de `/games/caida/play` y conecta su puntuación al ranking real de Supabase, generalizando de paso la plataforma con un registro de juegos que sustituye los cuatro `game.id === "rocas"` hardcodeados de SPEC 04 y SPEC 05.

## Por qué este spec

SPEC 04 portó Asteroids al slot ROCAS y dejó escrito, a conciencia, que convertir `GamePlayer` en
un motor genérico sería sobre-ingeniería con un único juego real: *"cuando exista un segundo juego
real se extrae el patrón en su propio spec"*. SPEC 05 heredó esa decisión y añadió su propia
constante `ACTIVE_GAME_ID = "rocas"` en el salón de la fama y un `isRocas` en la página de detalle.

El resultado hoy son cuatro comprobaciones literales contra `"rocas"` repartidas por tres ficheros.
Con un segundo juego real esa forma deja de sostenerse: cada juego nuevo multiplicaría las
condiciones en vez de sumar una línea. Este spec paga esa deuda con un registro de motores y, sobre
él, añade el Tetris.

El juego de origen no es un Tetris estándar: tiene una octava pieza inventada (una "tuerca", un
anillo 3×3 que deja un hueco imposible al asentarse) y un tablero de 300×600 que no encaja en el
marco CRT 4:3 del sitio. Ambas cosas se resuelven aquí explícitamente, no sobre la marcha.

## Scope

**Incluye — Bloque A: generalización de la plataforma**

- Nuevo `components/games/registry.ts`, único sitio que declara qué juegos tienen motor real:
  una entrada por juego con su componente, su `hasLives` y el tipo del handle imperativo.
  Sustituye las cuatro comprobaciones `game.id === "rocas"` repartidas por el proyecto.
- `components/GamePlayer.tsx` deja de conocer juegos concretos y pasa a consultar el registry:
  - Renderiza el componente registrado para `game.id`; si no hay entrada, la arena decorativa.
  - Los dos efectos del simulador falso (el `setInterval` de puntuación cada 220 ms y el ratchet
    de nivel) se saltan para **cualquier** juego registrado, no solo para ROCAS.
  - `endGame()` llama a `forceGameOver()` del handle si el juego está registrado.
  - `submitScore()` hace `POST /api/scores` si el juego está registrado, y `saveScore` de
    `localStorage` si no.
  - El `.hud-stat` de "Vidas" no se renderiza cuando la entrada declara `hasLives: false`.
- `app/leaderboard/page.tsx`: las pestañas activas dejan de ser una constante. Toda entrada del
  registry es pestaña seleccionable; el resto sigue atenuado con "PRÓXIMAMENTE". Se añade estado
  de pestaña seleccionada (ROCAS por defecto) y el `GET /api/scores?game=` se relanza al cambiarla.
  `HallEmpty` recibe el juego seleccionado, de modo que su enlace y su rótulo dejan de ser
  `/games/rocas/play` / "JUGAR A ROCAS" fijos.
- `app/games/[id]/page.tsx`: `ROCAS_ID` / `isRocas` se sustituyen por la pertenencia al registry,
  que es lo que decide si "Mejor global" es la marca real o el `game.best` decorativo.

**Incluye — Bloque B: el juego**

- Nuevo componente cliente `components/games/TetrisGame.tsx` que porta íntegramente
  `references/started-games/03-tetris/game.js`: tablero `ROWS×COLS`, las **8** piezas (las 7
  estándar más la "tuerca" `PIECES[8]`), rotación horaria con wall kicks `[0,−1,+1,−2,+2]`,
  colisión, merge, limpieza de líneas, pieza fantasma al 20% de alfa, hard drop y soft drop
  con sus puntos, y la progresión `level = floor(lines/10)+1` con
  `dropInterval = max(100, 1000−(level−1)×90)`.
- El componente devuelve un único `<canvas width={300} height={600}>` y expone el contrato de
  SPEC 04 (`paused`, `onScoreChange`, `onLevelChange`, `onGameOver`, `restart`, `forceGameOver`).
  Al no tener vidas, no emite `onLivesChange`.
- `app/globals.css`: modificador de `.game-canvas` para que un canvas que no sea 4:3 se centre a
  altura completa dentro del marco CRT (`height:100%; width:auto; margin:0 auto`) en vez de
  estirarse a `inset:0`. Las franjas laterales son el fondo negro del propio marco.
- NEXT y LÍNEAS se dibujan **dentro** del canvas, superpuestos en la zona alta del tablero. El
  segundo canvas `#next-canvas` del original desaparece.
- `caida` escribe al ranking real: `POST /api/scores` con `game_id: "caida"`, pestaña **CAÍDA**
  activa en el salón de la fama y "Mejor global" real en `/games/caida`.
- `lib/games.ts`: campo **opcional** `controls` en el tipo `Game`, relleno solo para `caida`.
- `app/games/[id]/page.tsx` renderiza un bloque de instrucciones de juego únicamente cuando el
  juego tiene `controls`. `app/globals.css` gana los estilos de ese bloque.
- Se retiran del original: el HUD del DOM (`updateHUD`), el overlay `#overlay` compartido de
  PAUSA/GAME OVER, el botón `#restart-btn`, la tecla `P`, el toggle de tema con
  `localStorage['tetris-theme']` y la lectura de la variable CSS `--grid-line` desde
  `document.body`.

**Fuera de alcance (para specs futuros):**

- Lógica real para los 6 juegos restantes. Siguen con el simulador decorativo y con `av_scores`.
- Migración Supabase. `public.games` ya contiene la fila `caida` desde la semilla de SPEC 05;
  este spec no toca la base de datos.
- Tocar `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` ni
  `app/games/[id]/play/page.tsx`. Ya son genéricos por `game_id`.
- Modificar la portada `.cover-tetro` ni la metadata de `caida` (título, cover, color, `short`,
  `long`, `best`, `plays`). `best` deja de leerse en `/games/caida`, pero el valor no se toca.
- Rellenar `controls` para los otros 7 juegos.
- Mejoras de Tetris moderno que el original no tiene: pieza en reserva (hold), bolsa de 7,
  wall kicks SRS completos, T-spins, lock delay, repetición automática al mantener la tecla.
- Controles táctiles en pantalla para móvil.
- Supabase Auth real, rate limiting o firma de puntuaciones. El ranking sigue siendo de confianza,
  con la limitación ya documentada en SPEC 05.
- Realtime en el salón de la fama, paginación o histórico más allá del top 10.
- Wiring de `next/font` para la tipografía pixel.
- Tests automatizados.

## Data model

No se toca la base de datos: `public.games` ya contiene la fila `caida` desde la semilla de
SPEC 05, y `scores` es genérica por `game_id`. Tampoco se añaden claves nuevas de `localStorage`.
Los tipos nuevos viven en `components/games/registry.ts` y en `components/games/TetrisGame.tsx`;
el único cambio en `lib/` es un campo opcional en el tipo `Game`.

### El registry — `components/games/registry.ts`

Sustituye a las cuatro comprobaciones `game.id === "rocas"`. Es la generalización del contrato
que SPEC 04 definió para un solo juego.

```ts
export type GameEngineHandle = {
  restart: () => void;        // "JUGAR DE NUEVO" → partida nueva desde cero
  forceGameOver: () => void;  // botón "FIN" → fin inmediato con la puntuación actual
};

export type GameEngineProps = {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  onLivesChange?: (lives: number) => void; // opcional: solo juegos con vidas
  onGameOver: (finalScore: number) => void;
  ref?: Ref<GameEngineHandle>;
};

export type GameEngine = {
  Component: ComponentType<GameEngineProps>;
  hasLives: boolean;   // false → GamePlayer no renderiza el .hud-stat de "Vidas"
  fitHeight: boolean;  // true → el canvas no es 4:3 y se centra a altura completa
};

export const GAME_ENGINES: Record<string, GameEngine> = {
  rocas: { Component: AsteroidsGame, hasLives: true, fitHeight: false },
  caida: { Component: TetrisGame, hasLives: false, fitHeight: true },
};

export function getGameEngine(id: string): GameEngine | undefined;
```

`AsteroidsGameHandle` de SPEC 04 es estructuralmente idéntico a `GameEngineHandle`; se reexporta
como alias en vez de duplicarse. `AsteroidsGame` no cambia de comportamiento: solo pasa a
tipar sus props con `GameEngineProps`.

### Estado interno del juego — `components/games/TetrisGame.tsx`

Mutable, en un ref. Nunca en `useState`: el loop corre a ~60 fps.

```ts
type Piece = {
  type: number;       // 1–8, índice en PIECES y en COLORS
  shape: number[][];  // matriz cuadrada, 0 = vacío
  x: number;          // columna de la esquina superior izquierda
  y: number;          // fila
};

type GameState = {
  board: number[][];    // ROWS×COLS; 0 = vacío, 1–8 = índice de color
  current: Piece;
  next: Piece;
  score: number;
  lines: number;
  level: number;
  dropInterval: number; // ms hasta la siguiente bajada automática
  dropAccum: number;    // ms acumulados
  gameOver: boolean;
};
```

No hay campo `paused`: la pausa la manda la prop del mismo nombre, leída desde `propsRef` en el
loop, igual que en `AsteroidsGame`. Tampoco hay `lives`.

### Constantes portadas sin cambio de valor

`COLS = 10`, `ROWS = 20`, `BLOCK = 30` (de donde salen `W = 300` y `H = 600`),
`LINE_SCORES = [0, 100, 300, 500, 800]`, y los arrays `COLORS` y `PIECES` con sus **9** entradas
(índice `0` nulo, índices `1–8`: I, O, T, S, Z, J, L y la "tuerca"). `randomPiece()` sigue
sorteando en `1–8`.

Constantes nuevas, todas a nivel de módulo:

- `MAX_DT = 50` — cap del delta en milisegundos. El original no lo tiene; sin él, volver de una
  pestaña en segundo plano vaciaría `dropAccum` de golpe y bajaría la pieza varias filas.
- `GRID_LINE` — color de la cuadrícula, con el valor de `--line` del design system. Reemplaza el
  `getComputedStyle(document.body).getPropertyValue('--grid-line')` del original, que leía una
  variable que en este proyecto no existe.
- `NEXT_BLOCK = 14`, `PANEL_PAD = 6`, `PANEL_BG = "rgba(0,0,0,0.55)"` — el panel superpuesto.

### El panel superpuesto en el canvas

NEXT y LÍNEAS se dibujan dentro del canvas 300×600, sobre la zona alta del tablero, después del
tablero y antes de la pieza actual, de modo que una pieza cayendo pasa por encima del panel y no
al revés.

- **LÍNEAS**, arriba a la izquierda: rótulo y número sobre una caja `PANEL_BG` redondeada.
- **NEXT**, arriba a la derecha: rótulo y la pieza siguiente en una caja de 4×4 celdas de
  `NEXT_BLOCK` px, centrada con el mismo cálculo de offsets que `drawNext()` del original.

El texto usa una familia monoespaciada del sistema. `app/layout.tsx` no cablea `next/font`, así
que `--font-press-start-2p` no está disponible; cablearlo está fuera de alcance.

### `dt` en milisegundos, no en segundos

`porting.md` recomienda normalizar `dt` a segundos, pero aquí toda la cadencia del juego
(`dropInterval`, `dropAccum`) está en milisegundos y es la única magnitud temporal que existe: no
hay velocidades ni aceleraciones en píxeles por segundo. Convertir a segundos obligaría a
reescribir la progresión de nivel sin ganar nada. Se conserva en ms y se le añade el cap.

### Campo `controls` en `lib/games.ts`

```ts
export type GameControl = {
  keys: string[];  // p. ej. ["←", "→"] — glifos ya listos para pintar
  action: string;  // descripción en español
};

export type Game = {
  // …campos existentes, sin cambios…
  controls?: GameControl[]; // opcional: solo los juegos que lo declaren muestran el bloque
};
```

Relleno solo en la entrada `caida`:

| Teclas | Acción |
| --- | --- |
| `←` `→` | Mover la pieza de lado |
| `↑` `X` | Rotar en sentido horario |
| `↓` | Bajar una fila (+1 punto) |
| `Espacio` | Caída instantánea (+2 puntos por celda) |

La tecla `P` del original no aparece: la pausa es el botón PAUSA del HUD.

## Implementation plan

Dos bloques. El **A** generaliza la plataforma sin añadir juego alguno y deja el sitio idéntico a
como está hoy; el **B** añade el Tetris encima. Cada paso deja el proyecto funcionando y compilando.

Antes de escribir código de App Router en cualquier paso, leer la guía correspondiente en
`node_modules/next/dist/docs/01-app/`, como exige `AGENTS.md`.

### Bloque A — Generalización de la plataforma

1. Crear `components/games/registry.ts` con `GameEngineHandle`, `GameEngineProps`, `GameEngine`,
   `getGameEngine()` y una sola entrada: `rocas`. Refactorizar `components/GamePlayer.tsx` para
   que consulte el registry en lugar de `const isAsteroids = game.id === "rocas"`: render del
   componente registrado, salto de los dos efectos del simulador falso, `endGame()` vía
   `forceGameOver()` del handle, `submitScore()` por `POST /api/scores`, y ocultación del
   `.hud-stat` de "Vidas" cuando `hasLives` es `false`. `AsteroidsGame` pasa a tipar sus props
   con `GameEngineProps`. **Prueba:** `/games/rocas/play` se comporta exactamente igual que antes
   (nave, HUD con las tres casillas, PAUSA, FIN, guardar puntuación), y `/games/caida/play` sigue
   mostrando la arena decorativa con su simulador falso.
2. `app/leaderboard/page.tsx`: eliminar `ACTIVE_GAME_ID` / `ACTIVE_GAME_TITLE` y derivar las
   pestañas seleccionables del registry. Añadir estado de pestaña seleccionada (la primera
   registrada por defecto) que relanza `GET /api/scores?game=` al cambiar, y pasar el juego
   seleccionado a `HallEmpty` para que su enlace y su rótulo dejen de ser fijos. **Prueba:** con
   un único juego registrado, el salón se ve y se comporta igual que hoy: pestaña ROCAS activa,
   las otras 7 atenuadas con "PRÓXIMAMENTE".
3. `app/games/[id]/page.tsx`: sustituir `ROCAS_ID` / `isRocas` por la pertenencia al registry,
   que decide si "Mejor global" muestra la marca real o el `game.best` decorativo. **Prueba:**
   `/games/rocas` sigue mostrando su mejor marca real (o `———` si no hay ninguna) y `/games/caida`
   sigue mostrando su `best` decorativo.

### Bloque B — El juego

4. Crear `components/games/TetrisGame.tsx` como Client Component: `<canvas width={300}
   height={600}>`, `propsRef`, `apiRef`, un único `useEffect(…, [])` con el loop
   `requestAnimationFrame`, `dt` en ms capado a `MAX_DT` y cleanup que cancela el frame y quita
   los listeners. De momento solo pinta el fondo y la cuadrícula con `GRID_LINE`. Añadir el
   modificador de `.game-canvas` en `app/globals.css` para `fitHeight` y registrar `caida` en el
   registry. **Prueba:** `/games/caida/play` muestra la cuadrícula vacía centrada en el marco CRT,
   con franjas negras a los lados y sin deformación; el HUD ya no tiene casilla "Vidas" y la
   puntuación deja de subir sola; consola sin errores.
5. Portar `createBoard()`, `PIECES`, `COLORS`, `randomPiece()`, `drawBlock()` y el dibujo del
   tablero y de la pieza actual. `spawn()` toma `next` y sortea la siguiente. **Prueba:** al
   entrar aparece una pieza coloreada en la parte superior central del tablero, estática.
6. Portar `collide()`, `merge()`, `lockPiece()` y la gravedad del loop: acumular `dt` en
   `dropAccum` y bajar una fila al superar `dropInterval`. **Prueba:** la pieza baja sola una fila
   por segundo, se detiene al tocar el fondo o la pila y aparece una nueva.
7. Portar el input: listeners de `keydown` en `window` montados y desmontados con el efecto, con
   `e.code`. `←`/`→` mueven si no colisionan, `↑` y `X` llaman a `tryRotate()` con los kicks
   `[0,−1,+1,−2,+2]`, `↓` hace `softDrop()` (+1 punto) y `Espacio` hace `hardDrop()` (+2 por
   celda). `preventDefault()` en las cinco. No se porta `KeyP`. **Prueba:** la pieza se mueve,
   rota contra la pared sin salirse y cae de golpe con Espacio; la página no hace scroll al pulsar
   flechas ni espacio.
8. Portar `ghostY()` y el dibujo de la pieza fantasma al 20% de alfa, `clearLines()` con su
   puntuación `LINE_SCORES[cleared] × level`, y la progresión `level = floor(lines/10)+1` con
   `dropInterval = max(100, 1000−(level−1)×90)`. **Prueba:** la silueta translúcida marca dónde
   caerá la pieza; completar una fila la borra y hace bajar la pila; a las 10 líneas el nivel sube
   a 2 y las piezas caen visiblemente más rápido.
9. Dibujar el panel superpuesto: LÍNEAS arriba a la izquierda y NEXT arriba a la derecha, sobre
   cajas `PANEL_BG`, después del tablero y **antes** de la pieza actual. **Prueba:** se ve la
   pieza siguiente y el contador de líneas dentro del canvas; cuando la pila llega arriba, la
   pieza que cae se dibuja por encima del panel y sigue siendo visible.
10. Sincronizar con React: caché `emitido = { score: -1, level: -1 }` para emitir `onScoreChange`
    y `onLevelChange` solo cuando el valor cambia, nunca por frame. `spawn()` invoca
    `onGameOver(score)` cuando la pieza nueva colisiona al entrar, con un flag `gameOverEmitido`
    para no repetirlo. No se emite `onLivesChange`. **Prueba:** el HUD muestra puntuación y nivel
    reales en vivo; llenar el tablero hasta arriba abre el modal "FIN DEL JUEGO" con la puntuación
    correcta, sin overlay propio dentro del canvas.
11. Conectar los botones del HUD: `paused` deja de invocar la actualización pero se sigue
    dibujando (el último frame queda estático); `forceGameOver()` recorre el mismo camino que
    llenar el tablero; `restart()` recrea el estado, resetea `emitido` a `-1`, baja
    `gameOverEmitido` y limpia el input. **Prueba:** PAUSA congela la pieza en el aire y REANUDAR
    la continúa desde la misma posición; FIN abre el modal con la puntuación acumulada; JUGAR DE
    NUEVO arranca con tablero vacío, 0 puntos, 0 líneas y nivel 1, sin heredar teclas pulsadas.
12. Verificar el ranking real de `caida` de extremo a extremo (ya habilitado por los pasos 1 y 4,
    sin código nuevo): guardar una puntuación desde el modal, comprobar la fila en Supabase con el
    MCP, y ver la pestaña **CAÍDA** activa en `/leaderboard` con su podio, su estado vacío propio
    y "Mejor global" real en `/games/caida`. **Prueba:** la fila existe en `public.scores` con
    `game_id = 'caida'`; el salón la lista bajo su pestaña y ROCAS conserva la suya intacta.
13. Añadir el campo `controls` al tipo `Game`, rellenarlo en la entrada `caida` y renderizar el
    bloque de instrucciones en `app/games/[id]/page.tsx` solo cuando el juego lo declara, con sus
    estilos en `app/globals.css` siguiendo el sistema neón existente. Ejecutar la skill
    `/frontend-design` para el diseño del bloque, como exige `CLAUDE.md`. **Prueba:**
    `/games/caida` muestra las cuatro filas de controles; los otros 7 juegos no muestran el bloque
    y conservan su layout de dos columnas.
14. Cierre: `npm run lint` y `npm run build` sin errores, y prueba end-to-end con el Playwright MCP
    en `/games/caida/play` (jugar una partida, pausar, reanudar, terminar con FIN, guardar la
    puntuación, verla en `/leaderboard` y comprobar que `/games/rocas/play` no ha sufrido
    regresiones). Verificar en dev que StrictMode no duplica el loop: la pieza no cae al doble de
    velocidad ni una pulsación mueve dos casillas.

## Acceptance criteria

**Plataforma (Bloque A)**

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] No queda ninguna comparación literal con `"rocas"` en `components/GamePlayer.tsx`,
      `app/leaderboard/page.tsx` ni `app/games/[id]/page.tsx`.
- [ ] `/games/rocas/play` conserva su comportamiento completo: nave, HUD con las tres casillas
      (Puntuación, Vidas, Nivel), PAUSA, FIN, JUGAR DE NUEVO y guardado al ranking real.
- [ ] Los 6 juegos sin motor (p. ej. `/games/serpentina/play`) siguen mostrando la arena
      decorativa, su simulador de puntuación falso y su guardado a `av_scores` de `localStorage`.
- [ ] `/leaderboard` muestra **dos** pestañas seleccionables, ROCAS y CAÍDA, y las otras 6
      atenuadas con "PRÓXIMAMENTE".
- [ ] Cambiar de pestaña recarga el ranking de ese juego y el podio y la tabla se corresponden con
      el juego seleccionado.
- [ ] Con la pestaña de un juego sin marcas, el bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL
      PRIMERO" enlaza al `play` de **ese** juego, no siempre a `/games/rocas/play`.

**El juego (Bloque B)**

- [ ] `/games/caida/play` renderiza un `<canvas>` real de 300×600 en lugar de la arena decorativa.
- [ ] El canvas se muestra centrado y a altura completa dentro del marco CRT, con franjas negras a
      los lados y sin deformación: un bloque es cuadrado en pantalla, no un rectángulo.
- [ ] El HUD superior muestra solo Puntuación y Nivel; la casilla "Vidas" no se renderiza.
- [ ] La puntuación no sube sola cuando el jugador no toca nada.
- [ ] Las piezas caen solas y se apilan; al asentarse aparece la siguiente.
- [ ] Salen las 8 piezas, incluida la "tuerca" (anillo 3×3 gris), con la misma probabilidad que en
      el original.
- [ ] `←` y `→` mueven la pieza y no la dejan salirse del tablero ni atravesar la pila.
- [ ] `↑` y `X` rotan en sentido horario; una rotación contra la pared se desplaza hasta 2 celdas
      (wall kick) en lugar de fallar.
- [ ] `↓` baja una fila y suma 1 punto; `Espacio` hace caída instantánea y suma 2 puntos por celda
      recorrida.
- [ ] Las flechas y el Espacio no provocan scroll de la página mientras se juega.
- [ ] La tecla `P` no hace nada.
- [ ] La pieza fantasma translúcida marca la posición de aterrizaje y se actualiza al mover y rotar.
- [ ] Completar una fila la borra, hace bajar la pila y suma `LINE_SCORES[líneas] × nivel`
      (100, 300, 500 u 800 por 1, 2, 3 o 4 líneas).
- [ ] A las 10 líneas el nivel sube a 2 y la caída automática se acelera de forma perceptible.
- [ ] El panel dentro del canvas muestra el contador de LÍNEAS y la pieza NEXT, y la pieza actual
      se dibuja **por encima** del panel cuando la pila alcanza esa zona.
- [ ] Dentro del canvas no se dibuja ni puntuación ni nivel: esos dos datos aparecen una sola vez,
      en el HUD de React.
- [ ] Que una pieza nueva no quepa al entrar abre el modal "FIN DEL JUEGO" con la puntuación real,
      sin overlay propio del canvas.
- [ ] El canvas no muestra en ningún momento el overlay de PAUSA/GAME OVER del original ni su botón
      "Reiniciar", y no existe el toggle de tema.
- [ ] "PAUSA" congela la pieza en el aire dejando el último frame visible; "REANUDAR" continúa
      desde la misma posición sin saltos.
- [ ] "FIN" abre el modal con la puntuación acumulada hasta ese momento.
- [ ] "JUGAR DE NUEVO" arranca una partida limpia: tablero vacío, 0 puntos, 0 líneas, nivel 1, y
      ninguna tecla que estuviera pulsada durante el modal sigue teniendo efecto.
- [ ] "SALIR" navega a `/games/caida` y al desmontar se cancela el `requestAnimationFrame` y se
      quitan los listeners de teclado.
- [ ] En desarrollo con StrictMode la pieza no cae al doble de velocidad y una pulsación de `←`
      mueve una sola casilla.
- [ ] Volver a la pestaña tras dejarla en segundo plano no hace bajar la pieza varias filas de
      golpe.

**Ranking e instrucciones**

- [ ] "GUARDAR PUNTUACIÓN" en `/games/caida/play` inserta una fila en `public.scores` con
      `game_id = 'caida'`, el nombre y la puntuación, verificable por el MCP de Supabase.
- [ ] Esa marca aparece en `/leaderboard` bajo la pestaña CAÍDA y **no** bajo la de ROCAS.
- [ ] El "Mejor global" de `/games/caida` muestra la puntuación real más alta, o `———` si no hay
      ninguna, en lugar del `best` decorativo.
- [ ] Los 6 juegos sin motor siguen mostrando su `best` decorativo en el `stat-strip`.
- [ ] `/games/caida` muestra el bloque de instrucciones con las cuatro filas de controles.
- [ ] Los otros 7 juegos no muestran bloque de instrucciones y conservan su layout de dos columnas.
- [ ] Todo el texto nuevo de cara al usuario está en español y los números usan `es-ES`.

## Decisions

**Heredadas de SPEC 04, confirmadas para este juego**

- **Sí:** el estado del juego vive en refs mutables y se dibuja por `requestAnimationFrame`, no en
  estado de React. Re-renderizar a 60 fps es inviable; React solo recibe cambios discretos.
- **Sí:** los callbacks al HUD se emiten solo cuando el valor cambia respecto al último emitido.
- **Sí:** un solo HUD. No se porta `updateHUD()`; el HUD de React es la única fuente de puntuación
  y nivel.
- **Sí:** un solo flujo de fin de partida. Se eliminan el overlay `#overlay` del DOM y el botón
  `#restart-btn`; manda el modal de `GamePlayer`.
- **Sí:** "PAUSA" congela de verdad el loop; "FIN" recorre el mismo camino que perder; "JUGAR DE
  NUEVO" arranca una partida limpia.
- **Sí:** listeners de teclado en `window`, montados y desmontados con el componente, con
  `preventDefault()` en las teclas del juego.
- **No:** tests automatizados. El proyecto sigue sin test runner; la verificación es manual más
  Playwright MCP.

**Propias de este spec**

- **Sí:** introducir `components/games/registry.ts` ahora. SPEC 04 aplazó el motor genérico
  explícitamente "para cuando exista un segundo juego real"; con `caida` ese día llega, y mantener
  `game.id === "rocas"` obligaría a duplicar la condición en cuatro sitios.
- **No:** añadir un segundo `if` hardcodeado (`isTetris`). Sería la cuarta copia de un patrón que
  ya se sabe que no escala.
- **Sí:** reutilizar la entrada `caida` de `lib/games.ts`. Su ficha ya describe este juego
  ("Rótalas, encástralas y limpia líneas… la velocidad aumenta cada 10 líneas"), su portada
  `.cover-tetro` ya es de tetrominós y su fila ya está sembrada en `public.games`.
- **No:** crear un `Game` nuevo con `id: "tetris"`. Obligaría a portada nueva, migración de base de
  datos y dejaría el slot `caida` como decoración muerta.
- **Sí:** canvas de 300×600 centrado por CSS a altura completa, con las franjas laterales como
  fondo del marco CRT. Deja intacta toda la matemática del original (`collide`, `ghostY`, `BLOCK`)
  sin dibujar un solo píxel de relleno.
- **No:** letterbox dentro de un canvas 800×600 con el tablero centrado. Era la alternativa
  inicial; se descartó porque el juego acabaría dibujando y gestionando ~44% de superficie vacía.
- **No:** dar a `.crt-screen` un `aspect-ratio` propio por juego. Tocaría el CSS del chasis CRT
  compartido y dejaría el marco estrecho y muy alto en escritorio.
- **Sí:** `fitHeight` se declara en el registry, no en `lib/games.ts`. Es una propiedad del motor
  —la forma de su canvas—, no de la ficha del juego.
- **Sí:** NEXT y LÍNEAS se dibujan dentro del canvas, en la zona alta del tablero. Mantiene la
  forma que fijó SPEC 04: el componente devuelve un único `<canvas>` y el contrato no crece.
- **No:** un segundo `<canvas>` en React para la previsualización, ni mover "líneas" al HUD. Lo
  primero rompe la forma del componente; lo segundo exigía renombrar la casilla "Vidas" y dejaba
  el HUD diciendo cosas distintas según el juego.
- **Sí:** la pieza actual se dibuja por encima del panel. Cuando la pila llega arriba, lo que el
  jugador necesita ver es dónde encaja la pieza, no el contador.
- **Sí:** ocultar la casilla "Vidas" del HUD cuando el motor declara `hasLives: false`. Un dato
  permanentemente vacío es peor que un dato ausente.
- **Sí:** `onLivesChange` pasa a ser opcional en el contrato. Es el primer cambio al contrato de
  seis miembros de SPEC 04, y lo fuerza el primer juego sin vidas.
- **Sí:** portar la octava pieza, la "tuerca" (`PIECES[8]`), aunque no exista en ningún Tetris y
  deje un hueco imposible al asentarse. `game.js` es la fuente de verdad, igual que en SPEC 04 con
  el power-up "3x" que ni el README mencionaba.
- **Sí:** `caida` escribe al ranking real de Supabase. Tiene motor de verdad, así que su puntuación
  significa algo; es justo el criterio por el que los otros 6 quedaron fuera en SPEC 05.
- **Sí:** eliminar la tecla `P`. Una sola fuente de pausa, el botón del HUD, coherente con ROCAS.
- **No:** mantener `P` añadiendo una prop `onPauseToggle`. Ampliaría el contrato para sincronizar
  dos fuentes de un mismo estado.
- **Sí:** conservar `dt` en milisegundos en lugar de normalizarlo a segundos como recomienda
  `porting.md`. Toda la cadencia del juego (`dropInterval`, `dropAccum`) ya está en ms y no hay
  velocidades en píxeles por segundo; convertir obligaría a reescribir la progresión sin ganancia.
- **Sí:** añadir un cap `MAX_DT` de 50 ms que el original no tiene. Sin él, volver de una pestaña
  en segundo plano bajaría la pieza varias filas de golpe.
- **Sí:** sustituir la lectura de `--grid-line` desde `document.body` por una constante con el
  valor de `--line`. La variable del original no existe en este proyecto y leer del DOM ata el
  canvas al tema de la página.
- **Sí:** el campo `controls` es opcional en el tipo `Game` y solo se rellena para `caida`. Permite
  documentar cada juego a medida que gana motor real, sin inventar controles para los 6 que aún no
  se juegan de verdad.
- **No:** declarar los controles en el registry. Son texto de cara al usuario, del mismo tipo que
  `short` y `long`, y la página de detalle no debería depender del registro de motores para
  pintarlos.
- **No:** mejoras de Tetris moderno (hold, bolsa de 7, kicks SRS, T-spins, lock delay, repetición
  automática al mantener la tecla). Este spec porta el juego que existe, no lo rediseña.
- **No:** cablear `next/font` para la tipografía pixel del panel del canvas. El texto usa la
  monoespaciada del sistema, como el resto del sitio hoy; cablear las fuentes es su propio spec.
- **No:** controles táctiles para móvil. Sigue siendo una experiencia de teclado, como el resto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El Bloque A es un refactor de tres ficheros que hoy funcionan. Una regresión ahí rompe ROCAS, el salón de la fama y la página de detalle a la vez, y se descubriría mezclada con los fallos propios del port. | Los pasos 1–3 se completan y verifican **antes** de tocar nada del Tetris, contra el comportamiento actual como referencia, y van en commits separados. Con un solo juego registrado, el sitio debe verse y comportarse exactamente igual que hoy. |
| `game.js` usa globals de módulo (`board`, `current`, `score`, `paused`, `animId`, `ctx`, y las referencias a elementos del DOM). Portados tal cual, un remount los compartiría y corrompería. | Todo el estado y el contexto de canvas se crean **dentro** del efecto. A nivel de módulo solo quedan constantes (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`) y funciones puras (`rotateCW`, `collide` parametrizada por el tablero). |
| StrictMode monta y desmonta el efecto dos veces en desarrollo: sin cleanup correcto quedan dos loops de `requestAnimationFrame` y listeners duplicados, con las piezas cayendo al doble de velocidad y cada pulsación moviendo dos casillas. | El efecto es idempotente y su cleanup cancela el frame, anula `apiRef` y quita los listeners. Verificación explícita en dev en el paso 14. |
| El loop del original hace `if (gameOver) return`, que mata el `rAF`, y `togglePause()` lo cancela y lo relanza. La plataforma espera lo contrario: el loop no para nunca, en pausa se deja de actualizar pero se sigue dibujando, y tras el game over el canvas queda estático hasta `restart()`. Portar la estructura tal cual deja el canvas en negro o el juego muerto tras "JUGAR DE NUEVO". | El loop se reescribe con la forma de `AsteroidsGame`: un único `rAF` que corre siempre, con `if (!propsRef.current.paused && !g.gameOver) update(g, dt)` seguido de `draw(ctx, g)` incondicional. |
| `dt` se acumula en `dropAccum` contra `dropInterval`. Si en pausa se deja de actualizar `lastTime`, al reanudar llega un delta de varios segundos y la pieza baja de golpe todas las filas acumuladas — exactamente el salto que el original evitaba con `lastTime = performance.now()` en `togglePause()`. | `lastTime` se refresca en **cada** frame, también mientras `paused` es `true`; solo se salta la actualización del mundo. El cap `MAX_DT` cubre además el caso de la pestaña en segundo plano. |
| `.game-canvas` es una clase compartida con `AsteroidsGame`. Cambiar su regla base para centrar el canvas de Tetris deformaría el de ROCAS, cuyas colisiones siguen en coordenadas 800×600. | El centrado va en una clase **modificadora** aplicada solo cuando el motor declara `fitHeight: true`. La regla base de `.game-canvas` no se toca, y el paso 1 verifica ROCAS antes de que exista la modificadora. |
| El panel de NEXT y LÍNEAS ocupa la zona alta del tablero, justo donde aparecen las piezas y donde termina la pila en una partida larga. Puede tapar información en el momento más crítico. | El panel se dibuja antes que la pieza actual, de modo que la pieza siempre queda por encima, y sobre una caja semitransparente que mantiene legible el texto sin ocultar los bloques asentados. Criterio de aceptación explícito para el caso de pila alta. |
| El salón de la fama pasa de una constante de módulo a estado de pestaña con recarga. Un `useCallback`/`useEffect` con dependencias mal puestas provoca un bucle de peticiones a `/api/scores`. | `load` recibe el `gameId` como parámetro y el efecto depende solo de la pestaña seleccionada. Verificación en el paso 2 con la pestaña de red del navegador: una petición por cambio de pestaña, ni una más. Se conserva `cache: "no-store"` en toda lectura del ranking. |
| El proyecto pinea `next@16.2.11` / `react@19.2.4`, posteriores a los datos de entrenamiento: las convenciones de Client Components, `ref` como prop y efectos pueden diferir de Next 13–15 / React 18. | Antes de escribir código de App Router en cada paso, leer la guía correspondiente en `node_modules/next/dist/docs/01-app/`, como exige `AGENTS.md`. `AsteroidsGame` sirve de referencia ya validada en este mismo repo. |
| La clave foránea `scores.game_id → games.id` rechaza cualquier `id` que solo exista en `lib/games.ts`, y la validación `isKnownGame` del endpoint no lo detecta. | Comprobado con el MCP de Supabase: `public.games` contiene las 8 filas sembradas por `create_games_and_scores`, `caida` entre ellas. Este spec no necesita migración; el paso 12 lo confirma de extremo a extremo con una inserción real. |

## Lo que **no** entra en este spec

- Lógica real para los 6 juegos restantes de la biblioteca.
- Que esos 6 juegos escriban al ranking real: su puntuación la genera un `setInterval` falso.
- Migrar `/games` y `/games/[id]` a leer los juegos desde la tabla `games`. `lib/games.ts` sigue
  siendo la fuente de verdad de la UI.
- Cambios en la base de datos: ni migraciones, ni columnas, ni políticas RLS nuevas.
- Cambios en `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` o
  `app/games/[id]/play/page.tsx`.
- Retirar `saveScore` / `av_scores` de `lib/session.tsx`, que siguen siendo el destino de los 6
  juegos sin motor.
- Modificar la portada `.cover-tetro` ni la metadata de `caida`.
- Rellenar `controls` para los otros 7 juegos.
- Mejoras de Tetris moderno: pieza en reserva, bolsa de 7, wall kicks SRS completos, T-spins,
  lock delay, repetición automática al mantener la tecla pulsada.
- Controles táctiles en pantalla para móvil.
- Supabase Auth real, rate limiting, captcha o firma de puntuaciones.
- Realtime en el salón de la fama, paginación o histórico más allá del top 10.
- Cablear `next/font` para la tipografía pixel.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.

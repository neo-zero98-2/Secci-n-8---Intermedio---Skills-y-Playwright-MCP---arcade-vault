# Referencia de port — de `game.js` standalone a componente de Arcade Vault

Documento de apoyo de la skill `/spec-game`. No es texto para copiar en la spec: es lo que hay que
saber para redactarla sin inventar. La implementación real de referencia es
`components/games/AsteroidsGame.tsx` (640 líneas), producto de `specs/04-asteroids-juego-real.md`.

---

## 1. El contrato React↔canvas

Es lo único que cruza la frontera. Seis miembros, ni uno más:

```ts
export type <Nombre>GameHandle = {
  restart: () => void; // "JUGAR DE NUEVO" → partida nueva desde cero
  forceGameOver: () => void; // botón "FIN" → game over inmediato con la puntuación actual
};

type <Nombre>GameProps = {
  paused: boolean; // botón "PAUSA": congela el loop, el último frame queda estático
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  ref?: Ref<<Nombre>GameHandle>;
};

export default function <Nombre>Game({ ref, ...props }: <Nombre>GameProps) { … }
```

`ref` es **una prop normal**: React 19, sin `forwardRef`. El componente devuelve un único elemento:

```tsx
return <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />;
```

`.game-canvas` ya existe en `app/globals.css` (`position:absolute; inset:0; width/height:100%;
background:#000`) y `.crt-screen` que lo contiene es `aspect-ratio: 4 / 3`. La resolución interna se
fija en `width`/`height` y el CSS la escala: así toda la matemática de spawn, wrap y colisiones del
original sigue siendo válida en píxeles del canvas.

---

## 2. El esqueleto React

Cinco piezas, todas presentes en `AsteroidsGame.tsx`:

1. **`propsRef`** — las props viven en un ref refrescado por un `useEffect` sin array de
   dependencias. Sin esto, el efecto del loop dependería de la identidad de las props y **cada
   render de `GamePlayer` reiniciaría la partida**.

2. **`apiRef` + `useImperativeHandle`** — el efecto publica `{ restart, forceGameOver }` en
   `apiRef`; el `useImperativeHandle(ref, () => ({ restart: () => apiRef.current?.restart(), … }), [])`
   solo delega. Así el handle es estable y las acciones tienen acceso al estado del efecto.

3. **`gameRef`** — el mundo mutable (`GameState`). **Nunca `useState`**: el loop corre a ~60 fps y
   re-renderizar por frame es inviable.

4. **Un único `useEffect(…, [])`** dueño de todo: `ctx`, los mapas `keys`/`justPressed`, el helper
   `pressed(code)` de disparo por flanco, los listeners de `window`, el `rAF`, y el cleanup que
   anula `apiRef`, cancela el frame y quita los listeners.

5. **La caché `emitido`** — `{ score: -1, lives: -1, level: -1 }` más un flag `gameOverEmitido`. Los
   callbacks se invocan **solo cuando el valor cambia** respecto al último emitido, nunca por frame.
   El `-1` inicial fuerza una primera emisión que sincroniza el HUD con el estado real.

Forma del loop:

```ts
const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
lastTime = ts;
if (!propsRef.current.paused) update(g, dt, keys, pressed); // en pausa no se actualiza
draw(ctx, g); // pero sí se dibuja: el frame queda estático
```

`forceGameOver()` no inventa un camino nuevo: pone `g.lives = 1` y llama a `killShip(g)`, de modo
que el botón FIN recorre exactamente el mismo flujo que perder la última vida. `restart()` recrea el
estado, resetea `emitido` a `-1`, baja `gameOverEmitido` y **limpia el input** (sin eso, una tecla
pulsada durante el modal dispararía al reanudar).

---

## 3. Tabla de normalización de las fuentes conocidas

Los tres juegos de `references/started-games/` comparten el esqueleto "canvas vanilla, sin bundler,
`game.js` en la raíz, `requestAnimationFrame`", pero **no son uniformes**. Esto es lo que cambia:

| Eje            | 02-asteroids                                   | 03-tetris                                             | 04-arkanoid                                                |
| -------------- | ---------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Ficheros JS    | `game.js`                                      | `game.js`                                             | `game.js` + `levels.js` + `assets/spritesheet.js`          |
| Resolución     | `W=800 / H=600` en constantes                  | 300×600 derivado de `COLS*BLOCK`                      | 800×600, leído de `canvas.width`; `800` además hardcodeado |
| `dt`           | segundos, capado a `0.05`                      | **milisegundos** acumulados contra `dropInterval`     | segundos, **sin cap**                                      |
| El loop        | nunca para                                     | `if (gameOver) return` — mata el `rAF`                | nunca para; `if (!isPaused) update(dt)`                    |
| HUD            | canvas, en `drawHUD()`                         | **DOM**: `updateHUD()` escribe `#score/#lines/#level` | canvas, inlined dentro de `draw()`                         |
| Game over      | canvas, `drawOverlay()`                        | **DOM**: div `#overlay` con `.hidden`                 | canvas, `drawOverlay()` + pausa con botones dibujados      |
| Estado         | `state: 'playing'\|'dead'\|'gameover'`         | dos booleanos `paused` / `gameOver`                   | `gameState` + `isPaused` aparte                            |
| Input          | `keys` + `justPressed` + `pressed()`, `e.code` | switch de `keydown`, `e.code`                         | whitelist `keys`, **`e.key`** + `mousemove`/`click`        |
| Assets         | ninguno                                        | ninguno                                               | spritesheet PNG + 2 MP3                                    |
| Reinicio total | `initGame()`                                   | `init()`                                              | **no existe**: nunca resetea puntuación ni vidas           |
| Extras a tirar | —                                              | toggle de tema en `localStorage`                      | botones de nivel dibujados en el canvas de pausa           |

Cada carpeta tiene su propio `CLAUDE.md` con un resumen de arquitectura ya escrito: léelo primero,
ahorra la mitad del análisis.

**Lo que hay que normalizar en todos los casos:**

- `document.getElementById('canvas'|'board'|'game')` → `canvasRef`.
- Globals de módulo → estado creado **dentro** del efecto. Si quedan globals mutables a nivel de
  módulo, un remount los comparte y corrompe. Solo constantes y clases quedan fuera.
- `dt` a segundos con cap (`MAX_DT = 0.05`): evita el tunneling cuando la pestaña vuelve del blur.
- HUD interno fuera, sea canvas o DOM: el HUD de React es el único.
- Overlays de game over y reinicio con Espacio fuera: manda el modal de `GamePlayer`.
- `preventDefault()` en las teclas del juego, o las flechas y el espacio hacen scroll de la página.

---

## 4. Las costuras de la plataforma

**Lo que hay que tocar para añadir un juego:**

| Fichero                             | Qué                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `lib/games.ts`                      | Entrada `Game` nueva (o reutilizar una existente). El `id` es la clave natural: va en la URL y es la FK de `scores`.        |
| `app/globals.css`                   | Clase `.cover-<id>` con la portada (arte CSS puro, como las 8 existentes). Invoca `/frontend-design`, lo exige `CLAUDE.md`. |
| `public/games/<id>/`                | Assets, si los hay.                                                                                                         |
| `components/games/<Nombre>Game.tsx` | El port.                                                                                                                    |
| `components/games/registry.ts`      | Registrar el juego (ver Bloque A si el fichero aún no existe).                                                              |
| Supabase                            | Fila en `public.games` si el `id` es nuevo.                                                                                 |

**Lo que NO hay que tocar — ya son genéricos por `game_id`:**

- `app/api/scores/route.ts` — valida contra `GAMES` y consulta por `game_id`. Es el **único** sitio
  del proyecto que toca la tabla `scores`; mantenlo así.
- `lib/scores.ts` — solo tipos.
- `lib/supabase/*` — los tres clientes por runtime.
- `app/games/[id]/play/page.tsx` — 23 líneas, ya sirve cualquier `id` de `GAMES`.

**Los cuatro sitios con `"rocas"` hardcodeado** (el Bloque A los elimina):

1. `components/GamePlayer.tsx`: `const isAsteroids = game.id === "rocas"`, usado en el render, en
   `endGame()` y en `submitScore()`, más los dos efectos del simulador falso que se saltan para el
   juego real (el `setInterval` de puntuación cada 220 ms y el ratchet de nivel).
2. `app/leaderboard/page.tsx`: `ACTIVE_GAME_ID` / `ACTIVE_GAME_TITLE`.
3. `app/leaderboard/page.tsx`: `HallEmpty()` enlaza fijo a `/games/rocas/play`.
4. `app/games/[id]/page.tsx`: `ROCAS_ID` / `isRocas`, que decide si "Mejor global" es real o
   decorativo (`game.best`).

---

## 5. Clases CSS reutilizables

No hace falta CSS nuevo salvo la portada. Ya existen:

- `.game-canvas` — el canvas del juego, absoluto y a pantalla completa dentro del marco.
- `.crt` / `.crt-screen` (4:3, scanlines y viñeta) / `.crt-content` (el overlay de pausa) /
  `.crt-bottom`.
- `.player-hud` / `.hud-stat` (`.l`, `.v`, `.lives`, `.level`) / `.hud-actions`.
- `.modal-bd` / `.modal` (`.final`, `.final-label`, `.input-row`, `.actions`) / `.toast-saved` /
  `.spinner`.
- `.hall-empty` y `.hall-empty.compact` — el bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL PRIMERO".
- `.chip`, `.chip.active`, `.chip:disabled .soon` — las pestañas del salón con su "PRÓXIMAMENTE".
- `.podium` (`.solo`, `.duo`), `.podium-slot`, `.hall-table`, `.lb-row`.
- La familia `.cover-*` (`.cover-rocas`, `.cover-tetro`…) como referencia de estilo para la portada
  nueva.

Todo el texto de cara al usuario va en **español**; números y fechas con `es-ES`.

---

## 6. Trampas conocidas

- **La FK de `public.games`.** Un `id` que solo exista en `lib/games.ts` pasa la validación
  `isKnownGame` del endpoint y **falla en el insert**. La fila en `games` va antes del primer
  `POST`.
- **StrictMode monta el efecto dos veces en desarrollo.** Sin cleanup correcto quedan dos loops de
  `rAF` y listeners duplicados: el juego corre al doble de velocidad y cada pulsación dispara dos
  veces. Verificación explícita en dev.
- **`preventDefault` en flechas y espacio**, o la página hace scroll mientras se juega.
- **Los dos efectos del simulador falso** de `GamePlayer` hay que desactivarlos para el juego real,
  o la puntuación sube sola sin tocar nada.
- **`cache: "no-store"`** en toda lectura del ranking: una respuesta cacheada muestra marcas viejas
  justo después de guardar una nueva.
- **El ratio.** Si el contenedor no respeta la proporción del canvas, lo que ve el jugador deja de
  coincidir con las colisiones, que siguen en coordenadas internas.
- **Arranque asíncrono.** Si el juego espera a cargar assets, hay que decidir qué se dibuja mientras
  tanto y que el cleanup funcione si el componente se desmonta antes de que carguen.

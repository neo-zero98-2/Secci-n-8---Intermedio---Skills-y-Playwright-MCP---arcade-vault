# SPEC 04 — Juego real de Asteroids en el slot "ROCAS"

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-07
> **Objetivo:** Portar el juego Asteroids standalone de `references/started-games/02-asteroids/game.js` a un componente cliente de Next.js que reemplaza el simulador falso del juego "ROCAS" en `/games/rocas/play`, sincronizando su puntuación/vidas/nivel con el HUD, los botones de pausa/fin y el modal de fin de partida ya existentes en `GamePlayer`.

## Scope

**Incluye:**

- Nuevo componente cliente `components/games/AsteroidsGame.tsx` que porta íntegramente la lógica de `references/started-games/02-asteroids/game.js`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` (incluyendo el power-up de disparo triple "3x", su drop tras destruir asteroides y su spawn garantizado), sistema de wrap toroidal, partículas de explosión, niveles progresivos e invencibilidad temporal al reaparecer.
- El componente renderiza un `<canvas>` con resolución interna fija 800×600 (igual al original), escalado vía CSS para llenar `.crt-screen` (que ya tiene `aspect-ratio: 4/3`), dentro de `GamePlayer`.
- `components/GamePlayer.tsx`: cuando `game.id === "rocas"`, renderiza `<AsteroidsGame>` en vez del `.game-arena` decorativo/`setInterval` falso. Los otros 7 juegos siguen usando el simulador falso sin cambios.
- Sincronización de estado: `AsteroidsGame` expone callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) que alimentan el HUD superior de React (Puntuación/Vidas/Nivel) como única fuente visible; se elimina el dibujo interno de HUD (`drawHUD`) del canvas para evitar duplicados.
- El overlay interno "GAME OVER" y el auto-reinicio con Espacio de `game.js` se desactivan; el fin de partida lo controla exclusivamente el modal existente de `GamePlayer` (input de nombre, "GUARDAR PUNTUACIÓN", "JUGAR DE NUEVO", "VOLVER AL VAULT"), reutilizando `saveScore` de `useSession` sin cambios.
- Botón "PAUSA": congela el loop real (deja de invocarse `update(dt)`; el último frame queda dibujado y estático) y lo reanuda al despausar.
- Botón "FIN": fuerza game-over inmediato con la puntuación acumulada hasta ese momento (equivalente a perder la última vida), disparando el mismo flujo que llegar a 0 vidas.
- Botón "SALIR" y "JUGAR DE NUEVO": sin cambios de comportamiento (navegación/reset ya existentes), pero "JUGAR DE NUEVO" debe reiniciar también el estado interno de `AsteroidsGame` (nueva partida desde cero, `initGame()` equivalente).
- Captura de teclado (flechas + espacio) mediante listeners en `window`, activos solo mientras `AsteroidsGame` está montado (se agregan en mount, se remueven en unmount) y con `preventDefault()` para evitar scroll de página.

**Fuera de alcance (para specs futuros):**

- Convertir `GamePlayer` en un motor genérico/plug-in para múltiples juegos reales intercambiables. Solo "rocas" obtiene lógica real en este spec; los otros 7 siguen con el simulador falso.
- Controles táctiles en pantalla para móvil (rotar/propulsar/disparar). Este spec es solo teclado, como el resto del sitio.
- Agregar una entrada nueva a `GAMES` (`lib/games.ts`). Se reutiliza la entrada "rocas" existente sin tocar su metadata (título, cover, color, descripción, `best`, `plays`).
- Cambios a la pantalla de detalle (`/games/rocas`) o al leaderboard/salón de la fama — `av_scores` sigue siendo de solo escritura, igual que en SPEC 01.
- Tests automatizados.

## Data model

No se agrega ningún archivo ni tipo nuevo a `lib/`, ni claves nuevas de `localStorage` (se sigue usando `av_scores` vía `saveScore` de `useSession`, sin cambios de formato). Todos los tipos son locales a `components/games/AsteroidsGame.tsx`.

**Contrato del componente (lo único que cruza la frontera React ↔ canvas):**

```ts
type AsteroidsGameProps = {
  paused: boolean; // controlado por el botón PAUSA de GamePlayer
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

type AsteroidsGameHandle = {
  restart: () => void; // "JUGAR DE NUEVO" → partida nueva desde cero
  forceGameOver: () => void; // botón "FIN" → game-over inmediato con la puntuación actual
};
```

`GamePlayer` accede a `AsteroidsGameHandle` mediante un `ref` (`useImperativeHandle`).

**Estado interno del juego (mutable, en refs — nunca en `useState`):**

```ts
type GamePhase = "playing" | "dead" | "gameover";

type GameState = {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  phase: GamePhase; // renombrado desde `state` de game.js para no chocar con React
  deadTimer: number;
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
};
```

Clases portadas tal cual de `game.js`, cada una con `update(dt)`, `draw(ctx)` y flag `dead`: `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`.

Constantes portadas sin cambios de valor: `W = 800`, `H = 600`, `RADII = [0,16,30,50]`, `SPEEDS = [0,85,55,32]`, `POINTS = [0,100,50,20]`, `POWERUP_DROP_CHANCE = 0.15`, `POWERUP_DURATION = 5`, `POWERUP_TTL = 12`, `TRIPLE_SPREAD = 0.18`.

**Convenciones:**

- El estado del juego vive en refs mutables, no en estado de React: el loop corre a ~60fps y re-renderizar por frame sería inaceptable. React solo se entera vía callbacks, y solo cuando el valor **cambia** (comparación contra el último valor emitido), no en cada frame.
- `ctx` deja de ser un global de módulo: se pasa como argumento a los `draw(ctx)` o se guarda en un ref, para que el componente pueda montarse/desmontarse sin estado global colgando.

## Implementation plan

1. Crear `components/games/AsteroidsGame.tsx` como Client Component: `<canvas width={800} height={600}>` escalado por CSS para llenar `.crt-screen`, loop `requestAnimationFrame` con `dt` capado a 50ms, `cancelAnimationFrame` en unmount, dibujando por ahora solo el fondo negro. Conectarlo en `components/GamePlayer.tsx` bajo `game.id === "rocas"`, reemplazando el `.game-arena` decorativo. Prueba: `/games/rocas/play` muestra la pantalla negra dentro del marco CRT sin errores de consola, y `/games/caida/play` sigue mostrando la arena falsa intacta.
2. Portar la clase `Ship` y el input de teclado (flechas para rotar/propulsar, wrap toroidal, drag, llama del propulsor), con listeners agregados en mount y removidos en unmount, y `preventDefault()` en las teclas del juego. Prueba: la nave rota, acelera y se envuelve por los bordes; las flechas y el espacio no hacen scroll de la página.
3. Portar la clase `Bullet` y `tryShoot()` (cooldown de 0.2s, TTL 1.1s, wrap). Prueba: Espacio dispara balas desde la nariz de la nave y desaparecen solas al ~1.1s.
4. Portar la clase `Asteroid` (polígono irregular, rotación, radios/velocidades/puntos por tamaño), `spawnAsteroids()` con distancia segura al centro, la clase `Particle`, y la colisión bala↔asteroide con `split()`, suma de puntos y explosión. Prueba: al iniciar hay 4 asteroides grandes; dispararles los parte (grande→2 medianos→2 pequeños) y emite partículas.
5. Portar la colisión nave↔asteroide (con el factor `0.82`), vidas, invencibilidad de 3s con parpadeo, `killShip()`, la fase `dead` con `deadTimer` y el avance de nivel cuando no quedan asteroides (`3 + level` rocas nuevas). Prueba: chocar resta una vida y la nave reaparece parpadeando; limpiar la pantalla sube de nivel con más asteroides.
6. Portar la clase `PowerUp`: drop tras destruir asteroides (15% de probabilidad, garantizado a los 5 kills, uno por nivel), TTL de 12s con parpadeo final, recogida por colisión y disparo triple durante 5s. Prueba: aparece el rombo "3x", al recogerlo la nave dispara 3 balas en abanico durante 5 segundos.
7. Sincronizar con el HUD de React: emitir `onScoreChange`/`onLivesChange`/`onLevelChange` solo cuando el valor cambia respecto al último emitido; en `GamePlayer`, desactivar para `rocas` el `setInterval` de puntuación falsa y el ratchet de nivel; no portar `drawHUD()` al canvas. Prueba: el HUD superior muestra puntuación, vidas y nivel reales en vivo, y dentro del canvas no hay texto de HUD duplicado.
8. Fin de partida: al llegar a 0 vidas se invoca `onGameOver(finalScore)` sin dibujar overlay interno ni reiniciar con Espacio; `GamePlayer` abre su modal existente con la puntuación real. Prueba: perder las 3 vidas abre el modal "FIN DEL JUEGO" con la puntuación correcta, y "GUARDAR PUNTUACIÓN" escribe la entrada en `av_scores` de `localStorage`.
9. Conectar los botones del HUD: la prop `paused` congela `update(dt)` (el último frame queda estático) y lo reanuda; `forceGameOver()` expuesto por `useImperativeHandle` para el botón "FIN"; `restart()` para "JUGAR DE NUEVO". Prueba: PAUSA congela nave, asteroides y balas; FIN abre el modal con la puntuación acumulada; JUGAR DE NUEVO arranca una partida limpia (0 puntos, 3 vidas, nivel 1).
10. Cierre: `npm run lint` y `npm run build` sin errores; prueba end-to-end con Playwright MCP en `/games/rocas/play` (jugar, pausar, reanudar, terminar con FIN, guardar puntuación y verificar `av_scores`).

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] `/games/rocas/play` renderiza un `<canvas>` real dentro del marco CRT, en lugar de la arena decorativa (`.game-arena` con `.enemy`/`.player-ship`).
- [ ] Los otros 7 juegos (ej. `/games/caida/play`) siguen mostrando la arena decorativa y el simulador de puntuación falso, sin cambios de comportamiento.
- [ ] Las flechas ← y → rotan la nave; ↑ la propulsa mostrando la llama; la nave conserva inercia y se envuelve por los cuatro bordes.
- [ ] Las teclas de flecha y Espacio no provocan scroll de la página mientras se juega.
- [ ] Espacio dispara balas con cooldown (no se puede disparar en ráfaga continua por frame) y las balas desaparecen solas tras ~1.1s.
- [ ] Al iniciar la partida hay 4 asteroides grandes y ninguno aparece encima de la nave (zona segura al centro).
- [ ] Destruir un asteroide grande deja 2 medianos; destruir un mediano deja 2 pequeños; los pequeños no se parten.
- [ ] La puntuación suma 20 por asteroide grande, 50 por mediano y 100 por pequeño.
- [ ] Destruir un asteroide genera partículas de explosión que se desvanecen.
- [ ] Chocar con un asteroide resta una vida y la nave reaparece en el centro parpadeando, invulnerable ~3s.
- [ ] Quedarse sin asteroides sube de nivel y aparecen más asteroides que en el nivel anterior.
- [ ] Aparece el power-up "3x" tras destruir asteroides (garantizado a los 5 kills del nivel); recogerlo hace que la nave dispare 3 balas en abanico durante 5s.
- [ ] El HUD superior (Puntuación, Vidas, Nivel) refleja el estado real del juego en vivo y no avanza solo cuando el jugador no hace nada.
- [ ] Dentro del canvas no se dibuja HUD alguno (score/nivel/vidas) — la información aparece una sola vez, en el HUD de React.
- [ ] El botón "PAUSA" congela nave, asteroides, balas y partículas; "REANUDAR" continúa la partida desde el mismo estado.
- [ ] El botón "FIN" abre el modal de fin de partida con la puntuación acumulada hasta ese momento.
- [ ] Perder las 3 vidas abre el modal "FIN DEL JUEGO" con la puntuación real, sin que el canvas muestre su propio overlay "GAME OVER".
- [ ] Pulsar Espacio tras el game-over no reinicia la partida por su cuenta (el reinicio solo ocurre por "JUGAR DE NUEVO").
- [ ] "GUARDAR PUNTUACIÓN" en el modal escribe una entrada `{ game: "rocas", score, name, at }` en `av_scores` de `localStorage`.
- [ ] "JUGAR DE NUEVO" reinicia la partida completa: 0 puntos, 3 vidas, nivel 1, 4 asteroides nuevos.
- [ ] "SALIR" navega a `/games/rocas` y al desmontar el componente se cancela el `requestAnimationFrame` y se remueven los listeners de teclado (no quedan handlers activos ni el loop corriendo).

## Decisions

- **Sí:** reutilizar la entrada existente `rocas` de `lib/games.ts` en vez de agregar un juego nuevo. Su metadata ya describe Asteroids ("Pulveriza asteroides en gravedad cero", categoría SHOOTER); solo cambia su comportamiento al jugar, no su ficha.
- **No:** agregar una entrada nueva a `GAMES` ni modificar título, cover, color, `best` o `plays` de `rocas`.
- **Sí:** solo `rocas` obtiene lógica real; los otros 7 juegos siguen con el simulador decorativo de SPEC 01.
- **No:** convertir `GamePlayer` en un motor genérico plug-in para múltiples juegos reales. Sería sobre-ingeniería con un único juego real implementado; cuando exista un segundo juego real se extrae el patrón en su propio spec.
- **Sí:** el estado del juego vive en refs mutables y el canvas se dibuja por `requestAnimationFrame`, no en estado de React. Re-renderizar React a 60fps es inviable; React solo recibe cambios discretos vía callbacks.
- **Sí:** los callbacks al HUD se emiten solo cuando el valor cambia respecto al último emitido, no en cada frame. Evita re-renders innecesarios de `GamePlayer`.
- **Sí:** resolución interna fija de 800×600 escalada por CSS dentro de `.crt-screen` (que ya es `aspect-ratio: 4/3`). Mantiene intacta toda la matemática de spawn, wrap y colisiones del original; hacerla responsiva en píxeles reales obligaría a reescribirla.
- **Sí:** un solo HUD. El canvas no porta `drawHUD()`; el HUD superior de React (que ya existe con el diseño neón del prototipo) es la única fuente visible de puntuación/vidas/nivel.
- **Sí:** un solo flujo de fin de partida. Se desactivan el overlay "GAME OVER" interno y el reinicio con Espacio de `game.js`; manda el modal de `GamePlayer`, que además permite guardar la puntuación (algo que el juego standalone no hacía).
- **Sí:** el botón "FIN" fuerza game-over inmediato con la puntuación actual, aunque el Asteroids original no tenga "rendirse". Mantiene coherencia con el HUD compartido del resto de juegos.
- **Sí:** el botón "PAUSA" congela de verdad el loop (deja de invocarse `update(dt)`), a diferencia del simulador falso que solo superponía un overlay.
- **Sí:** portar el power-up de disparo triple ("3x") aunque el README del prototipo no lo mencione. El código de `game.js` es la fuente de verdad real y está más completo que su documentación.
- **No:** controles táctiles en pantalla para móvil en este spec. El juego queda como experiencia de teclado (desktop); si se necesita móvil, va en su propio spec.
- **Sí:** listeners de teclado en `window` montados/desmontados con el componente y con `preventDefault()` en las teclas del juego. Sin `preventDefault` las flechas y el espacio hacen scroll de la página durante la partida.
- **No:** leer `av_scores` para mostrar historial o alimentar el leaderboard. Sigue siendo de solo escritura, igual que en SPEC 01; conectarlo es otro spec.
- **No:** tests automatizados. El proyecto sigue sin test runner configurado; la verificación es manual + Playwright MCP, igual que SPEC 03.

## Risks

| Riesgo                                                                                                                                                                                                                                | Mitigación                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game.js` usa globals de módulo (`ctx`, `keys`, `ship`, `score`, `state`…). Portados tal cual a un módulo de React, dos instancias o un remount compartirían y corromperían ese estado                                                | Todo el estado y el contexto de canvas viven dentro del componente (refs creados en mount), sin variables mutables a nivel de módulo. Solo las constantes (`RADII`, `SPEEDS`, `POINTS`…) y las clases quedan a nivel de módulo. |
| StrictMode de React 19 monta y desmonta el efecto dos veces en desarrollo: sin cleanup correcto quedarían dos loops de `requestAnimationFrame` y listeners duplicados, con el juego corriendo al doble de velocidad y disparos dobles | El efecto es idempotente y su cleanup cancela el `requestAnimationFrame` y remueve los listeners de teclado. Verificación explícita en dev: la nave no acelera al doble y un pulso de Espacio dispara una sola bala.            |
| El proyecto pinea `next@16.2.11`/`react@19.2.4`, posteriores a los datos de entrenamiento: las convenciones de Client Components, refs y efectos pueden diferir de Next 13–15 / React 18                                              | Antes de escribir el componente durante `/spec-impl`, leer la guía correspondiente en `node_modules/next/dist/docs/01-app/`, tal como indica `AGENTS.md`.                                                                       |
| Con el modal de fin de partida abierto, los listeners de teclado siguen montados: el jugador podría seguir rotando o disparando "a ciegas" detrás del modal, o el Espacio podría interferir con el foco de los botones del modal      | Al entrar en fase `gameover` el loop deja de procesar input y de actualizar entidades; el canvas queda estático hasta `restart()`.                                                                                              |
| El canvas se escala por CSS: si el contenedor no respeta 4/3, la escena se deforma y lo que ve el jugador deja de coincidir con las colisiones (que siguen en coordenadas 800×600)                                                    | `.crt-screen` ya declara `aspect-ratio: 4 / 3` (mismo ratio que 800×600); el canvas se dimensiona al 100% de ese contenedor, sin `object-fit` ni estiramientos adicionales.                                                     |
| Cambiar de pestaña o minimizar congela `requestAnimationFrame`; al volver, un `dt` enorme teletransportaría asteroides a través de la nave sin detectar colisión (tunneling)                                                          | Se porta el cap de `dt` a 50ms del original, que ya evita el salto grande tras un blur prolongado.                                                                                                                              |

## What is **not** in this spec

- Motor genérico plug-in en `GamePlayer` para múltiples juegos reales intercambiables.
- Lógica real para los otros 7 juegos de la biblioteca.
- Controles táctiles en pantalla para móvil.
- Lectura de `av_scores` para el leaderboard, el salón de la fama o el historial del usuario.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.

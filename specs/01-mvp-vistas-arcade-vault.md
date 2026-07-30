# SPEC 01 — MVP de vistas de Arcade Vault

> **Estado:** Implementado
> **Depende de:** Ninguno (primer spec del proyecto)
> **Fecha:** 2026-07-27
> **Objetivo:** Portar las 5 vistas del prototipo estático de Arcade Vault (biblioteca, detalle, player simulado, login mock y salón de la fama) a rutas reales de Next.js App Router, con datos mock, diseño neón fiel al original y persistencia de sesión/puntajes en localStorage, sin backend ni lógica de juego real.

## Scope

**Incluye:**

- 5 rutas de Next.js App Router: `/` (biblioteca), `/games/[id]` (detalle), `/games/[id]/play` (player), `/login` (auth), `/leaderboard` (salón de la fama).
- `Nav` en el layout raíz: links desktop, menú hamburguesa mobile, contador de créditos decorativo, botón de sesión (login/logout).
- Footer fijo en el layout raíz (igual al del prototipo).
- Pantalla biblioteca: hero, buscador por texto, chips de categoría (`CATS`), grid de `GameCard`.
- Pantalla detalle: cover, tags, descripción, stat strip (partidas/mejor puntuación/dificultad), leaderboard lateral con puntuaciones seed, CTAs (jugar / volver).
- Pantalla player: HUD (puntuación/vidas/nivel), botones pausa/fin/salir, arena decorativa (CRT), simulador de puntuación (incremento aleatorio, igual al prototipo — sin mecánica de juego real), modal de fin de partida con formulario para guardar puntuación.
- Pantalla login: tabs iniciar sesión / crear cuenta, botón "jugar como invitado", botones sociales (Google/GitHub) decorativos sin funcionalidad real, mock de login (cualquier usuario entra sin validar contraseña).
- Pantalla salón de la fama: tabs por juego, podio top 3, tabla de posiciones, fila "tu mejor marca" si hay sesión iniciada.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a TypeScript en `lib/`, mismo contenido que el prototipo.
- Fuentes "Press Start 2P" y "JetBrains Mono" vía `next/font/google`, reemplazando Geist.
- `styles.css` portado casi textual a una hoja de estilos global nueva, importada desde el layout raíz.
- Sesión de usuario vía Context de React (cliente), respaldado por `localStorage` bajo la clave `av_user` (sin versionar).
- Guardado de puntuaciones en `localStorage` bajo la clave `av_scores` (sin versionar) — solo escritura, igual que el prototipo (no se lee para mostrarla en ningún lado).
- Componentes compartidos en `components/` en la raíz del proyecto (Nav, GameCard, filas de leaderboard, etc.).

**Fuera de alcance (para specs futuros):**

- Lógica o mecánica real de cualquiera de los 8 juegos (siguen simulados).
- Backend real, base de datos, autenticación real (validación de contraseña, OAuth real para Google/GitHub).
- Lectura/uso real de `av_scores` para mostrar historial de puntuaciones del usuario.
- Modo versus / multijugador local (Duelo Pixel).
- Tests automatizados (no hay test runner configurado en el proyecto todavía).
- Versionado o migración de esquema de las claves de `localStorage`.
- Optimización de SEO/metadata por página más allá de un título básico por ruta.

## Data model

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;        // sufijo de clase CSS, ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;         // ej. "12.4K"
};

export const GAMES: Game[];               // mismos 8 juegos del prototipo
export const CATS: ("TODOS" | GameCategory)[];
```

```ts
// lib/leaderboard.ts
export type ScoreRow = { rank: number; name: string; score: number; date: string };

export const PLAYERS: string[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// lib/session.tsx (Context de sesión, cliente)
export type SessionUser = { name: string };

type SavedScore = { game: string; score: number; name: string; at: number };

type SessionContextValue = {
  user: SessionUser | null;
  login: (u: SessionUser | null) => void; // null = invitado
  logout: () => void;
  saveScore: (entry: { game: string; score: number; name: string }) => void;
};
```

Claves de `localStorage` (sin versionar, según decisión del usuario):

- `av_user` → `SessionUser | null` serializado.
- `av_scores` → `SavedScore[]` serializado, solo se agrega (append), nunca se lee para mostrar en UI.

Convenciones:

- `id` de `Game` es slug kebab-case, coincide con el segmento `[id]` de las rutas `/games/[id]` y `/games/[id]/play`.
- `seededScores(seed, count)` es determinístico: mismo `seed` produce siempre las mismas filas (se usa `id.length * 17 + 3` en detalle y `id.length * 23 + 7` en salón, igual que el prototipo).

## Implementation plan

1. Fundamento visual: agregar fuentes "Press Start 2P" y "JetBrains Mono" vía `next/font/google` en `app/layout.tsx` (reemplazando Geist), portar `styles.css` a una hoja de estilos global nueva importada desde el layout. Prueba manual: `npm run dev`, la página default carga con la tipografía y el fondo neón, sin errores en consola.

2. Modelo de datos: crear `lib/games.ts` (`Game`, `GameCategory`, `GAMES`, `CATS`) y `lib/leaderboard.ts` (`ScoreRow`, `PLAYERS`, `seededScores`) con el mismo contenido del prototipo. Prueba: renderizar temporalmente `GAMES.length` en `app/page.tsx` y confirmar 8 juegos.

3. Sesión: crear `lib/session.tsx` con el Context/Provider (`user`, `login`, `logout`, `saveScore`) respaldado por `localStorage` (`av_user`, `av_scores`), envolver el layout raíz con el Provider. Prueba: la app sigue renderizando sin errores, el Provider está montado.

4. `components/Nav.tsx`: portar la navegación (links desktop, hamburguesa mobile, contador de créditos, botón de sesión) consumiendo `SessionContext`, montado en `app/layout.tsx`. Prueba: el nav aparece en cualquier ruta, el toggle mobile abre/cierra el panel.

5. Ruta `/` (biblioteca): `app/page.tsx` + `components/GameCard.tsx` — hero, buscador, chips de categoría, grid de tarjetas usando `GAMES`. Prueba: cargar `/`, filtrar por texto y por categoría, ver los resultados actualizarse.

6. Ruta `/games/[id]` (detalle): `app/games/[id]/page.tsx` — cover, tags, descripción, stat strip, leaderboard lateral con `seededScores`, botones jugar/volver. Prueba: navegar desde una tarjeta de la biblioteca, ver los datos del juego correcto; un `id` inexistente dispara `notFound()`.

7. Ruta `/games/[id]/play` (player): `app/games/[id]/play/page.tsx` — HUD, arena decorativa, simulador de puntuación (incremento aleatorio), pausa/fin, modal de fin de partida que guarda vía `SessionContext.saveScore`. Prueba: jugar, pausar, terminar, guardar puntuación y verificar la entrada nueva en `localStorage.av_scores`.

8. Ruta `/login` (auth): `app/login/page.tsx` — tabs iniciar/crear cuenta, botón invitado, botones sociales decorativos, login mock vía `SessionContext.login`. Prueba: loguearse actualiza el Nav al instante (sin recargar); cerrar sesión limpia `av_user`.

9. Ruta `/leaderboard` (salón): `app/leaderboard/page.tsx` — tabs por juego, podio top 3, tabla de posiciones, fila "tu mejor marca" solo si hay sesión iniciada. Prueba: cambiar de tab por juego, la fila propia aparece solo logueado.

10. Cierre: footer global en `app/layout.tsx`, eliminar boilerplate no usado de `create-next-app`, correr `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` corren sin errores.
- [x] `/` muestra el hero, el buscador y las 4 chips de categoría (`TODOS`, `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`) con los 8 juegos de `GAMES`.
- [x] Escribir en el buscador de `/` filtra las tarjetas por título en tiempo real; si no hay resultados se muestra el mensaje "NO HAY RESULTADOS".
- [x] Click en una chip de categoría filtra el grid a esa categoría; click en "TODOS" restaura el listado completo.
- [x] Click en una tarjeta o en su botón "JUGAR" navega a `/games/[id]` con el `id` correcto.
- [x] `/games/[id]` muestra cover, tags, descripción larga, stat strip y una tabla de 10 puntuaciones generadas por `seededScores`.
- [x] Visitar `/games/id-inexistente` dispara `notFound()` (página 404 de Next.js).
- [x] El botón "JUGAR AHORA" en `/games/[id]` navega a `/games/[id]/play`.
- [x] En `/games/[id]/play` la puntuación sube automáticamente cada ~220ms mientras el juego no está en pausa ni terminado.
- [x] El botón "PAUSA" detiene el incremento de puntuación y muestra el overlay "EN PAUSA"; "REANUDAR" lo reactiva.
- [x] El botón "FIN" muestra el modal de fin de partida con la puntuación final.
- [x] Guardar la puntuación en el modal agrega una entrada nueva a `localStorage["av_scores"]` con `{ game, score, name, at }`.
- [x] "JUGAR DE NUEVO" reinicia puntuación, vidas, nivel y cierra el modal sin salir de la ruta.
- [x] `/login` permite iniciar sesión con cualquier nombre de usuario (sin validar contraseña) y redirige a `/`.
- [x] Al iniciar sesión desde `/login`, el `Nav` (visible en cualquier ruta) refleja el nombre de usuario sin recargar la página.
- [x] "JUGAR COMO INVITADO" en `/login` navega a `/` sin usuario logueado.
- [x] Cerrar sesión desde el `Nav` limpia `localStorage["av_user"]` y el botón vuelve a mostrar "Iniciar Sesión".
- [x] Recargar la página conserva la sesión (`av_user`) leída desde `localStorage`.
- [x] `/leaderboard` muestra tabs por cada uno de los 8 juegos; cambiar de tab actualiza podio y tabla con datos de `seededScores`.
- [x] Si hay sesión iniciada, `/leaderboard` muestra la fila "TU MEJOR MARCA"; si no hay sesión, esa fila no aparece.
- [x] El `Nav` mobile (hamburguesa) abre y cierra el panel lateral con los mismos links que la versión desktop.

## Decisions

- **Sí:** MVP con el juego simulado (sin mecánica real). Implementar 8 minijuegos reales es un proyecto aparte; el objetivo de este spec es portar las vistas.
- **No:** Implementar jugabilidad real ahora. Queda para specs futuros si se decide encarar algún juego en particular.
- **Sí:** Un solo spec para las 5 vistas. El pedido fue "el MVP completo" y no hay una frontera natural entre pantallas que justifique dividir el trabajo.
- **No:** Dividir en specs por pantalla. Hubiera generado overhead de coordinación sin necesidad real para este alcance.
- **Sí:** Login mock sin backend y botones sociales decorativos. No hay backend en este MVP; el prototipo ya define ese comportamiento y se mantiene fiel.
- **No:** Backend o autenticación real. Fuera de alcance de este MVP.
- **Sí:** Rutas técnicas en inglés (`/games/[id]`, `/login`, `/leaderboard`) con copy visible en español. Convención estándar de Next.js; `CLAUDE.md` solo exige que el copy esté en español, no las rutas.
- **No:** Rutas en español calcadas del router por hash del prototipo. Descartado por convención de proyecto.
- **Sí:** Fuentes del prototipo (Press Start 2P / JetBrains Mono) reemplazando Geist. Fidelidad visual al diseño original.
- **Sí:** Portar `styles.css` casi textual como hoja global, sin reescribir a utilities de Tailwind. Evita trabajo extra sin beneficio para un MVP de solo vistas.
- **No:** Reescribir el sistema de diseño a Tailwind. Descartado por costo/beneficio.
- **Sí:** Mantener las claves de `localStorage` (`av_user`, `av_scores`) sin versionar. Decisión explícita del usuario; simplicidad para el MVP.
- **No:** Versionar las claves (`av_user:v1`). Se puede agregar más adelante si hace falta migrar el esquema.
- **Sí:** Context de React del lado cliente para la sesión. Necesario para que el `Nav` global reaccione a login/logout sin recargar la página.
- **No:** Lectura de `localStorage` independiente en cada componente. Generaría desincronización del `Nav` respecto al resto de la UI.
- **Sí:** `components/` en la raíz del proyecto para UI compartida. El `Nav` vive en el layout global y varias piezas (GameCard, filas de leaderboard) se reutilizan entre pantallas.
- **Sí:** Mantener los 8 juegos y su copy exactamente igual al prototipo. Se pidió explícitamente no modificar contenido por ahora.
- **Sí:** `av_scores` queda de solo escritura (no se lee para mostrar historial en ningún lado). Replica fielmente el comportamiento del prototipo, que tampoco lo usa.

## Risks

| Riesgo                                                                 | Mitigación                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `localStorage` no disponible en el server (Next.js renderiza en SSR)   | Todo acceso a `localStorage` vive dentro de `useEffect`/handlers en Client Components (`lib/session.tsx`), nunca en render de servidor. |
| Parpadeo de hidratación: el server renderiza "sin sesión" y el cliente actualiza al leer `av_user` | Aceptado como comportamiento conocido para este MVP; no se implementa mitigación extra (ej. cookies) en este spec. |
| Este proyecto pinea `next@16.2.11`/`react@19.2.4`, versiones posteriores a los datos de entrenamiento — las convenciones de App Router (routing, data fetching, layouts) pueden diferir de Next 13–15 | Antes de escribir cada ruta/layout durante `/spec-impl`, leer la guía correspondiente en `node_modules/next/dist/docs/01-app/`, tal como indica `AGENTS.md`. |

## What is **not** in this spec

- Lógica o mecánica real de cualquiera de los 8 juegos (siguen simulados con puntuación aleatoria).
- Backend real, base de datos o autenticación real (validación de contraseña, OAuth funcional).
- Lectura/uso de `av_scores` para mostrar historial de puntuaciones del usuario en la UI.
- Modo versus / multijugador local (Duelo Pixel).
- Tests automatizados.
- Versionado o migración de esquema de las claves de `localStorage`.

Cada uno de estos, si se necesita, va en su propio spec.

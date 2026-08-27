# SPEC 02 — Home y navegación ampliada de Arcade Vault

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-07-31
> **Objetivo:** Portar la pantalla "Inicio" del prototipo (`home.jsx`) como nueva landing en `/`, reubicar la Biblioteca actual de `/` a `/games`, y ampliar el `Nav` global con los links "Inicio" y "Acerca de" (este último deshabilitado, sin ruta destino).

## Scope

**Incluye:**

- Nueva ruta `/` (`app/page.tsx`, reemplazando el contenido actual) con las secciones del prototipo `home.jsx`: hero (con siluetas flotantes decorativas), "Por qué Arcade Vault" (feature grid), "Juegos disponibles ahora" (mini-rail con `GAMES.slice(0, 6)`), Stats, Actividad en vivo (ticker + top jugadores), Precios (plan único + FAQ) y CTA final.
- Reubicación de la Biblioteca actual (hero, buscador, chips, grid) de `/` a una nueva ruta `app/games/page.tsx`, sin cambios de comportamiento respecto a SPEC 01.
- Actualización de los enlaces internos que hoy asumen que `/` es la biblioteca, para que apunten a `/games`:
  - Link "Biblioteca" en `Nav`.
  - Botón "VOLVER AL VAULT" en `/games/[id]`.
  - Botón "VOLVER A LA BIBLIOTECA" en `/leaderboard`.
  - Botón "VOLVER AL VAULT" del modal de fin de partida en `GamePlayer` (el botón "SALIR" del HUD, que ya apunta a `/games/[id]`, **no se modifica**).
  - Redirect post-login/invitado en `/login`.
- `components/Nav.tsx`: agregar links "Inicio" (→ `/`) y "Acerca de" (visualmente deshabilitado, sin `href`/`onClick`) en versión desktop y mobile; ajustar el estado activo de "Biblioteca" para que dependa de `/games` en vez de `/`.
- Animaciones scroll-reveal (`IntersectionObserver`, clase `.reveal`/`.in`) en las secciones de Home, igual que el prototipo.

**Fuera de alcance (para specs futuros):**

- La ruta `/about` y la pantalla completa `about.jsx` (hero "Acerca de", highlights, formulario de contacto). El link "Acerca de" del Nav queda deshabilitado y sin destino en este spec.
- Conexión de las secciones Stats / Actividad en vivo de Home a datos reales (`GAMES.length`, `seededScores`, etc.) — quedan hardcodeadas/decorativas igual que el prototipo, incluyendo el "12+" aunque `GAMES.length` sea 8.
- Rediseño o cambio de copy respecto al prototipo.
- Tests automatizados.

## Data model

Este feature no introduce estructuras de datos nuevas en `lib/`.

- El mini-rail "Juegos disponibles ahora" de Home reutiliza `GAMES` de `lib/games.ts` (`GAMES.slice(0, 6)`), mismo tipo `Game` definido en SPEC 01.
- Los arrays de las secciones Stats, Actividad en vivo (ticker) y Top jugadores de Home quedan como literales inline dentro del componente `app/page.tsx` (igual que en el prototipo `home.jsx`) — no se exportan ni se agregan a `lib/`, no son reutilizables por otras pantallas.
- No se agrega ningún dato ni tipo nuevo relacionado con `/about` (queda fuera de alcance).

## Implementation plan

1. Crear `app/games/page.tsx` moviendo el contenido íntegro del actual `app/page.tsx` (biblioteca: hero, buscador, chips, grid) sin modificar su lógica. Prueba manual: `/games` muestra la biblioteca funcionando igual que antes en `/` (buscador y chips filtran correctamente).
2. Actualizar los enlaces que apuntaban a `/` como biblioteca para que apunten a `/games`: `components/Nav.tsx` (link "Biblioteca"), `app/games/[id]/page.tsx` (botón "VOLVER AL VAULT"), `app/leaderboard/page.tsx` (botón "VOLVER A LA BIBLIOTECA"), `components/GamePlayer.tsx` (botón "VOLVER AL VAULT" del modal de fin de partida — el botón "SALIR" del HUD no se toca, ya apunta a `/games/[id]`). Prueba: desde cada una de esas pantallas, el botón correspondiente lleva a `/games`.
3. Actualizar `app/login/page.tsx`: el redirect tras iniciar sesión y tras "jugar como invitado" pasa de `/` a `/games`. Prueba: iniciar sesión (o entrar como invitado) redirige a `/games`.
4. Reemplazar `app/page.tsx` con el nuevo Home: sección hero (siluetas flotantes decorativas, título, CTAs "Explorar juegos" → `/games` y "Crear cuenta" → `/login`). Prueba: `/` carga el hero nuevo sin errores de consola.
5. Sección "Por qué Arcade Vault" (feature grid) y sección "Juegos disponibles ahora" (mini-rail con `GAMES.slice(0, 6)`, cada mini-card navega a `/games/[id]`, botón "Ver todos los juegos" → `/games`). Prueba: se ven las 4 feature cards y las 6 mini-cards; click en una mini-card navega al detalle correcto.
6. Secciones "Stats", "Actividad en vivo" (ticker + top jugadores) y "Precios" (plan único + FAQ), con los mismos datos hardcodeados del prototipo. Prueba: las tres secciones renderizan el contenido literal del prototipo, sin errores.
7. Sección final CTA ("¿Listo para jugar?" → `/games`) y animaciones scroll-reveal (`IntersectionObserver`, clase `.reveal`/`.in`) aplicadas a todas las secciones de Home. Prueba: al hacer scroll, cada sección recibe la clase `.in` y aparece con la transición.
8. Ampliar `components/Nav.tsx`: agregar link "Inicio" (→ `/`, activo cuando `pathname === "/"`) y link "Acerca de" (deshabilitado: sin `href`/`onClick`, estilo atenuado) en desktop y mobile. Prueba: el Nav muestra 4 entradas (Inicio, Biblioteca, Salón de la Fama, Acerca de); click en "Acerca de" no navega ni ejecuta ninguna acción.
9. Cierre: correr `npm run lint` y `npm run build` sin errores; revisión manual de que no queden referencias rotas a la biblioteca en `/`.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] `/` muestra el nuevo Home (hero, why, games preview, stats, actividad, pricing, CTA final) en vez de la biblioteca.
- [ ] `/games` muestra la biblioteca (buscador, chips, grid) con el mismo comportamiento que tenía antes en `/`.
- [ ] El botón "Explorar juegos" y el botón "Insertar moneda" (CTA final) del Home navegan a `/games`.
- [ ] El botón "Crear cuenta" del Home navega a `/login`.
- [ ] En "Juegos disponibles ahora", cada mini-card navega a `/games/[id]` con el `id` correcto; "Ver todos los juegos" navega a `/games`.
- [ ] El botón "VOLVER AL VAULT" en `/games/[id]` navega a `/games`.
- [ ] El botón "VOLVER A LA BIBLIOTECA" en `/leaderboard` navega a `/games`.
- [ ] El botón "SALIR" del HUD en `/games/[id]/play` sigue navegando a `/games/[id]` (sin cambios).
- [ ] El botón "VOLVER AL VAULT" del modal de fin de partida en `/games/[id]/play` navega a `/games`.
- [ ] Iniciar sesión o entrar como invitado en `/login` redirige a `/games`.
- [ ] El `Nav` (desktop y mobile) muestra 4 entradas: Inicio, Biblioteca, Salón de la Fama, Acerca de.
- [ ] El link "Inicio" del `Nav` navega a `/` y se marca activo solo cuando `pathname === "/"`.
- [ ] El link "Biblioteca" del `Nav` se marca activo en `/games`, `/games/[id]` y `/games/[id]/play`.
- [ ] El link "Acerca de" del `Nav` se muestra visualmente deshabilitado (sin cursor pointer, opacidad reducida) y no navega ni ejecuta ninguna acción al hacer click.
- [ ] Las secciones de Home con clase `.reveal` reciben la clase `.in` y aparecen con transición al hacer scroll.
- [ ] El logo de Arcade Vault en el `Nav` navega a `/` (Home).

## Decisions

- **Sí:** mover la Biblioteca de `/` a `/games`, dejando `/` como landing (Home). Coincide con la arquitectura del prototipo, donde Inicio y Biblioteca son pantallas distintas, y con la preferencia del usuario por `/games` sobre `/juegos`.
- **No:** mantener `/` como biblioteca y poner Home en otra ruta (ej. `/inicio`). Descartado porque una landing fuera de la raíz es poco convencional.
- **Sí:** `/games` (índice) coexiste con `/games/[id]` y `/games/[id]/play` (rutas dinámicas), patrón estándar de Next.js App Router.
- **Sí:** el link "Acerca de" aparece en el `Nav` pero sin ruta ni acción, visualmente deshabilitado. Decisión explícita del usuario: no se implementa la pantalla `about.jsx` (ni `/about`) en este spec.
- **No:** implementar `/about` con el formulario de contacto de `about.jsx`. Queda diferido a un spec futuro.
- **Sí:** las secciones Stats y Actividad en vivo de Home quedan con datos hardcodeados/decorativos, igual que el prototipo (incluyendo el "12+" aunque `GAMES.length` sea 8). Decisión explícita del usuario, prioriza fidelidad al prototipo sobre consistencia de datos.
- **No:** conectar Stats/Actividad a `GAMES.length` o `seededScores()`. Fuera de alcance de este spec.
- **Sí:** reutilizar `GAMES` de `lib/games.ts` para el mini-rail "Juegos disponibles ahora" (los primeros 6). Único punto donde Home usa datos reales, porque el prototipo también lo hace.
- **Sí:** el botón "SALIR" del HUD en el player no se modifica, ya apunta correctamente a `/games/[id]` desde SPEC 01. Solo se actualiza el botón "VOLVER AL VAULT" del modal de fin de partida, que sí apuntaba a `/`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Mover la biblioteca de `/` a `/games` cambia el contrato de rutas de SPEC 01; cualquier marcador o enlace externo a la vieja `/`-biblioteca ahora carga el Home en su lugar | Aceptado como cambio de arquitectura explícito para este MVP sin usuarios reales todavía; no se implementa redirect porque `/` ahora es una ruta válida (Home), no un 404. |
| Coexistencia de `app/games/page.tsx` (índice) y `app/games/[id]/page.tsx` (dinámica) en el App Router de `next@16.2.11`, versión posterior a los datos de entrenamiento | Antes de crear la ruta, leer la guía correspondiente en `node_modules/next/dist/docs/01-app/`, tal como indica `AGENTS.md`. |

## What is **not** in this spec

- La ruta `/about` y la pantalla completa `about.jsx` (hero "Acerca de", highlights, formulario de contacto).
- Conexión de datos reales (`GAMES.length`, `seededScores`) a las secciones Stats/Actividad en vivo de Home.
- Rediseño o cambios de copy respecto al prototipo.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.

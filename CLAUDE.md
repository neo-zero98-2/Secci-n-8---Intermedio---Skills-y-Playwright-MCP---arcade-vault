# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

@AGENTS.md

Este proyecto fija `next@16.2.11` / `react@19.2.4` — versiones posteriores a tus datos de entrenamiento. Según `AGENTS.md`: antes de escribir cualquier código del App Router (routing, obtención de datos, layouts, metadata, componentes de servidor/cliente, middleware), lee primero la página correspondiente en `node_modules/next/dist/docs/01-app/` y respeta sus avisos de deprecación. No des por hecho que los patrones de Next.js 13–15 siguen valiendo.

Dos trampas de Next.js 16 con las que ya se ha tropezado en este repo:

- `middleware.ts` se renombró a **`proxy.ts`** en la raíz, y la función exportada `middleware` → `proxy` (ver `proxy.ts`, que delega en `lib/supabase/proxy.ts`).
- Los `params` de ruta son una `Promise` y hay que hacerles `await` (`app/games/[id]/page.tsx`).

## Comandos

```bash
npm run dev      # servidor de desarrollo (localhost:3000)
npm run build    # build de producción
npm run start    # ejecuta el build de producción
npm run lint     # ESLint (flat config, eslint.config.mjs; ignora references/**)
npx prettier --write <archivo>
```

No hay runner de tests configurado. La verificación en este proyecto es manual: levanta el servidor de desarrollo y maneja la UI con el Playwright MCP.

Variables de entorno (`.env.local`, ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`.

Un hook `PostToolUse` (`.claude/hooks/format-and-lint.mjs`) pasa Prettier + ESLint a cada archivo que escribes o editas — no los ejecutes a mano sobre archivos que acabas de tocar.

## Arquitectura

Next.js App Router, TypeScript, alias de rutas `@/*` → raíz del repo. Rutas: `/` (landing), `/games` (biblioteca), `/games/[id]` (ficha), `/games/[id]/play` (reproductor), `/leaderboard`, `/about`, `/login` (login simulado), más los Route Handlers `/api/scores` y `/api/contact`.

**El catálogo de juegos es estático, no sale de la BD.** `lib/games.ts` (`GAMES`, `CATS`) es la fuente de verdad de la UI: 8 juegos con `id`, textos, clase de portada, color, valores *decorativos* de `best`/`plays`, y un `controls: GameControl[]` opcional (glifos de tecla + qué hacen) que solo declaran los juegos con motor real — `app/games/[id]/page.tsx` lo pinta como el bloque `.controls-card` y lo omite por completo cuando no existe. La tabla `games` de Supabase solo lo refleja para dar integridad referencial a `scores` — no cambies las páginas para leer los juegos desde la BD sin una spec que lo pida.

**4 de los 8 juegos son reales; quien lo decide es `components/games/registry.ts`.** `GAME_ENGINES` es el único sitio del proyecto que declara qué slot tiene motor real de canvas:

| id | título | componente | `hasLives` | `fitHeight` | spec |
| --- | --- | --- | --- | --- | --- |
| `rocas` | ROCAS (Asteroids) | `AsteroidsGame.tsx` | sí | no | 04 |
| `caida` | CAÍDA (Tetris) | `TetrisGame.tsx` | no | sí | 06 |
| `bloque-buster` | BLOQUE BUSTER (Arkanoid) | `ArkanoidGame.tsx` | sí | no | 07 |
| `serpentina` | SERPENTINA (Snake) | `SnakeGame.tsx` | sí | no | 08 |

Los cuatro implementan el mismo contrato, que la SPEC 06 generalizó a partir del que la SPEC 04 escribió para un solo juego: props `paused` / `onScoreChange` / `onLevelChange` / `onLivesChange` (opcional) / `onGameOver`, más un handle imperativo `GameEngineHandle` (`restart`, `forceGameOver`) que accionan los botones del HUD. `hasLives: false` oculta el `.hud-stat` de "Vidas"; `fitHeight: true` significa que el canvas no es 4:3 y se centra a altura completa dentro del marco CRT (`.crt-screen.fit-height`).

**Nada debería volver a ramificar por el id de un juego** — `components/GamePlayer.tsx`, `app/leaderboard/page.tsx` (qué pestañas se habilitan y cuál es la pestaña por defecto) y `app/games/[id]/page.tsx` (si "Mejor global" es real o decorativo) preguntan todos a `getGameEngine(id)` / leen `GAME_ENGINES`. Añadir un 5.º juego real debería ser escribir el componente y añadir una fila al registro.

Los 4 restantes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) siguen con la arena decorativa del prototipo y su simulador falso de puntuación con `setInterval`, y quedan excluidos a propósito del ranking real para no ensuciarlo.

**Estructura de archivos de un motor.** Cada juego portado separa datos y lógica: un módulo puro `<juego>-assets.ts` (recortes del atlas de sprites, tablas de niveles/velocidad, cargador de imagen, pool de audio — solo constantes y funciones puras, sin globals, para que dos montajes nunca compartan mundo) junto al componente `<Juego>Game.tsx`, que es el dueño del canvas y del loop. Los binarios viven en `public/games/<id>/` (`bloque-buster/spritesheet-breakout.png` + `sounds/*.mp3`, `serpentina/fruits.png`).

**Dos capas de persistencia que conviven, a propósito:**

- La *sesión* sigue siendo un simulacro: `lib/session.tsx` (`SessionProvider` / `useSession`) guarda al "usuario" en `localStorage` bajo `av_user`; cualquier nombre entra, sin comprobar contraseña. `saveScore` escribe en `av_scores` — legado de solo escritura, nadie lo lee, y lo siguen usando los 4 juegos falsos.
- Las *puntuaciones reales* viven en Supabase. `app/api/scores/route.ts` es el **único sitio del proyecto que toca la tabla `scores`** — mantenlo así. Incluso los componentes de servidor pasan por ahí (`app/games/[id]/page.tsx` deriva el origen de las cabeceras de la petición para llamar a su propio `GET`). `GET ?game=<id>` devuelve el top 10 descendente; `POST` valida el id de juego, un nombre de 1–10 caracteres y una puntuación entera dentro de rango antes de insertar.

Los clientes de Supabase están separados por runtime, al estilo `@supabase/ssr`: `lib/supabase/client.ts` (navegador), `server.ts` (Server Components / Route Handlers, `cookies()` asíncrono), `proxy.ts` (refresco de token desde el `proxy.ts` de la raíz). Esquema: `games` (PK de texto = el slug de la app) y `scores` (FK `game_id`, constraints de nombre/puntuación, índice `(game_id, score desc)`). El RLS permite `select` público en ambas e `insert` anónimo solo en `scores` — sin `update` ni `delete` para nadie. Como no hay autenticación real, la clave publicable viaja en el bundle del navegador y el envío de puntuaciones se basa en la confianza; es una limitación conocida y aceptada, documentada en `specs/05-leaderboard-supabase.md`.

## Estilos

`app/globals.css` (~1.470 líneas) es el sistema de diseño: una hoja arcade neón/retro portada casi literalmente del prototipo, construida sobre custom properties de CSS (`--cyan`, `--magenta`, `--pixel`, `--line`, …) y nombres de clase semánticos (`.btn`, `.chip`, `.crt-screen`, `.podium-slot`, `.reveal`, `.neon-*`). Tailwind v4 está importado (`@import "tailwindcss"` + `@theme inline`, la config vive en el CSS, no hay `tailwind.config.*`) pero apenas se usa — **la UI nueva debe extender las clases CSS existentes**, y las secciones nuevas del prototipo se añaden a `globals.css` en el mismo estilo en lugar de reescribirse en Tailwind.

Nota: el CSS espera `--font-press-start-2p` / `--font-jetbrains-mono`, pero ahora mismo no hay cableado de `next/font` en `app/layout.tsx`, así que caen a las fuentes del sistema. Cablea las fuentes si una tarea depende de la tipografía de píxeles.

Todo el texto de cara al usuario está en **español**; números y fechas se formatean con `es-ES`.

## `references/` — prototipos, no entradas del build

Excluidos de ESLint y del build de TS; JS/JSX plano.

- `references/templates/` — el prototipo original en React estático (sin Next): fuente de verdad para la estructura de la UI, los textos y las pantallas. Porta su intención a convenciones reales de Next.js (routing por archivos, Server/Client Components); nunca copies su router de hash ni su forma de compartir datos por globals de `window`.
- `references/started-games/` — juegos de canvas independientes. Los tres (`02-asteroids`, `03-tetris`, `04-arkanoid`) ya están portados a `components/games/`; mantenlos como fuente de verdad de los números y el comportamiento originales cuando toques un motor.
- `references/source-assets/` — entregas de arte/datos en bruto que llegaron sin un original jugable (`snake-assets/`, el atlas de frutas y `sprites.js` detrás de SERPENTINA, que se escribió desde cero en lugar de portarse).

## Flujo dirigido por specs

Las funcionalidades no triviales pasan por `/spec` y luego `/spec-impl` (skills de `Klerith/fernando-skills`, vendorizadas en `.agents/skills/`). Las specs viven en `specs/NN-slug.md` con una cabecera `> **Estado:**` — `/spec-impl` se niega a implementar una que no esté aprobada, y la marca como `Implementado` al terminar. Cada spec lleva una lista explícita de *Fuera de alcance*; respétala en lugar de ampliar el alcance de forma oportunista. Las specs `01`–`08` están hechas (01 MVP, 02 home/nav, 03 about+contacto/Resend, 04 Asteroids, 05 ranking con Supabase, 06 Tetris, 07 Arkanoid, 08 Snake), así que la siguiente es `specs/09-*`.

Convenciones visibles en el historial de git: rama `spec-NN-slug`, un commit por cada paso numerado de la implementación, mensaje `feat(specN): pasoN <descripción en español>`, después `docs(specN): marca la spec NN como Implementado`, y merge a `main` vía PR.

## Skills y MCP (requisitos del usuario)

- Ejecuta siempre la skill `/frontend-design` al diseñar o rediseñar interfaces de usuario.
- Verifica los cambios en el navegador con el **Playwright MCP** en lugar de dar por hecho que funcionan.
- Usa el **Supabase MCP** para todo lo que toque la base de datos (inspección de esquema, migraciones, logs, advisors). Carga las skills `supabase` / `supabase-postgres-best-practices` antes de trabajar con esquema o SQL.

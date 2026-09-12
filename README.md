# Arcade Vault

Plataforma para jugar clásicos del arcade online y competir por la mayor puntuación.
Interfaz retro/neón en español, construida con **Next.js 16 (App Router)**, **React 19**,
**TypeScript** y **Supabase**.

## Estado actual

| Área | Estado |
| --- | --- |
| Vistas (inicio, biblioteca, detalle, player, salón de la fama, acerca de) | ✅ Implementadas |
| Juego real **ROCAS** (Asteroids sobre `<canvas>`) | ✅ Jugable |
| Los otros 7 juegos | 🕹️ Simulados (puntuación falsa, sin mecánica) |
| Ranking real con Supabase | ✅ Solo para ROCAS |
| Formulario de contacto (Resend, sandbox) | ✅ Funcionando |
| Autenticación real | ❌ Simulada en `localStorage` (`av_user`) |
| Tests automatizados | ❌ No hay runner configurado |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                  # http://localhost:3000
```

Variables de entorno (`.env.local`):

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase (ranking) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable del mismo proyecto |
| `RESEND_API_KEY` | Envío del formulario de contacto |
| `CONTACT_TO_EMAIL` | Destinatario de los mensajes de contacto |

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # ESLint (config plana en eslint.config.mjs)
```

## Rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Landing: hero, features, mini-rail de juegos, precios, CTA |
| `/games` | Biblioteca: buscador y filtro por categoría |
| `/games/[id]` | Detalle del juego + mejores puntuaciones |
| `/games/[id]/play` | Player (juego real en `rocas`, simulador en el resto) |
| `/leaderboard` | Salón de la fama: podio y tabla top 10 |
| `/about` | Acerca de + formulario de contacto |
| `/api/scores` | `GET ?game=<id>` top 10 · `POST` registra puntuación |
| `/api/contact` | `POST` envía el mensaje de contacto por Resend |

## Estructura

```
app/                    rutas del App Router y Route Handlers
components/             Nav, GameCard, GamePlayer, ContactForm
components/games/       motores de juego reales (AsteroidsGame)
lib/games.ts            catálogo de los 8 juegos (fuente de verdad de la UI)
lib/session.tsx         sesión simulada en localStorage
lib/scores.ts           tipos compartidos del ranking
lib/supabase/           clientes de Supabase (browser / server / proxy)
app/globals.css         sistema de diseño neón completo (~1400 líneas)
proxy.ts                refresco de sesión (Next.js 16 renombró middleware.ts → proxy.ts)
specs/                  specs numeradas del proyecto
references/             prototipos de origen, fuera del build
```

### Base de datos

Dos tablas en Supabase: `games` (espejo del catálogo, da integridad referencial) y `scores`
(una fila por partida terminada). RLS permite `select` público en ambas e `insert` anónimo solo
en `scores`; nadie puede actualizar ni borrar. `app/api/scores/route.ts` es el **único** punto
del proyecto que consulta la tabla `scores`.

> Sin autenticación real, la clave publicable viaja en el bundle del navegador y las puntuaciones
> son confiables solo hasta donde llegan las constraints de la base y la validación del endpoint.
> Es una limitación conocida y aceptada, documentada en `specs/05-leaderboard-supabase.md`.

## Spec Driven Design

El proyecto se desarrolla con specs, usando los comandos `/spec` y `/spec-impl` de
[Klerith/fernando-skills](https://github.com/Klerith/fernando-skills).

Cada spec vive en `specs/NN-slug.md` con su estado (`Borrador` → `Aprobado` → `Implementado`),
su alcance y — igual de importante — lo que queda **fuera de alcance**. `/spec-impl` solo
implementa specs aprobadas: crea la rama `spec-NN-slug` y avanza paso a paso.

| Spec | Contenido |
| --- | --- |
| 01 | MVP de las 5 vistas portadas del prototipo |
| 02 | Home nueva y navegación ampliada |
| 03 | Página "Acerca de" y contacto con Resend |
| 04 | Juego real de Asteroids en el slot ROCAS |
| 05 | Leaderboard real con Supabase |

Convención de commits: `feat(specN): pasoN <descripción>`, cerrando con
`docs(specN): marca la spec NN como Implementado`.

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills   # /spec y /spec-impl
npx skills@latest add anthropics/skills         # /frontend-design
npx skills@latest add supabase/agent-skills     # supabase y postgres best practices
```

Quedan registradas en `skills-lock.json`.

## MCP

- **Supabase** — configurado en `.mcp.json`; se usa para inspeccionar esquema, migraciones y logs.
- **Playwright** — para comprobar los cambios en el navegador en vez de asumir que funcionan.

## Hooks personalizados

Configurados en `.claude/settings.local.json` (archivo local, no versionado — hay que
reconfigurarlo tras clonar):

- **`Stop`** — al terminar Claude Code su respuesta, reproduce `assets/claudecode-finished.mp3`
  con `mpg123`, para avisar de que la tarea acabó y espera respuesta.
- **`PostToolUse`** — tras cada `Write`/`Edit`, ejecuta `.claude/hooks/format-and-lint.mjs`, que
  pasa Prettier y ESLint sobre el archivo modificado.

## Notas técnicas

- **Next.js 16** cambia convenciones respecto a versiones anteriores: `middleware.ts` pasó a
  llamarse `proxy.ts` y los `params` de ruta son promesas. La documentación de la versión exacta
  está en `node_modules/next/dist/docs/`.
- **Estilos**: `app/globals.css` es el sistema de diseño real (variables CSS y clases semánticas
  portadas del prototipo). Tailwind v4 está instalado pero apenas se usa.
- **`references/`** contiene los prototipos de origen (el sitio estático en React y los juegos
  standalone en canvas) y está excluido de ESLint y del build de TypeScript.

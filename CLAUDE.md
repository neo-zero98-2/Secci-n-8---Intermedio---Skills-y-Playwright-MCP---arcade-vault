# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This project pins `next@16.2.11` / `react@19.2.4` — versions ahead of your training data. Per `AGENTS.md` above: before writing any App Router code (routing, data fetching, layouts, metadata, server/client components), read the matching page under `node_modules/next/dist/docs/01-app/` first and follow any deprecation notices found there. Don't assume Next.js 13–15 patterns still apply.

## Project state

This is currently a barely-modified `create-next-app` scaffold — `app/page.tsx` and `app/layout.tsx` are still the default template. The actual product ("Arcade Vault") has not been implemented in the Next.js app yet.

The real design/behavior spec lives in `references/templates/` as a static HTML/React (non-Next) prototype:

- `Arcade Vault.html` — entry point that loads the other files as plain `<script>` tags (uses global `React`/`ReactDOM`, no bundler, no JSX transform pipeline)
- `app.jsx` — root `App` component; hash-based router (`route` state synced to `location.hash`) with screens: `biblioteca` (library/home), `detalle` (game detail), `player` (game player), `auth` (login), `salon` (hall of fame / leaderboard)
- `data.jsx` — mock data: `GAMES` array (id, title, description, category, cover, color, best score, play count), `CATS` category list, `seededScores()` deterministic leaderboard generator, all attached to `window`
- `nav.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx` (player), `salon.jsx` (hall of fame), `auth.jsx` — one component per screen
- `styles.css` — neon/retro-arcade visual design system (CSS custom properties for color themes per game)

When implementing real pages/components in `app/`, treat `references/templates/` as the source of truth for UI structure, copy (Spanish), routes, and data shape — but port it to actual Next.js conventions (file-based routing, Server/Client Components, no `window`-global data sharing, no manual hash routing) rather than copying the prototype's patterns verbatim.

State/session model implied by the prototype: user auth and score submissions are currently just `localStorage` (`av_user`, `av_scores`) — there is no backend yet.

## Commands

```bash
npm run dev      # start dev server (Next.js, Turbopack unless configured otherwise)
npm run build    # production build
npm run start    # run production build
npm run lint     # ESLint (flat config in eslint.config.mjs, extends eslint-config-next)
```

No test runner is configured in `package.json` yet.

## Stack notes

- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`) — no `tailwind.config.*` file, v4 uses CSS-based config in `app/globals.css`.
- TypeScript throughout `app/`; the `references/templates/` prototype is plain JSX/JS and is not part of the TS build.
- Fonts: `next/font/google` (Geist Sans/Mono) wired in `app/layout.tsx`.

## Spec-driven workflow

Per `README.md`, this project follows spec-driven design using the `/spec` and `/spec-impl` commands from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`). Prefer writing/updating a spec before implementing non-trivial features if these commands are available in the environment.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

This project pins `next@16.2.11` / `react@19.2.4` — versions ahead of your training data. Per `AGENTS.md` above: before writing any App Router code (routing, data fetching, layouts, metadata, server/client components, middleware), read the matching page under `node_modules/next/dist/docs/01-app/` first and follow any deprecation notices there. Don't assume Next.js 13–15 patterns still apply.

Two Next.js 16 gotchas already hit in this repo:

- `middleware.ts` was renamed to **`proxy.ts`** at the root, and the exported function `middleware` → `proxy` (see `proxy.ts`, which delegates to `lib/supabase/proxy.ts`).
- Route `params` are a `Promise` and must be awaited (`app/games/[id]/page.tsx`).

## Commands

```bash
npm run dev      # dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # ESLint (flat config, eslint.config.mjs; ignores references/**)
npx prettier --write <file>
```

No test runner is configured. Verification in this project is manual: run the dev server and drive the UI with the Playwright MCP.

Env vars (`.env.local`, see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`.

A `PostToolUse` hook (`.claude/hooks/format-and-lint.mjs`) runs Prettier + ESLint on every file you Write/Edit — don't run them manually on files you just touched.

## Architecture

Next.js App Router, TypeScript, `@/*` path alias → repo root. Routes: `/` (landing), `/games` (library), `/games/[id]` (detail), `/games/[id]/play` (player), `/leaderboard`, `/about`, plus Route Handlers `/api/scores` and `/api/contact`.

**Game catalog is static, not from the DB.** `lib/games.ts` (`GAMES`, `CATS`) is the source of truth for the UI: 8 games with `id`, copy, cover class, color, and *decorative* `best`/`plays` values. The Supabase `games` table mirrors it only to give `scores` referential integrity — don't switch pages to read games from the DB without a spec saying so.

**Only `rocas` is a real game.** `components/GamePlayer.tsx` branches on `game.id === "rocas"`: that slot renders `components/games/AsteroidsGame.tsx` (a full canvas game engine ported from `references/started-games/02-asteroids/game.js`, exposing an imperative `AsteroidsGameHandle` plus `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` callbacks that drive the React HUD). The other 7 games still use the prototype's fake `setInterval` score simulator and are deliberately excluded from the real leaderboard so they don't pollute it.

**Two coexisting persistence layers, on purpose:**

- *Session* is still a mock: `lib/session.tsx` (`SessionProvider` / `useSession`) keeps the "user" in `localStorage` under `av_user`; any name logs in, no password check. `saveScore` writes to `av_scores` — write-only legacy, read by nothing, still used by the 7 fake games.
- *Real scores* live in Supabase. `app/api/scores/route.ts` is the **only place in the project that touches the `scores` table** — keep it that way. Even server components fetch through it (`app/games/[id]/page.tsx` derives the origin from request headers to call its own `GET`). `GET ?game=<id>` returns the top 10 desc; `POST` validates game id, 1–10 char name, and integer score in range before inserting.

Supabase clients are split by runtime, `@supabase/ssr` style: `lib/supabase/client.ts` (browser), `server.ts` (Server Components / Route Handlers, async `cookies()`), `proxy.ts` (token refresh in the root `proxy.ts`). Schema: `games` (text PK = the app's slug) and `scores` (`game_id` FK, name/score check constraints, index `(game_id, score desc)`). RLS allows public `select` on both and anonymous `insert` on `scores` only — no `update`/`delete` for anyone. Since there's no real auth, the publishable key ships in the browser bundle and score submission is trust-based; that's a known, accepted limitation documented in `specs/05-leaderboard-supabase.md`.

## Styling

`app/globals.css` (~1400 lines) is the design system: a neon/retro arcade sheet hand-ported almost verbatim from the prototype, built on CSS custom properties (`--cyan`, `--magenta`, `--pixel`, `--line`, …) and semantic class names (`.btn`, `.chip`, `.crt-screen`, `.podium-slot`, `.reveal`, `.neon-*`). Tailwind v4 is imported (`@import "tailwindcss"` + `@theme inline`, config lives in the CSS, no `tailwind.config.*`) but is barely used — **new UI should extend the existing CSS classes**, and new prototype sections get appended to `globals.css` in the same style rather than rewritten in Tailwind.

Note: the CSS expects `--font-press-start-2p` / `--font-jetbrains-mono`, but no `next/font` wiring currently exists in `app/layout.tsx`, so those fall back to system fonts. Wire the fonts if a task depends on the pixel typeface.

All user-facing copy is **Spanish**; numbers/dates format with `es-ES`.

## `references/` — prototypes, not build inputs

Excluded from ESLint and the TS build; plain JS/JSX.

- `references/templates/` — the original static React (non-Next) prototype: source of truth for UI structure, copy, and screens. Port its intent to real Next.js conventions (file routing, Server/Client Components); never copy its hash router or `window`-global data sharing.
- `references/started-games/` — standalone canvas games (`02-asteroids` already ported, `03-tetris`, `04-arkanoid` pending) to be adapted into `components/games/`.

## Spec-driven workflow

Non-trivial features go through `/spec` then `/spec-impl` (skills from `Klerith/fernando-skills`, vendored in `.agents/skills/`). Specs live in `specs/NN-slug.md` with a `> **Estado:**` header — `/spec-impl` refuses to implement one that isn't Approved, and marks it `Implementado` when done. Each spec carries an explicit *Fuera de alcance* list; respect it rather than opportunistically expanding scope.

Conventions visible in git history: branch `spec-NN-slug`, one commit per numbered implementation step, message `feat(specN): pasoN <descripción en español>`, then `docs(specN): marca la spec NN como Implementado`, merged to `main` via PR.

## Skills and MCP (user requirements)

- Always run the `/frontend-design` skill when designing or reshaping user interfaces.
- Verify changes in the browser with the **Playwright MCP** rather than assuming they work.
- Use the **Supabase MCP** for anything touching the database (schema inspection, migrations, logs, advisors). Load the `supabase` / `supabase-postgres-best-practices` skills before schema or SQL work.

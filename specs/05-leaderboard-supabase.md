# SPEC 05 — Leaderboard real con Supabase

> **Estado:** Aprovado
> **Depende de:** SPEC 01, SPEC 04
> **Fecha:** 2026-09-08
> **Objetivo:** Reemplazar el ranking inventado de `/leaderboard` por uno real alimentado desde Supabase, con las tablas `games` y `scores` como primer backend del proyecto y un endpoint `/api/scores` que registra y consulta las puntuaciones reales de ROCAS.

## Por qué este spec

Hasta ahora Arcade Vault no tiene backend: los rankings se inventan con `seededScores()` y las
puntuaciones se escriben en `av_scores` de `localStorage`, donde nadie las lee jamás. El resultado
es un "Salón de la Fama" que muestra nombres que no existen y una marca personal calculada con
`8 + (tab.length % 4)`.

Este spec introduce la primera base de datos del proyecto para que el ranking diga la verdad. La
consecuencia incómoda, aceptada a conciencia: sin autenticación real, la clave publicable viaja en
el bundle del navegador y cualquiera puede insertar la puntuación que quiera. Se acota con
constraints en la base de datos y validación en el endpoint, no se resuelve. Resolverlo requiere
Supabase Auth, y eso es otro spec.

## Scope

**Incluye:**

- Primera migración Supabase del proyecto, con dos tablas nuevas en el esquema `public`:
  - `games`: espejo del tipo `Game` de `lib/games.ts` **sin** las columnas `best` ni `plays` (valores decorativos inventados que no deben parecer datos reales).
  - `scores`: una fila por partida terminada, con clave foránea a `games`.
- Semilla de `games` con los 8 juegos actuales de `lib/games.ts`, dentro de la misma migración. `scores` nace **vacía**: no se siembra ni una fila de ejemplo.
- Políticas RLS: `select` público en ambas tablas; `insert` anónimo permitido solo en `scores`; sin `update` ni `delete` para nadie.
- Nuevo Route Handler `app/api/scores/route.ts`, **único lugar del proyecto que consulta la tabla `scores`**:
  - `POST` — valida el cuerpo (juego existente, nombre 1–10 caracteres, puntuación entera dentro de rango) e inserta la fila.
  - `GET ?game=<id>` — devuelve el top 10 de ese juego, ordenado por puntuación descendente.
- `app/leaderboard/page.tsx` reescrito para consumir `GET /api/scores`:
  - Pestaña **ROCAS** activa y seleccionada por defecto; las otras 7 atenuadas, marcadas "PRÓXIMAMENTE" y no seleccionables.
  - Podio parcial: se dibujan solo los escalones que tienen dueño (0 marcas → sin podio; 1 marca → solo oro; 2 → oro y plata).
  - Tabla de hasta 10 filas con rango, jugador, puntuación y fecha.
  - Estado vacío cuando ROCAS no tiene ninguna marca: bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL PRIMERO" con enlace a `/games/rocas/play`, sin podio ni tabla.
  - Fila "TU MEJOR MARCA" calculada de verdad: aparece solo si hay sesión y existe al menos una puntuación con ese nombre; muestra su puesto real.
  - Estados de carga y de error de la petición (la pantalla ahora depende de la red).
- `app/games/[id]/page.tsx`: la barra lateral "MEJORES PUNTUACIONES" deja de usar `seededScores` y pasa a consumir `GET /api/scores`.
  - En ROCAS muestra el top 10 real; si no hay ninguna marca, el mismo bloque vacío del salón.
  - En los otros 7 juegos muestra siempre ese bloque vacío, conservando el layout de dos columnas.
  - El dato "Mejor global" del `stat-strip` pasa a ser, **solo en ROCAS**, la puntuación más alta real (la primera fila del top 10 ya consultado, sin consulta adicional), o "———" si no hay ninguna. Los otros 7 siguen mostrando su `game.best` decorativo.
- `components/GamePlayer.tsx`: al guardar en el modal de fin de partida, si `game.id === "rocas"` se hace `POST /api/scores`; los otros 7 juegos siguen llamando a `saveScore` de `localStorage`, sin cambios.
- El modal gana estados de envío para ROCAS: botón deshabilitado mientras se guarda, y mensaje de error con reintento si el `POST` falla (mismo patrón que el formulario de SPEC 03).
- `app/globals.css`: estilos para la pestaña deshabilitada (`.chip:disabled`) y para el bloque de estado vacío del salón.
- Se elimina `lib/leaderboard.ts` (`seededScores` y `PLAYERS`) por quedar sin uso.

**Fuera de alcance (para specs futuros):**

- Supabase Auth real. El login sigue siendo el simulacro de `localStorage` (`av_user`) y el nombre del ranking sigue siendo texto libre.
- Migrar `/games` y `/games/[id]` a leer los **juegos** desde la tabla `games`. `lib/games.ts` sigue siendo la fuente de verdad de la UI; la tabla existe para dar integridad referencial a `scores`.
- Que los otros 7 juegos escriban al ranking real. Su puntuación la genera un `setInterval` falso y contaminaría la tabla.
- Modificar los valores `best` y `plays` de `lib/games.ts`. Siguen siendo decorativos: `plays` se muestra tal cual en las 8 pantallas de detalle, y `best` en las 7 que no son ROCAS. La pantalla de ROCAS deja de leer `game.best` para "Mejor global", pero el valor del archivo no se toca.
- Anti-fraude más allá de las constraints y la validación del endpoint: sin rate limiting, sin captcha, sin firma de puntuaciones.
- Moderación: borrar o editar marcas. RLS no concede `update` ni `delete` a nadie.
- Paginación o histórico más allá del top 10.
- `proxy.ts` en la raíz para refrescar la sesión de Supabase. No hace falta mientras no haya Auth.
- Realtime: el ranking se lee al montar la página, no se actualiza solo.
- Tests automatizados.

## Data model

Primera migración del proyecto, aplicada como `create_games_and_scores`. Ambas tablas viven en el
esquema `public`, con identificadores en minúscula y `snake_case`.

### Tabla `games`

Espejo del tipo `Game` de `lib/games.ts` sin `best` ni `plays`. La clave primaria es el `id` de
texto que ya usa la aplicación (`"rocas"`, `"bloque-buster"`, …): es una clave natural, estable y
la que aparece en las URLs, así que no se inventa un `bigint` paralelo.

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);
```

Se siembra en la misma migración con los 8 juegos de `lib/games.ts`.

### Tabla `scores`

Una fila por partida terminada. Nace vacía y no se siembra con nada.

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games (id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score integer not null check (score >= 0 and score <= 10000000),
  created_at timestamptz not null default now()
);
```

### Índice

```sql
create index scores_game_id_score_idx on public.scores (game_id, score desc);
```

Un solo índice cubre las dos necesidades: la consulta del ranking
(`where game_id = $1 order by score desc limit 10`) y el índice sobre la clave foránea, que
Postgres no crea automáticamente. El orden de columnas respeta la regla de igualdad primero
(`game_id`) y rango/orden después (`score desc`).

### RLS

```sql
alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy games_select_public on public.games
  for select to anon, authenticated using (true);

create policy scores_select_public on public.scores
  for select to anon, authenticated using (true);

create policy scores_insert_anon on public.scores
  for insert to anon, authenticated with check (true);
```

No se crean políticas de `update` ni `delete`: con RLS activo, lo que no tiene política queda
denegado. Las políticas no invocan `auth.uid()` porque no hay autenticación todavía; cuando la
haya, `scores_insert_anon` es exactamente la política que habrá que reemplazar.

El `insert` anónimo es deliberado y es el punto débil conocido de este spec: la clave publicable
viaja en el bundle del navegador, así que las constraints de la tabla (`player_name` de 1–10
caracteres, `score` entero entre 0 y 10 000 000) son el único límite real a una puntuación
inventada. Acotan, no impiden.

### Tipos en TypeScript

Nuevo archivo `lib/scores.ts`, solo con tipos y sin lógica, porque la pantalla y el endpoint
necesitan compartir la misma forma:

```ts
export type Score = {
  id: number;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string; // ISO 8601
};

export type ScoresResponse = { ok: true; scores: Score[] } | { ok: false; error: string };
export type SubmitScoreBody = { game_id: string; player_name: string; score: number };
export type SubmitScoreResponse = { ok: true } | { ok: false; error: string };
```

### Acceso a los datos

Toda lectura del ranking pasa por `GET /api/scores`. Ninguna pantalla consulta la tabla `scores`
por su cuenta, ni siquiera las que se renderizan en el servidor. El cliente de Supabase se usa
únicamente dentro de `app/api/scores/route.ts`.

`app/leaderboard/page.tsx` es un Client Component y hace el `fetch` con una ruta relativa. La
pantalla de detalle es un Server Component y necesita URL absoluta, que se deriva de la propia
petición:

```ts
// app/games/[id]/page.tsx
const h = await headers();
const proto = h.get("x-forwarded-proto") ?? "http";
const origin = `${proto}://${h.get("host")}`;
const res = await fetch(`${origin}/api/scores?game=${id}`, { cache: "no-store" });
```

Convenciones:

- El rango (`#01`, `#02`, …) **no** se guarda ni se devuelve: se deriva del orden de las filas en la pantalla. Guardar un rango sería denormalizar un dato que caduca con cada partida nueva.
- La fecha visible (`11/05/2026`) se formatea en el cliente desde `created_at` con `es-ES`.
- Todos los `fetch` al ranking llevan `cache: "no-store"`: un ranking cacheado mostraría marcas viejas justo después de guardar una nueva.
- `lib/leaderboard.ts` y su tipo `ScoreRow` desaparecen; `Score` lo reemplaza.

## Implementation plan

1. Aplicar la migración `create_games_and_scores`: las dos tablas, el índice `scores_game_id_score_idx`, las tres políticas RLS y la semilla de los 8 juegos de `lib/games.ts` en `games`. Prueba: `games` tiene 8 filas y `scores` 0; un `insert` anónimo en `scores` funciona y un `update` anónimo sobre esa misma fila es rechazado por RLS.
2. Crear `lib/scores.ts` con los tipos `Score`, `ScoresResponse`, `SubmitScoreBody` y `SubmitScoreResponse`. Sin lógica. Prueba: `npm run build` sigue pasando.
3. Crear `app/api/scores/route.ts` con el `GET`: lee `?game=<id>`, rechaza con 400 si falta o no corresponde a ningún juego de `GAMES`, y consulta el top 10 (`game_id`, orden por `score desc`, `limit 10`) con el cliente de `lib/supabase/server.ts`. Prueba: `curl "localhost:3000/api/scores?game=rocas"` devuelve `{"ok":true,"scores":[]}`; sin `game` o con `game=noexiste` devuelve 400.
4. Añadir el `POST` al mismo archivo: valida `SubmitScoreBody` (juego existente, `player_name` de 1–10 caracteres tras recortar espacios, `score` entero entre 0 y 10 000 000), inserta la fila y responde `{ ok: true }`. Prueba: un `POST` válido crea la fila y el `GET` del paso 3 ya la devuelve; cuerpos inválidos responden 400 y no insertan nada.
5. Reescribir `app/leaderboard/page.tsx` para consumir el `GET`: pestaña ROCAS activa y las otras 7 como `<button disabled>`, estados de carga y error, y la tabla de hasta 10 filas con el rango derivado del índice. Añadir la regla `.chip:disabled` a `app/globals.css`. Prueba: la pantalla muestra las filas reales insertadas en el paso 4 y las 7 pestañas no se pueden seleccionar.
6. Añadir el podio parcial y el estado vacío: 0 marcas muestra el bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL PRIMERO" con enlace a `/games/rocas/play` y oculta podio y tabla; 1 marca dibuja solo el escalón de oro; 2, oro y plata. Estilos del bloque vacío en `app/globals.css`. Prueba: borrando y reinsertando filas se recorren los cuatro casos (0, 1, 2, 3+).
7. Calcular la fila "TU MEJOR MARCA": si hay sesión y alguna fila del top coincide con `user.name`, se muestra con su puesto real; si no hay coincidencia, la sección no se renderiza. Prueba: con sesión "PX_KAI" y una marca a ese nombre aparece la fila; con un nombre sin marcas, no aparece.
8. Conectar `components/GamePlayer.tsx`: al pulsar "GUARDAR PUNTUACIÓN", si `game.id === "rocas"` se hace `POST /api/scores` con el botón deshabilitado mientras se envía y mensaje de error con reintento si falla; los otros 7 juegos siguen llamando a `saveScore` sin cambios. Prueba: terminar una partida de ROCAS y guardar inserta la fila en Supabase; terminar una de CAÍDA sigue escribiendo en `av_scores` de `localStorage`.
9. Reescribir la barra lateral de `app/games/[id]/page.tsx` para consumir `GET /api/scores` con el origen derivado de `headers()` y `cache: "no-store"`: top 10 real en ROCAS, bloque vacío cuando no hay marcas y en los otros 7 juegos, y "Mejor global" tomado de la primera fila del top en ROCAS. Prueba: `/games/rocas` muestra las marcas reales y su máximo real; `/games/caida` muestra el bloque vacío conservando las dos columnas.
10. Eliminar `lib/leaderboard.ts`, que ya no importa ni `/leaderboard` ni `/games/[id]`. Prueba: `grep -r "seededScores\|lib/leaderboard"` no devuelve nada y `npm run build` pasa.
11. Cierre: `npm run lint` y `npm run build` sin errores, y prueba end-to-end con Playwright MCP — jugar ROCAS, terminar con el botón "FIN", guardar la puntuación, navegar a `/leaderboard` y a `/games/rocas`, y verificar que la marca aparece en ambas con el nombre y la puntuación correctos.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] La tabla `games` contiene exactamente 8 filas y sus `id` coinciden uno a uno con los de `GAMES` en `lib/games.ts`.
- [ ] La tabla `scores` queda vacía tras la migración: ninguna fila sembrada, ni de ejemplo ni de prueba.
- [ ] Existe el índice `scores_game_id_score_idx` sobre `(game_id, score desc)`.
- [ ] Con RLS activo, un cliente anónimo puede hacer `select` en `games` y `scores`, e `insert` en `scores`.
- [ ] Con RLS activo, un cliente anónimo **no** puede hacer `update` ni `delete` en `scores`, ni `insert` en `games`.
- [ ] Insertar una fila con `player_name` vacío, de más de 10 caracteres, o con `score` negativo o mayor que 10 000 000 es rechazado por la base de datos aunque se salte el endpoint.
- [ ] `GET /api/scores?game=rocas` devuelve `{ ok: true, scores: [...] }` con como máximo 10 filas, ordenadas por `score` de mayor a menor.
- [ ] `GET /api/scores` sin el parámetro `game`, o con un `game` que no existe en `GAMES`, responde 400 con `{ ok: false, error }`.
- [ ] `POST /api/scores` con un cuerpo válido inserta la fila y el `GET` posterior ya la devuelve.
- [ ] `POST /api/scores` responde 400 y no inserta nada cuando el juego no existe, el nombre queda vacío tras recortar espacios, el nombre supera 10 caracteres, o `score` no es un entero dentro del rango.
- [ ] En `/leaderboard` la pestaña ROCAS aparece seleccionada por defecto.
- [ ] Las otras 7 pestañas están atenuadas, marcadas como "PRÓXIMAMENTE" y no responden al click.
- [ ] Con `scores` vacía, `/leaderboard` muestra el bloque "AÚN NO HAY MARCAS REGISTRADAS · SÉ EL PRIMERO" con enlace a `/games/rocas/play`, y no dibuja podio ni tabla.
- [ ] Con exactamente 1 marca se dibuja solo el escalón de oro; con 2, oro y plata; con 3 o más, el podio completo.
- [ ] La tabla nunca muestra más de 10 filas.
- [ ] Los rangos son consecutivos empezando en `#01` y se derivan del orden de las filas, no de un valor guardado.
- [ ] La fecha de cada fila se muestra como `dd/mm/aaaa` a partir de `created_at`.
- [ ] Mientras la petición está en curso, la pantalla muestra un estado de carga en vez de una tabla vacía.
- [ ] Si `GET /api/scores` falla, la pantalla muestra un mensaje de error visible en vez de un salón vacío silencioso.
- [ ] Con sesión iniciada y al menos una marca a ese nombre, aparece la fila "TU MEJOR MARCA" con el puesto real de esa marca.
- [ ] Sin sesión iniciada, o con una sesión cuyo nombre no tiene ninguna marca, la fila "TU MEJOR MARCA" no se renderiza.
- [ ] `/games/rocas` muestra en la barra lateral el mismo top 10 real que `/leaderboard`, sin nombres inventados.
- [ ] `/games/rocas` muestra en "Mejor global" la puntuación más alta real de `scores`, o "———" si no hay ninguna marca.
- [ ] Las pantallas de detalle de los otros 7 juegos muestran el bloque vacío en la barra lateral, conservando el layout de dos columnas, y siguen mostrando su `game.best` decorativo.
- [ ] Ninguna pantalla consulta la tabla `scores` directamente: el cliente de Supabase aparece únicamente en `app/api/scores/route.ts`.
- [ ] La pantalla de detalle construye la URL absoluta del `fetch` a partir de `headers()`, sin ninguna variable de entorno nueva.
- [ ] Guardar una marca nueva y recargar `/leaderboard` o `/games/rocas` la muestra de inmediato, sin respuesta cacheada.
- [ ] Terminar una partida de ROCAS y pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con el nombre y la puntuación reales de esa partida.
- [ ] Mientras ese guardado está en curso el botón queda deshabilitado, y si el `POST` falla se muestra un error con opción de reintentar.
- [ ] Guardar una puntuación de ROCAS **no** escribe nada en `av_scores` de `localStorage`.
- [ ] Terminar y guardar una partida de cualquiera de los otros 7 juegos sigue escribiendo en `av_scores` y **no** crea ninguna fila en `scores`.
- [ ] El archivo `lib/leaderboard.ts` no existe y `grep -r "seededScores\|lib/leaderboard"` no devuelve resultados en el código de la aplicación.
- [ ] Ninguna pantalla muestra nombres de jugador o puntuaciones que no provengan de la tabla `scores`.

## Decisions

- **Sí:** Supabase como origen del ranking. Un leaderboard que solo ve el jugador que lo generó no es un leaderboard; `localStorage` no puede compartir marcas entre visitantes.
- **No:** leer `av_scores` de `localStorage` para alimentar el salón. Era la opción barata, pero produce un ranking privado por navegador.
- **No:** híbrido Supabase + `localStorage` con fallback. Duplica la lógica de lectura para cubrir un caso (Supabase caído) que hoy no aporta nada.
- **Sí:** tabla `games` como espejo del tipo `Game`, sin `best` ni `plays`. Esos dos son valores decorativos inventados (`28450`, `"12.4K"`); meterlos en la base de datos los convertiría en datos con apariencia de reales.
- **Sí:** `lib/games.ts` sigue siendo la fuente de verdad de la UI. La tabla `games` existe para dar integridad referencial a `scores`; migrar las pantallas a leer de la base de datos volvería asíncronas rutas hoy estáticas y es otro spec.
- **Sí:** clave primaria de texto en `games` (`"rocas"`, `"bloque-buster"`). Es la clave natural que ya viaja en las URLs; un `bigint` paralelo obligaría a traducir en cada consulta.
- **Sí:** una fila por partida en `scores`, con el ranking como top 10 por puntuación.
- **No:** una fila por jugador+juego con upsert al superar el récord. Sin autenticación real, "jugador" es texto libre: cualquiera podría pisar la marca de otro escribiendo su nombre.
- **Sí:** el rango se deriva del orden de las filas, no se guarda. Un rango almacenado caduca con cada partida nueva.
- **Sí:** un único índice `(game_id, score desc)`. Cubre a la vez la consulta del ranking y la clave foránea, que Postgres no indexa por su cuenta.
- **Sí:** Route Handler `POST /api/scores` para escribir. Mismo patrón que `/api/contact` de SPEC 03, mantiene la validación fuera del navegador y deja el punto de entrada listo para cuando exista autenticación.
- **No:** insertar directamente desde el navegador con `lib/supabase/client.ts`. Habría dejado la validación en el cliente, donde no vale nada.
- **Sí:** **todas** las lecturas del ranking pasan por `GET /api/scores`, incluida la pantalla de detalle, que es un Server Component. Decisión explícita del usuario. El coste es un salto HTTP de la aplicación contra sí misma; la ganancia es que existe un único lugar en todo el proyecto que toca la tabla `scores`, y que el día que cambie la consulta solo hay un archivo que tocar.
- **No:** un helper compartido (`lib/scores.server.ts`) que consulte Supabase desde el Server Component. Era una petición menos, pero abría un segundo camino a los datos.
- **Sí:** el origen absoluto del `fetch` del Server Component se deriva de `headers()` (`host` + `x-forwarded-proto`). Una variable de entorno `NEXT_PUBLIC_SITE_URL` habría sido más corta, pero es la clase de configuración cuyo error solo se descubre al desplegar.
- **Sí:** `cache: "no-store"` en las lecturas del ranking. Una respuesta cacheada mostraría marcas viejas justo después de guardar una nueva.
- **Sí:** `insert` anónimo permitido en `scores`, acotado con constraints (`player_name` 1–10, `score` entre 0 y 10 000 000). Es la única forma de guardar marcas sin autenticación, y las constraints limitan el daño de una puntuación inventada.
- **No:** rate limiting, captcha o firma de puntuaciones. Sin autenticación no cierran el agujero, solo lo encarecen; se reevalúa cuando exista Auth.
- **Sí:** el login sigue siendo el simulacro de `localStorage`. Supabase Auth toca login, registro, sesión, `proxy.ts` raíz y todas las políticas RLS: es un spec entero, no un apéndice de este.
- **Sí:** solo ROCAS escribe al ranking real. Los otros 7 generan puntuación con un `setInterval` falso y llenarían la tabla de basura.
- **Sí:** los otros 7 siguen escribiendo en `av_scores`. Deja el proyecto con dos almacenes a la vez, aceptado a conciencia: quitarles el guardado dejaría su modal sin hacer nada.
- **Sí:** ROCAS escribe **solo** a Supabase. Duplicar la marca en un almacén que nadie lee no aporta nada.
- **Sí:** `scores` nace vacía, sin datos de ejemplo. Decisión explícita del usuario: si nadie ha jugado, el salón lo dice en vez de inventarlo.
- **Sí:** podio parcial y estado vacío explícito. Se dibujan solo los escalones con dueño.
- **No:** podio siempre completo con huecos "———". Muestra el esqueleto de un dato que no existe.
- **Sí:** las 8 pestañas visibles, con las 7 sin datos deshabilitadas y marcadas "PRÓXIMAMENTE". Dejarlas clickeables para llegar a un vacío sería una promesa rota.
- **Sí:** la barra lateral "MEJORES PUNTUACIONES" del detalle también pasa a datos reales. Era un segundo ranking falso, a un click del real; dejarlo habría puesto al sitio a contradecirse.
- **No:** eliminar esa barra lateral. Es un buen sitio para el ranking, y quitarla habría dejado el layout de dos columnas del CSS sin usar.
- **Sí:** "Mejor global" real en ROCAS, tomado de la primera fila del top 10 ya consultado. Sin ese cambio, el detalle mostraría `28.450` justo al lado de un ranking real encabezado por una cifra mucho menor.
- **Sí:** eliminar `lib/leaderboard.ts`. Código muerto cuyo único propósito era inventar datos.
- **Sí:** archivo `lib/scores.ts` solo con tipos, compartido entre las pantallas y el endpoint. Rompe con la convención de SPEC 03 (tipos locales a cada archivo) porque aquí ambos lados usan literalmente la misma forma y duplicarla invita a desincronizarlos.
- **Sí:** estados de envío y error en el modal de fin de partida de ROCAS. Guardar deja de ser instantáneo y pasa a ser una petición de red que puede fallar, igual que ocurrió con el formulario de SPEC 03.
- **Sí:** la fila "TU MEJOR MARCA" se calcula de verdad, aceptando que sin autenticación significa "la mejor marca de alguien que escribió tu mismo nombre".

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La clave publicable viaja en el bundle del navegador; cualquiera puede insertar puntuaciones falsas. | Constraints en la base de datos (`player_name` 1–10, `score` 0–10 000 000) y validación en el endpoint. Acotan el daño, no lo impiden. Se cierra cuando exista Supabase Auth. |
| Sin identidad real, dos personas pueden usar el mismo nombre y la fila "TU MEJOR MARCA" mostrar la marca de otro. | Aceptado y documentado. No hay solución sin autenticación. |
| El proyecto queda con dos almacenes de puntuaciones (`scores` en Supabase y `av_scores` en `localStorage`). | Frontera explícita y única: `game.id === "rocas"` va a Supabase, el resto a `localStorage`. Desaparece cuando los otros 7 juegos sean reales. |
| `/leaderboard` y `/games/[id]` pasan a depender de la red y pueden fallar donde antes siempre pintaban algo. | Estados de carga y de error explícitos, verificados en los criterios de aceptación. |
| La pantalla de detalle se vuelve dinámica: `headers()` y `cache: "no-store"` impiden su renderizado estático. | Aceptado. Es el precio de mostrar un ranking siempre fresco y de leer solo por el endpoint. |
| La migración toca la base de datos real, fuera del control de `git`. | Se aplica como migración con nombre (`create_games_and_scores`), de modo que quede registrada y sea reproducible; corregir requiere otra migración, no un `revert`. |
| `games` y `lib/games.ts` pueden desincronizarse al añadir un juego nuevo. | La clave foránea de `scores` falla de forma ruidosa si se intenta guardar una marca de un juego ausente en la tabla. |

## Lo que **no** entra en este spec

- Supabase Auth: login, registro y sesión real.
- Migrar `/games` y `/games/[id]` a leer los juegos desde la base de datos.
- Que los otros 7 juegos escriban al ranking real.
- Recalcular los valores `best` y `plays` de `lib/games.ts` a partir de `scores`.
- Anti-fraude más allá de constraints y validación: rate limiting, captcha, firma de puntuaciones.
- Moderación de marcas (borrar, editar).
- Paginación o histórico más allá del top 10.
- `proxy.ts` en la raíz para refrescar la sesión de Supabase.
- Realtime: el ranking no se actualiza solo.
- Tests automatizados.

Cada una, si llega, va en su propio spec.

---
name: spec-game
description: Diseña la spec para integrar un juego nuevo con su leaderboard real en Arcade Vault, siguiendo el patrón ya ejecutado en SPEC 04 (port del canvas) y SPEC 05 (ranking en Supabase). El juego puede venir de references/started-games/, de una ruta externa, o escribirse desde cero. No escribe código de aplicación, solo la spec.
disable-model-invocation: true
argument-hint: "<carpeta de started-games, ruta al juego, o descripción del juego>"
---

# /spec-game — Diseñador de specs de juegos con leaderboard

Esta skill produce **una spec**, no código. Su trabajo es convertir un juego canvas standalone (o una idea de juego) en un documento `specs/NN-slug.md` que `/spec-impl` pueda ejecutar paso a paso para dejar el juego jugable en `/games/<id>/play` y su ranking real visible en `/leaderboard` y en `/games/<id>`.

Es una versión especializada de `/spec`: el patrón técnico ya está decidido por `specs/04-asteroids-juego-real.md` y `specs/05-leaderboard-supabase.md`, así que **no se repite el interrogatorio completo**. Solo se pregunta lo que ese patrón no resuelve.

Tus respuestas deben ir en el mismo idioma que el prompt inicial.

## Filosofía

Portar un juego a esta plataforma no es "copiar `game.js` dentro de un componente". El original tiene globals de módulo, dibuja su propio HUD, gestiona su propio game over y asume que es dueño de la página. Aquí nada de eso vale: el HUD es de React, el fin de partida lo manda el modal de `GamePlayer`, y el componente se monta y desmonta.

La spec existe para que esas decisiones estén tomadas **antes** de escribir 600 líneas de canvas, no a mitad del port.

Lee `porting.md` (en este mismo directorio) antes de empezar: contiene el contrato React↔canvas, las costuras de la plataforma y las trampas conocidas de cada juego de `references/started-games/`.

## Flujo del comando

Sigue las seis fases en orden. **No saltes fases.** Si el usuario quiere ir más rápido, recuérdale que un port mal definido se paga en el canvas, que es lo caro de rehacer.

### Fase 1 — Contexto

Antes de preguntar nada:

1. Lee `CLAUDE.md` y `AGENTS.md`.
2. Lista `specs/` para ver la numeración existente.
3. Lee `specs/04-asteroids-juego-real.md` y `specs/05-leaderboard-supabase.md`. Son el patrón de referencia y la fuente de las decisiones heredadas.
4. Lee `porting.md` y `template.md` de este directorio.

Recuerda la regla de `AGENTS.md`: el proyecto pinea `next@16.2.11` / `react@19.2.4`, así que antes de describir cualquier código App Router en la spec hay que apoyarse en `node_modules/next/dist/docs/01-app/`. En este repo ya hay dos gotchas confirmados: `middleware.ts` se llama `proxy.ts`, y los `params` de ruta son `Promise` y se esperan con `await`.

### Fase 2 — Identificar la fuente del juego

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` viene vacío: lista las carpetas de `references/started-games/`, pregunta cuál quiere portar (o qué ruta externa, o qué juego escribir desde cero) y **para**. No continúes sin respuesta.

Resuelve el argumento a uno de estos tres modos:

**Modo A — carpeta de `references/started-games/`** (`02-asteroids`, `03-tetris`, `04-arkanoid`).
Lee, en este orden: el `CLAUDE.md` de esa carpeta (cada juego trae un resumen de arquitectura ya escrito, es el atajo), `index.html`, `game.js` y todo script hermano (`levels.js`, `assets/spritesheet.js`).

**Modo B — ruta externa** a un juego HTML5 canvas standalone.
Mismo análisis, sin `CLAUDE.md` previo. Si la ruta no existe o no hay un canvas, dilo y para.

**Modo C — desde cero.**
No hay fuente que leer. La spec describirá el juego a implementar y el plan dirá "implementar" donde los otros modos dicen "portar". Las preguntas de la Fase 3 siguen siendo las mismas.

En los modos A y B, anota del análisis (el detalle de qué buscar está en `porting.md`):

- Resolución interna del canvas y si está en constantes o derivada.
- Unidades de `dt` (segundos o milisegundos) y si está capado.
- Si el HUD se dibuja en el canvas o en el DOM.
- Qué overlays internos hay (game over, pausa, botones dibujados).
- Forma del input: `e.code` o `e.key`, si hay ratón.
- Scripts hermanos y assets externos (imágenes, sonidos).
- Si existe una función de reinicio total o hay que escribirla.

Resume ese análisis al usuario en media docena de líneas antes de pasar a preguntar. Así ve de dónde salen las preguntas.

### Fase 3 — Preguntas acotadas

Pregunta en bloques de 3 a 5, esperando respuesta antes de seguir. Numera las preguntas. Cuando ofrezcas opciones, da 2–4 y marca cuál recomiendas y por qué.

Estas son las ocho cosas que el patrón **no** decide y que hay que cerrar:

1. **Slot.** ¿Reutiliza una entrada existente de `GAMES` en `lib/games.ts` (`caida`, `bloque-buster`, `serpentina`…) o se añade un `Game` nuevo? Si es nuevo, hacen falta `id`, `title`, `cat`, `color`, `short` y `long`. Recomienda reutilizar cuando haya un slot que ya describa ese juego: SPEC 04 lo hizo con `rocas` y evitó tocar la biblioteca.

2. **Resolución y encaje.** `.crt-screen` es `aspect-ratio: 4 / 3`. Si el juego no es 4:3 (Tetris es 300×600, es decir 1:2), hay que elegir: (a) letterbox — canvas 800×600 con el tablero centrado y bandas laterales, conservando intacta la matemática original; (b) `aspect-ratio` propio por juego, tocando el CSS del marco CRT. **Pregunta siempre esto y no lo asumas**: de ello depende si las colisiones del original siguen siendo válidas.

3. **HUD.** El HUD de React tiene tres huecos: Puntuación, Vidas y Nivel. ¿Qué mapea a cada uno? Si el juego tiene una métrica que no encaja (líneas en Tetris) hay que decidir si sustituye a "Vidas", si se añade un hueco al HUD, o si se descarta.

4. **Controles.** Qué teclas usa, cuáles necesitan `preventDefault` para no hacer scroll de la página, y si hay ratón (Arkanoid mueve la pala con `mousemove`). Si el original usa `e.key`, decide si se normaliza a `e.code` como el resto del proyecto.

5. **PAUSA / FIN / JUGAR DE NUEVO.** Confirma la semántica heredada de SPEC 04: `paused` congela de verdad el loop (deja de invocarse `update(dt)`, el último frame queda estático), `forceGameOver()` equivale a perder la última vida, y `restart()` arranca una partida limpia. Si el juego no tiene un reinicio total propio (Arkanoid no lo tiene: nunca reinicia puntuación ni vidas), señala que hay que escribirlo.

6. **Assets.** ¿Sprites, spritesheets, sonidos? Van a `public/games/<id>/` y se referencian con rutas absolutas desde el componente. Pregunta también si el arranque debe esperar a que carguen (Arkanoid arranca dentro de `loadSpritesheet(cb)`) y qué se dibuja mientras tanto.

7. **Ranking.** ¿Este juego escribe al ranking real de Supabase o se queda con el `av_scores` de `localStorage` como los otros 7? Recomienda el real: es el objetivo de la skill. Si es real, su `id` **tiene que existir** en la tabla `public.games`, porque `scores.game_id` es clave foránea.

8. **Qué se elimina del original.** HUD interno, overlay de GAME OVER, reinicio con Espacio, toggle de tema, botones dibujados dentro del canvas. Todo eso choca con el chasis de React y se retira. Confírmalo caso por caso con lo que hayas encontrado en la Fase 2.

**Cuándo dejar de preguntar.** Cuando puedas responder sin asumir nada:

1. ¿Qué ficheros aparecen o cambian?
2. ¿Cuál es el primer paso ejecutable y cuál el último?
3. ¿Cómo verifico que está terminado?

### Fase 4 — Detectar el estado de la plataforma

Antes de redactar el plan, comprueba dos cosas del repo. Son las que hacen que la spec generada sea distinta la primera vez y las siguientes.

**a) ¿Existe `components/games/registry.ts`?**

- **No existe** (estado inicial del repo): hoy `"rocas"` está hardcodeado en cuatro sitios — `components/GamePlayer.tsx` (`const isAsteroids = game.id === "rocas"`, usado en el render, en `endGame` y en `submitScore`, más los dos efectos del simulador falso), `app/leaderboard/page.tsx` (`ACTIVE_GAME_ID` / `ACTIVE_GAME_TITLE` y el `HallEmpty` que enlaza fijo a `/games/rocas/play`) y `app/games/[id]/page.tsx` (`ROCAS_ID` / `isRocas` para "Mejor global"). SPEC 04 dejó el motor genérico explícitamente fuera de alcance, para el día que hubiera un segundo juego real. **Ese día es este.** Incluye el Bloque A del plan (ver `template.md`) y anótalo en `Depende de:` y en las decisiones.
- **Ya existe**: la plataforma ya está generalizada por una spec anterior. **Omite el Bloque A.** El plan solo añade la entrada al registry. Dilo explícitamente en la spec ("la plataforma ya está generalizada por SPEC NN") para que se vea que la omisión es deliberada.

**b) ¿Tiene el juego fila en `public.games`?**

Usa el MCP de Supabase para comprobarlo. Los 8 `id` actuales de `lib/games.ts` ya están sembrados por la migración `create_games_and_scores`; un `id` nuevo no. Si falta, el plan necesita un paso de migración con nombre, y ese paso va **antes** del primer `POST /api/scores`.

Reporta al usuario el resultado de ambas comprobaciones antes de seguir.

### Fase 5 — Desarrollar la spec sección por sección

**No generes la spec entera de una vez.** Desarrolla las secciones de `template.md` una a una, mostrándolas en markdown y esperando confirmación antes de pasar a la siguiente:

1. **Cabecera** (estado, dependencias, fecha, objetivo en una sola frase).
2. **Scope** (lo que entra y lo que no; el "no entra" es obligatorio).
3. **Data model** (el contrato React↔canvas con el nombre real del juego, el estado interno, las constantes portadas).
4. **Implementation plan** (Bloque A si toca, y Bloque B siempre).
5. **Acceptance criteria** (checklist booleana).
6. **Decisions** (las heredadas más las propias del juego).
7. **Risks** (los heredados más los propios).
8. **Lo que no entra en este spec** (repetición final deliberada).

Después de cada sección pregunta: "¿Esta sección se queda así o la ajustamos?". Aplica los cambios y vuelve a mostrarla si los pide. Solo avanza con confirmación.

**Errores a evitar:**

- Criterios de aceptación no verificables ("que el juego se sienta fluido").
- Pasos del plan que no están en el scope.
- Un solo paso gigante "portar el juego": el port se trocea por sistemas (nave, disparos, colisiones, niveles…), como hizo SPEC 04 en diez pasos, cada uno con su prueba manual.
- Asumir nombres de fichero o de clase que el usuario no confirmó.

### Fase 6 — Guardar

Con todas las secciones confirmadas:

1. Determina el número siguiente mirando `specs/`. Si la última es `05-leaderboard-supabase.md`, esta es `06-`.
2. Genera un slug corto a partir del objetivo (por ejemplo `tetris-juego-real`).
3. Pregunta al usuario si el nombre de fichero propuesto le sirve **antes** de escribirlo.
4. Crea `specs/NN-slug.md` con las secciones aprobadas.
5. Marca el estado como `Borrador`. **No lo marques como `Aprobado`** — eso lo hace la persona cuando lo relee.
6. Confirma con este bloque:

```
✅ Spec creada.

Fichero: specs/NN-slug.md
Estado:  Borrador

Siguiente paso: reléela y, si te convence, cambia el estado a "Aprobado"
a mano. Después ejecuta:

  /spec-impl NN-slug
```

## Reglas duras

- **Nunca escribas código de aplicación en este comando.** Solo el `.md` de la spec al final. Nada de `components/`, `lib/`, `app/`, CSS ni migraciones.
- **Nunca generes la spec entera en una sola respuesta.** Sección a sección, con confirmación.
- **Nunca asumas el encaje 4:3 ni el mapeo del HUD.** Son las dos preguntas que más caro salen si se aciertan por casualidad.
- **Nunca marques la spec como `Aprobado`.**
- **Nunca toques `skills-lock.json`.** Lo gestiona el instalador `npx skills` y guarda hashes de contenido.
- **Nunca propongas tocar `app/api/scores/route.ts`, `lib/scores.ts`, `lib/supabase/*` ni `app/games/[id]/play/page.tsx`.** Ya son genéricos por `game_id`; si crees que hace falta cambiarlos, es señal de que el diseño se ha torcido.
- **Si el usuario pide algo fuera de alcance** (multijugador, controles táctiles, autenticación real), recuérdale que va en su propia spec y anótalo en el "no entra".

## Tono al preguntar

Sé directo y concreto. No te disculpes por preguntar: el usuario invocó esta skill precisamente para que preguntes. Una pregunta por línea cuando hay varias, numeradas.

Ejemplo de bloque bien formado:

> Antes del modelo de datos necesito cerrar tres cosas:
>
> 1. **Encaje.** El tablero es 300×600 (1:2) y `.crt-screen` es 4:3. ¿Letterbox dentro de un canvas 800×600 (recomendado: no toca ni una línea de la matemática original) o `aspect-ratio` propio para este juego (toca el CSS del marco CRT)?
> 2. **HUD.** Tetris lleva puntuación, líneas y nivel, pero no vidas. ¿"Líneas" ocupa el hueco de "Vidas", añadimos un cuarto hueco al HUD, o se descarta?
> 3. **Slot.** ¿Reutilizamos la entrada `caida` que ya existe en `lib/games.ts` (recomendado: su ficha ya describe Tetris) o creamos un `Game` nuevo?

## Resumen del comportamiento esperado

```
/spec-game 03-tetris

  Fase 1  →  Lee CLAUDE.md, specs/04 y specs/05, porting.md y template.md
  Fase 2  →  Modo A. Lee 03-tetris/{CLAUDE.md,index.html,game.js}
             Anota: 300×600, dt en ms acumulado, HUD en DOM, overlay en DOM,
             e.code, sin assets, init() sí reinicia todo
  Fase 3  →  Pregunta encaje 4:3, mapeo de "líneas", slot (caida?), etc.
  Fase 4  →  registry.ts NO existe → la spec incluirá el Bloque A
             public.games ya tiene la fila "caida" → sin migración
  Fase 5  →  Ocho secciones, una a una, con confirmación
  Fase 6  →  specs/06-tetris-juego-real.md en estado Borrador

/spec-game            (sin argumento)

  Fase 2  →  Lista 02-asteroids, 03-tetris, 04-arkanoid
             Pregunta cuál (o qué ruta, o qué juego nuevo) y PARA
```

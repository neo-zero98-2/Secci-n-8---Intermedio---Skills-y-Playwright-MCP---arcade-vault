# Plantilla de spec de juego

Referencia que consulta `/spec-game` al generar la spec. **No es texto para copiar literalmente**:
es la forma que la spec debe respetar, con los huecos `<…>` que se rellenan con lo respondido en la
Fase 3. Las partes marcadas como _heredadas_ ya están decididas por SPEC 04 / SPEC 05 y se arrastran
tal cual salvo que el usuario diga lo contrario.

Respeta además las reglas globales de `.agents/skills/spec/template.md`: una idea por frase, nombres
de fichero concretos, sin TODOs, sin funciones completas dentro de la spec.

---

## Cabecera

```markdown
# SPEC NN — <Juego> real en el slot "<TÍTULO>"

> **Estado:** Borrador
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** YYYY-MM-DD
> **Objetivo:** <Una sola frase: portar X a un componente cliente que reemplaza el simulador falso en /games/<id>/play y conecta su puntuación al ranking real de Supabase.>
```

Si el Bloque A entra en el plan, la cabecera lo anuncia en el objetivo o en una frase de la sección
"Por qué este spec": esta spec además generaliza la plataforma para N juegos reales.

---

## Por qué este spec (opcional, recomendada la primera vez)

Media docena de líneas. Úsala cuando la spec rompe un patrón o toma una decisión no obvia — por
ejemplo, cuando incluye el Bloque A: SPEC 04 dejó el motor genérico explícitamente fuera de alcance
"hasta que exista un segundo juego real", y esta spec es ese momento.

---

## Scope

Dos bloques, ambos obligatorios.

```markdown
## Scope

**Incluye:**

- <El componente nuevo y qué porta exactamente.>
- <La entrada en lib/games.ts y la portada .cover-<id>.>
- <El registro en components/games/registry.ts.>
- <La fila en public.games, si el id es nuevo.>
- <La generalización del Bloque A, si toca.>

**Fuera de alcance (para specs futuros):**

- Controles táctiles en pantalla para móvil.
- Que los juegos restantes escriban al ranking real.
- Autenticación real (el login sigue siendo el simulacro de localStorage).
- Tests automatizados.
```

El "fuera de alcance" recoge lo que salió en las preguntas y se decidió aplazar. Sin ese registro,
durante la implementación habrá tentación de colarlo "ya que estamos".

---

## Data model

El contrato React↔canvas con el nombre real del juego, el estado interno y las constantes portadas.
Está detallado en `porting.md`; aquí va la versión concreta de este juego:

```markdown
## Data model

No se añaden tipos a `lib/`. Todo es local a `components/games/<Nombre>Game.tsx`.

**Contrato del componente:**

\`\`\`ts
type <Nombre>GameHandle = { restart: () => void; forceGameOver: () => void };
type <Nombre>GameProps = {
paused: boolean;
onScoreChange: (score: number) => void;
onLivesChange: (lives: number) => void;
onLevelChange: (level: number) => void;
onGameOver: (finalScore: number) => void;
ref?: Ref<<Nombre>GameHandle>;
};
\`\`\`

**Estado interno (en refs, nunca en `useState`):**

\`\`\`ts
type GameState = { <campos reales del juego>, score, lives, level, phase };
\`\`\`

**Constantes portadas sin cambio de valor:** `<W>`, `<H>`, `<…>`.
```

Si el Bloque A entra, añade aquí la forma del registry:

```ts
// components/games/registry.ts
type RealGame = { component: ComponentType<GameProps> /* … */ };
export const REAL_GAMES: Record<string, RealGame>;
```

---

## Implementation plan

Pasos numerados. Cada uno deja el sistema funcionando y es commiteable por separado (la convención
del repo es un commit por paso: `feat(specN): pasoN <descripción>`). Si un paso pide más de 30–50
líneas, pártelo.

### Bloque A — Generalización de la plataforma

**Incluir solo si `components/games/registry.ts` no existe todavía.** Si ya existe, omitir el
bloque entero y decirlo explícitamente en el scope y en las decisiones.

```markdown
1. Crear `components/games/registry.ts`: mapa `id → componente` como única fuente de verdad de qué
   juegos son reales. Prueba: `npm run build` pasa y `/games/rocas/play` sigue igual.
2. `components/GamePlayer.tsx`: sustituir `const isAsteroids = game.id === "rocas"` por la consulta
   al registry en sus tres usos (render, `endGame`, `submitScore`) y en los dos efectos del
   simulador falso. Prueba: ROCAS sigue jugándose igual y CAÍDA sigue con la arena decorativa.
3. `app/leaderboard/page.tsx`: `ACTIVE_GAME_ID`/`ACTIVE_GAME_TITLE` pasan a ser estado de pestaña
   sobre los juegos del registry; el resto siguen `disabled` con "PRÓXIMAMENTE"; `HallEmpty` se
   parametriza por juego. Prueba: con un solo juego real la pantalla se ve exactamente igual que
   antes.
4. `app/games/[id]/page.tsx`: `ROCAS_ID`/`isRocas` → "Mejor global" real para cualquier juego del
   registry, decorativo para el resto. Prueba: `/games/rocas` y `/games/caida` sin cambios visibles.
```

El Bloque A no debe cambiar nada de lo que el usuario ve: es un refactor. Que las pruebas de sus
pasos digan "sigue igual" es la señal de que está bien planteado.

### Bloque B — El juego

```markdown
5. Fila en `public.games` vía migración con nombre (MCP de Supabase), si el `id` es nuevo. Prueba:
   la tabla tiene la fila y un `POST /api/scores` con ese `game_id` ya no falla por clave foránea.
6. Entrada en `lib/games.ts` y clase `.cover-<id>` en `app/globals.css`, invocando
   `/frontend-design`. Prueba: la tarjeta aparece en `/games` con su portada.
7. Assets a `public/games/<id>/`, si los hay. Prueba: se sirven en esa ruta.
8. Portar la lógica a `components/games/<Nombre>Game.tsx` **en varios pasos, uno por sistema del
   juego** (SPEC 04 lo hizo en seis: canvas vacío, nave e input, disparos, asteroides y colisiones,
   vidas y niveles, power-ups). Cada paso con su prueba manual concreta.
9. Registrar el juego en `registry.ts` y conectar HUD, PAUSA, FIN y JUGAR DE NUEVO. Prueba: el HUD
   muestra datos reales, PAUSA congela, FIN abre el modal con la puntuación acumulada.
10. Cierre: `npm run lint` y `npm run build` sin errores, y prueba end-to-end con **Playwright MCP**
    — jugar, pausar, reanudar, terminar con FIN, guardar la puntuación y verificar que la marca
    aparece en `/leaderboard` y en `/games/<id>`.
```

---

## Acceptance criteria

Checklist booleana. La base se hereda de SPEC 04 y SPEC 05; añade encima los criterios propios del
juego (qué suma puntos, cuándo se sube de nivel, qué pasa al perder una vida).

```markdown
## Acceptance criteria

- [ ] `npm run build` y `npm run lint` corren sin errores.
- [ ] `/games/<id>/play` renderiza un `<canvas>` real dentro del marco CRT, no la arena decorativa.
- [ ] Los juegos que siguen siendo falsos no cambian de comportamiento.
- [ ] Las teclas del juego no provocan scroll de la página.
- [ ] El HUD superior refleja el estado real y no avanza solo cuando el jugador no hace nada.
- [ ] Dentro del canvas no se dibuja HUD alguno: la información aparece una sola vez.
- [ ] "PAUSA" congela el juego; "REANUDAR" continúa desde el mismo estado.
- [ ] "FIN" abre el modal con la puntuación acumulada hasta ese momento.
- [ ] Perder la última vida abre el modal, sin overlay "GAME OVER" propio del canvas.
- [ ] "JUGAR DE NUEVO" arranca una partida limpia.
- [ ] "SALIR" navega al detalle y al desmontar se cancela el `requestAnimationFrame` y se remueven
      los listeners de teclado.
- [ ] "GUARDAR PUNTUACIÓN" inserta una fila en `scores` con el nombre y la puntuación reales.
- [ ] La marca aparece después en `/leaderboard` y en la barra lateral de `/games/<id>`.
- [ ] En desarrollo (StrictMode) el juego no corre al doble de velocidad ni dispara dos veces.
- [ ] <criterios propios del juego>
```

Anti-patrones: "que se sienta fluido", "buena UX", "sin bugs". No son verificables.

---

## Decisions

Precarga las heredadas y añade las que salgan de las preguntas. Cada una con su razón breve.

```markdown
## Decisions

- **Sí:** el estado del juego vive en refs mutables y se dibuja por `requestAnimationFrame`.
  Re-renderizar React a 60 fps es inviable.
- **Sí:** los callbacks al HUD se emiten solo cuando el valor cambia, no en cada frame.
- **Sí:** un solo HUD, el de React. El canvas no dibuja puntuación, vidas ni nivel.
- **Sí:** un solo flujo de fin de partida, el modal de `GamePlayer`. Se desactivan el overlay
  interno y el reinicio con Espacio del original.
- **Sí:** el botón "PAUSA" congela de verdad el loop, no superpone un overlay decorativo.
- **Sí:** listeners de teclado en `window`, montados y desmontados con el componente, con
  `preventDefault()` en las teclas del juego.
- **Sí/No:** <encaje 4:3 elegido y por qué>.
- **Sí/No:** <mapeo del HUD elegido y por qué>.
- **Sí/No:** <slot reutilizado o nuevo y por qué>.
- **No:** tests automatizados. El proyecto sigue sin test runner; la verificación es manual más
  Playwright MCP.
```

Si el Bloque A entra, añade: **Sí:** extraer el registry ahora, porque SPEC 04 lo aplazó justo
hasta este momento; y **No:** seguir añadiendo ramas `if` por juego en los cuatro sitios.

---

## Risks

Tabla. Precarga los heredados y añade los propios del juego.

```markdown
| Riesgo                                                                | Mitigación                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Globals de módulo del original compartidos entre dos montajes         | Todo el estado se crea dentro del efecto; a nivel de módulo solo constantes y clases         |
| StrictMode monta el efecto dos veces en dev: loops y listeners dobles | Cleanup que cancela el `rAF` y quita los listeners; verificación explícita en dev            |
| `dt` enorme al volver de una pestaña en segundo plano (tunneling)     | Cap de `dt` portado del original                                                             |
| El canvas se escala por CSS y el ratio no coincide                    | <letterbox o aspect-ratio propio, según lo decidido>                                         |
| `next@16` / `react@19` posteriores a los datos de entrenamiento       | Leer `node_modules/next/dist/docs/01-app/` antes de escribir, como pide `AGENTS.md`          |
| La clave publicable viaja en el bundle: puntuaciones falsificables    | Constraints de la tabla y validación del endpoint. Acotan, no impiden. Sin Auth no se cierra |
```

---

## Lo que no entra en este spec

Repetición final deliberada de lo que no se hace, aunque el scope ya lo diga.

```markdown
## Lo que **no** entra en este spec

- Lógica real para los juegos restantes de la biblioteca.
- Controles táctiles en pantalla para móvil.
- Supabase Auth: login, registro y sesión real.
- Realtime: el ranking no se actualiza solo.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
```

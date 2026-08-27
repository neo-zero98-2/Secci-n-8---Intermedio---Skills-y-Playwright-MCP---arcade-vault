# SPEC 03 — About page y formulario de contacto con Resend

> **Estado:** Implemented
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-26
> **Objetivo:** Portar la pantalla "Acerca de" del prototipo (`about.jsx`) a la ruta `/about`, con el formulario de contacto conectado a un endpoint real que envía el mensaje por correo mediante Resend (modo sandbox).

## Scope

**Incluye:**

- Nueva ruta `/about` (`app/about/page.tsx`) portando `about.jsx` del template `references/templates/home-about/`: hero ("Acerca de Arcade Vault", misión, 3 highlights) + sección de contacto (intro, tips, formulario).
- Sección "ABOUT PAGE" de `references/templates/home-about/styles.css` (líneas ~1071–1620) portada a `app/globals.css`, agregada al final de la hoja (mismo patrón que SPEC 01/02, sin reescribir a Tailwind).
- Animación scroll-reveal (`IntersectionObserver`, clase `.reveal`/`.in`) en la sección de contacto, igual que el prototipo.
- Formulario de contacto (nombre, email, mensaje) como Client Component, con:
  - Validación en cliente: campos no vacíos + formato de email válido (regex) antes de habilitar el submit. Si falla, shake animation (igual que el prototipo) y mensaje de error puntual.
  - Estado "enviando…" mientras espera la respuesta: botón deshabilitado, spinner (clase `.spinner` ya existente en `globals.css`), texto "ENVIANDO…".
  - Estado de éxito: la terminal "VAULT-OS" del prototipo (sin cambios visuales), con botón "ENVIAR OTRO MENSAJE" que resetea el formulario.
  - Estado de error: si el envío falla, el formulario vuelve a ser editable conservando los valores escritos, con un mensaje de error visible (estilo consistente con el resto de la UI) y el botón "ENVIAR MENSAJE" reactivado para reintentar.
- Endpoint real `app/api/contact/route.ts` (Route Handler, POST): valida `name`/`email`/`msg` en servidor (no vacíos + formato de email), instancia el SDK `resend` con `RESEND_API_KEY`, envía el correo y responde éxito/error como JSON.
- Integración con Resend en modo sandbox: remitente `onboarding@resend.dev` (constante en el route handler, no es secreta), destinatario configurado en la variable de entorno `CONTACT_TO_EMAIL`. `RESEND_API_KEY` como variable sensible, en `.env.local` (ya cubierto por `.gitignore` → `.env*`).
- Dependencia nueva: paquete `resend` en `package.json`.
- Habilitar el link "Acerca de" en `components/Nav.tsx` (desktop y mobile): pasa de `<span className="disabled">` a `<Link href="/about">`, con estado activo cuando `pathname === "/about"`, siguiendo el mismo patrón que los demás links del Nav.
- Eliminar las reglas CSS `.av-nav .links span.disabled` y `.av-mobile-panel span.disabled` de `app/globals.css` (quedan sin uso al no haber ya ningún link deshabilitado en el Nav).

**Fuera de alcance (para specs futuros):**

- Protección anti-spam (honeypot, rate limiting, captcha).
- Header `Reply-To` con el email del visitante en el correo enviado.
- Persistencia de los mensajes de contacto (no se guardan en ningún storage ni base de datos; solo se envían por correo).
- Dominio propio verificado en Resend (queda en modo sandbox; migrar a dominio propio es solo cambiar constantes/env vars, no requiere spec).
- Rediseño o cambio de copy respecto al template `home-about/about.jsx`.
- Tests automatizados.

## Data model

No se agrega ningún archivo nuevo a `lib/`. Los tipos son locales a los dos archivos que los usan:

```ts
// app/about/page.tsx (o componente de contacto que importe, ej. components/ContactForm.tsx)
type ContactFormState = { name: string; email: string; msg: string };
type ContactStatus = "idle" | "sending" | "sent" | "error";
```

```ts
// app/api/contact/route.ts
type ContactRequestBody = { name: string; email: string; msg: string };
type ContactResponseBody = { ok: true } | { ok: false; error: string };

const FROM_EMAIL = "onboarding@resend.dev"; // sandbox Resend, no requiere dominio verificado
const TO_EMAIL = process.env.CONTACT_TO_EMAIL;
```

Variables de entorno (`.env.local`, no versionado — ya cubierto por `.gitignore` → `.env*`):

- `RESEND_API_KEY` → variable sensible, usada solo en `app/api/contact/route.ts` (server-side, nunca expuesta al cliente).
- `CONTACT_TO_EMAIL` → dirección destino de los mensajes de contacto (`hern98_500@hotmail.com` en desarrollo). No es secreta, pero queda como env var para poder cambiarla sin tocar código.
- Si `CONTACT_TO_EMAIL` no está definida, el endpoint responde error 500 (`ContactResponseBody = { ok: false, error: "..." }`) sin intentar llamar a Resend.

Convenciones:

- Validación de formato de email: mismo regex simple en cliente (`ContactFormState`) y servidor (`route.ts`) — algo como `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, sin librería externa.
- El endpoint no persiste nada; es una función pura request → envío por Resend → response.

## Implementation plan

1. Instalar la dependencia `resend` (`npm install resend`) y agregar `RESEND_API_KEY` y `CONTACT_TO_EMAIL` a `.env.local` (no versionado). Prueba: `npm run build` sigue funcionando igual que antes.
2. Crear `app/api/contact/route.ts` (POST): valida `ContactRequestBody` (campos no vacíos + regex de email); si falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL`, responde error 500 sin llamar a Resend; si la validación falla, responde error 400; si todo es válido, instancia `Resend`, envía el correo (`from: FROM_EMAIL`, `to: process.env.CONTACT_TO_EMAIL`) y responde `{ ok: true }` o `{ ok: false, error }` según el resultado. Prueba manual: golpear el endpoint con curl/Postman con body válido e inválido, confirmar los códigos de respuesta y que el correo llega a `CONTACT_TO_EMAIL`.
3. Portar la sección "ABOUT PAGE" de `references/templates/home-about/styles.css` al final de `app/globals.css`. Prueba: `npm run dev` sin errores de CSS.
4. Crear `app/about/page.tsx` portando el hero + misión + 3 highlights de `about.jsx` (formulario aún no funcional). Prueba: `/about` carga con el diseño neón correcto.
5. Implementar el formulario de contacto (Client Component, dentro de `app/about/page.tsx` o extraído a `components/ContactForm.tsx`) con estados `idle/sending/sent/error`, validación de no-vacío + formato de email, y `fetch("/api/contact", ...)`. Prueba: envío válido muestra "ENVIANDO…" y luego la terminal de éxito; datos inválidos hacen shake; un error forzado del endpoint muestra el estado de error y permite reintentar sin perder lo escrito.
6. Agregar la animación scroll-reveal (`IntersectionObserver`, clase `.reveal`/`.in`) a la sección de contacto. Prueba: al hacer scroll, la sección recibe `.in` y aparece con transición.
7. Habilitar "Acerca de" en `components/Nav.tsx` (desktop y mobile): reemplazar `<span className="disabled">` por `<Link href="/about">`, activo cuando `pathname === "/about"`; eliminar las reglas `.disabled` de `app/globals.css`. Prueba: click en "Acerca de" navega a `/about` y se marca activo.
8. Cierre: `npm run lint` y `npm run build` sin errores; prueba end-to-end con Playwright MCP navegando a `/about`, llenando y enviando el formulario, verificando el estado de éxito.

## Acceptance criteria

- [x] `npm run build` y `npm run lint` corren sin errores.
- [x] `/about` muestra el hero ("Acerca de Arcade Vault"), la misión y los 3 highlights, con el mismo diseño neón del template.
- [x] La sección de contacto muestra la intro, los 3 tips y el formulario (nombre, email, mensaje).
- [x] Enviar el formulario con algún campo vacío dispara la animación de shake y no llama al endpoint.
- [x] Enviar el formulario con un email de formato inválido dispara la animación de shake y no llama al endpoint.
- [x] Enviar el formulario con datos válidos deshabilita el botón y muestra el estado "ENVIANDO…" con spinner mientras espera la respuesta.
- [x] Si el envío es exitoso, se reemplaza el formulario por la terminal "VAULT-OS" con el nombre del remitente en mayúsculas.
- [x] "ENVIAR OTRO MENSAJE" en la terminal de éxito resetea el formulario a su estado inicial vacío.
- [x] Si el envío falla (ej. `RESEND_API_KEY` inválida o ausente), el formulario vuelve a estado editable conservando los valores escritos, muestra un mensaje de error visible y reactiva el botón "ENVIAR MENSAJE".
- [x] Un envío válido efectivamente llega como correo a la dirección configurada en `CONTACT_TO_EMAIL`.
- [x] El `Nav` (desktop y mobile) muestra "Acerca de" como link activo (no deshabilitado); click navega a `/about`.
- [x] El link "Acerca de" del `Nav` se marca activo únicamente cuando `pathname === "/about"`.
- [x] Las reglas CSS `.disabled` quedan eliminadas de `app/globals.css` y no queda ningún `<span className="disabled">` en `components/Nav.tsx`.
- [x] La sección de contacto con clase `.reveal` recibe la clase `.in` y aparece con transición al hacer scroll.

## Decisions

- **Sí:** ruta `/about` (no `/acerca-de`). Consistente con la convención de rutas en inglés ya usada en SPEC 01/02 (`/games`, `/leaderboard`), con copy visible en español.
- **Sí:** modo sandbox de Resend (`onboarding@resend.dev` como remitente), sin dominio propio verificado. Decisión explícita del usuario para este MVP; migrar a dominio propio después es solo cambiar el valor de `FROM_EMAIL`, no requiere spec nuevo.
- **No:** verificar un dominio propio en Resend en este spec. Queda diferido, no es necesario para el MVP.
- **Sí:** `CONTACT_TO_EMAIL` como variable de entorno (no hardcodeada). Decisión explícita del usuario para poder cambiar el destinatario sin tocar código, aunque no sea un dato sensible.
- **Sí:** `RESEND_API_KEY` como única variable realmente secreta, usada solo server-side en el route handler. Nunca se expone al cliente.
- **Sí:** validación de formato de email (regex simple) además de campos no vacíos, tanto en cliente como en servidor. Mejora sobre el prototipo (que solo valida no-vacío) sin agregar una librería externa.
- **No:** usar una librería de validación (zod, yup, etc.) para esto. Un regex simple alcanza para el alcance actual; evita una dependencia nueva innecesaria.
- **Sí:** agregar estado de error explícito en el formulario (mensaje + reintento), a diferencia del prototipo que no lo contempla. Necesario porque ahora hay una llamada de red real que puede fallar.
- **Sí:** agregar estado "enviando…" con spinner mientras se espera la respuesta del endpoint, a diferencia del prototipo (que muestra éxito instantáneo). Evita que el usuario haga doble submit y refleja que ahora hay latencia real de red.
- **No:** protección anti-spam (honeypot, rate limiting, captcha) en este spec. Decisión explícita del usuario; se agrega después si se vuelve un problema real.
- **No:** header `Reply-To` con el email del visitante. Decisión explícita del usuario; el correo llega solo con remitente sandbox.
- **No:** persistir los mensajes de contacto en ningún storage. El endpoint es una función pura de envío, igual que el resto del proyecto no tiene backend/DB.
- **Sí:** tipos `ContactFormState`/`ContactRequestBody`/`ContactResponseBody` locales a los archivos que los usan, sin agregarlos a `lib/`. Mismo criterio que SPEC 02 aplicó a los literales de Home: no se exportan porque ninguna otra pantalla los reutiliza.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Modo sandbox de Resend: si `CONTACT_TO_EMAIL` no coincide con la dirección registrada en la cuenta de Resend, el envío puede fallar aunque la API key sea válida | Documentar en el spec que en sandbox Resend limita el destinatario; si falla, el usuario ve el estado de error del formulario (no falla silenciosamente). |
| `RESEND_API_KEY` ausente o inválida en producción/deploy si no se configura `.env.local` (o el equivalente de variables de entorno del hosting) | El endpoint valida la presencia de `RESEND_API_KEY`/`CONTACT_TO_EMAIL` antes de llamar a Resend y responde error 500 explícito en vez de un fallo silencioso o un crash. |
| Este proyecto pinea `next@16.2.11`/`react@19.2.4`, versiones posteriores a los datos de entrenamiento — la sintaxis de Route Handlers (`app/api/.../route.ts`) puede diferir de Next 13–15 | Antes de escribir `app/api/contact/route.ts` durante `/spec-impl`, leer la guía correspondiente en `node_modules/next/dist/docs/01-app/`, tal como indica `AGENTS.md`. |
| Doble submit si el usuario hace click varias veces antes de que el estado "enviando…" deshabilite el botón (condición de carrera en React) | El botón se deshabilita de forma síncrona en el mismo handler que dispara el `fetch`, antes de cualquier `await`. |

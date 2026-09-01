## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Commands

```bash
npm run dev      # start dev server (Next.js, Turbopack unless configured otherwise)
npm run build    # production build
npm run start    # run production build
npm run lint     # ESLint (flat config in eslint.config.mjs, extends eslint-config-next)
```

## hooks personalizadas
se creo un hook personalizada para claude code, el hook se ejecuta cuando se termina la accion de claude y requiere que la persona le responda, al terminar claude code de la tarea o accion que haga se ejecuta automaticamente un sonido en formato mp3. El formato mp3 es un sonido que esta guardada en una carpeta llamada core ignorada por el proyecto

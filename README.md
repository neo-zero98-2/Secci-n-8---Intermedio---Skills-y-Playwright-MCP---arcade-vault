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

Se creó un hook personalizado para Claude Code. El hook se ejecuta cuando termina la acción de Claude y requiere que la persona le responda. Al terminar Claude Code la tarea o acción, se ejecuta automáticamente un sonido en formato MP3. El archivo MP3 se guarda en una carpeta llamada `core`, ignorada por el proyecto.

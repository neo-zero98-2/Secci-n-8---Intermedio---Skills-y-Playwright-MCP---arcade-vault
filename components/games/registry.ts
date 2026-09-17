import type { ComponentType, Ref } from "react";
import ArkanoidGame from "@/components/games/ArkanoidGame";
import AsteroidsGame from "@/components/games/AsteroidsGame";
import SnakeGame from "@/components/games/SnakeGame";
import TetrisGame from "@/components/games/TetrisGame";

// ── Contrato de motor ─────────────────────────────────────────────────────────
// Generalización del contrato que SPEC 04 definió para un único juego: lo único
// que cruza la frontera React ↔ canvas, sea cual sea el motor.

export type GameEngineHandle = {
  /** "JUGAR DE NUEVO": partida nueva desde cero. */
  restart: () => void;
  /** Botón "FIN": game-over inmediato con la puntuación acumulada. */
  forceGameOver: () => void;
};

export type GameEngineProps = {
  /** Botón "PAUSA": congela el loop; el último frame queda dibujado y estático. */
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLevelChange: (level: number) => void;
  /** Opcional: solo lo emiten los motores con vidas. */
  onLivesChange?: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
  ref?: Ref<GameEngineHandle>;
};

export type GameEngine = {
  Component: ComponentType<GameEngineProps>;
  /** `false` → GamePlayer no renderiza el `.hud-stat` de "Vidas". */
  hasLives: boolean;
  /** `true` → el canvas no es 4:3 y se centra a altura completa en el marco CRT. */
  fitHeight: boolean;
};

// ── Registro ──────────────────────────────────────────────────────────────────
// Único sitio del proyecto que declara qué juegos tienen motor real. Los que no
// aparecen aquí siguen con la arena decorativa y el simulador falso.
export const GAME_ENGINES: Record<string, GameEngine> = {
  rocas: { Component: AsteroidsGame, hasLives: true, fitHeight: false },
  caida: { Component: TetrisGame, hasLives: false, fitHeight: true },
  // 800×600 es el 4:3 exacto del marco CRT: no necesita `fitHeight`.
  "bloque-buster": {
    Component: ArkanoidGame,
    hasLives: true,
    fitHeight: false,
  },
  // Grilla de 32×24 celdas de 25 px: otros 800×600, tampoco necesita letterbox.
  serpentina: { Component: SnakeGame, hasLives: true, fitHeight: false },
};

export function getGameEngine(id: string): GameEngine | undefined {
  return GAME_ENGINES[id];
}

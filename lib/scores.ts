// Tipos compartidos entre app/api/scores/route.ts y las pantallas que consumen
// el ranking. Sin lógica: ambos lados usan literalmente la misma forma y
// duplicarla invitaría a desincronizarlos.

export type Score = {
  id: number;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string; // ISO 8601
};

export type ScoresResponse =
  | { ok: true; scores: Score[] }
  | { ok: false; error: string };

export type SubmitScoreBody = {
  game_id: string;
  player_name: string;
  score: number;
};

export type SubmitScoreResponse = { ok: true } | { ok: false; error: string };

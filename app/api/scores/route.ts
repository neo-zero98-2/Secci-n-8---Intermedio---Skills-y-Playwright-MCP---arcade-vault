import type { NextRequest } from "next/server";

import { GAMES } from "@/lib/games";
import type {
  Score,
  ScoresResponse,
  SubmitScoreBody,
  SubmitScoreResponse,
} from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";

// Único lugar del proyecto que consulta la tabla scores.

const TOP_LIMIT = 10;
const NAME_MAX = 10;
const SCORE_MAX = 10_000_000;

function isKnownGame(id: string) {
  return GAMES.some((game) => game.id === id);
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("game");

  if (!gameId || !isKnownGame(gameId)) {
    const res: ScoresResponse = { ok: false, error: "Juego no válido." };
    return Response.json(res, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scores")
    .select("id, game_id, player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(TOP_LIMIT);

  if (error) {
    const res: ScoresResponse = {
      ok: false,
      error: "No se pudo consultar el ranking.",
    };
    return Response.json(res, { status: 500 });
  }

  const res: ScoresResponse = { ok: true, scores: (data ?? []) as Score[] };
  return Response.json(res);
}

export async function POST(request: Request) {
  let body: Partial<SubmitScoreBody>;

  try {
    body = (await request.json()) as Partial<SubmitScoreBody>;
  } catch {
    const res: SubmitScoreResponse = { ok: false, error: "Cuerpo inválido." };
    return Response.json(res, { status: 400 });
  }

  const gameId = typeof body.game_id === "string" ? body.game_id : "";
  const playerName =
    typeof body.player_name === "string" ? body.player_name.trim() : "";
  const score = body.score;

  const invalid =
    !isKnownGame(gameId) ||
    playerName.length < 1 ||
    playerName.length > NAME_MAX ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > SCORE_MAX;

  if (invalid) {
    const res: SubmitScoreResponse = {
      ok: false,
      error: "Puntuación inválida.",
    };
    return Response.json(res, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: playerName, score });

  if (error) {
    const res: SubmitScoreResponse = {
      ok: false,
      error: "No se pudo guardar la puntuación.",
    };
    return Response.json(res, { status: 500 });
  }

  const res: SubmitScoreResponse = { ok: true };
  return Response.json(res);
}

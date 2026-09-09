import type { NextRequest } from "next/server";

import { GAMES } from "@/lib/games";
import type { Score, ScoresResponse } from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";

// Único lugar del proyecto que consulta la tabla scores.

const TOP_LIMIT = 10;

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

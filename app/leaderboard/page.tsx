"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import type { Score, ScoresResponse } from "@/lib/scores";

// Solo ROCAS tiene partidas reales; los otros 7 juegan con un setInterval falso
// y no escriben al ranking, así que sus pestañas quedan deshabilitadas.
const ACTIVE_GAME_ID = "rocas";

type LoadState = "loading" | "ready" | "error";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/scores?game=${ACTIVE_GAME_ID}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ScoresResponse;
      if (!data.ok) {
        setState("error");
        return;
      }
      setScores(data.scores);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    // Carga inicial contra la red (sistema externo). El estado se actualiza al
    // resolverse la petición, no de forma síncrona.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const retry = () => {
    setState("loading");
    load();
  };

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) =>
          g.id === ACTIVE_GAME_ID ? (
            <button key={g.id} className="chip active" aria-current="true">
              {g.title}
            </button>
          ) : (
            <button key={g.id} className="chip" disabled>
              {g.title}
              <span className="soon">PRÓXIMAMENTE</span>
            </button>
          ),
        )}
      </div>

      {state === "loading" && (
        <div className="hall-state">
          <span className="spinner" />
          <p className="pixel" style={{ fontSize: 10 }}>
            CARGANDO MARCAS…
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="hall-state">
          <p
            className="pixel"
            style={{
              color: "var(--magenta)",
              fontSize: 10,
              letterSpacing: "0.06em",
            }}
          >
            ⚠ NO SE PUDO CARGAR EL RANKING.
          </p>
          <button className="btn magenta" onClick={retry}>
            REINTENTAR
          </button>
        </div>
      )}

      {state === "ready" && (
        <div className="hall-table">
          <div className="th">
            <div>RANGO</div>
            <div>JUGADOR</div>
            <div>PUNTUACIÓN</div>
            <div>FECHA</div>
          </div>
          {scores.map((s, i) => (
            <div
              key={s.id}
              className={
                "tr" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">{s.player_name}</div>
              <div className="sc">{s.score.toLocaleString("es-ES")}</div>
              <div className="dt">{formatDate(s.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

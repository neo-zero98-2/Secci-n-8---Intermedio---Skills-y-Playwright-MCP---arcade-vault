"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GAMES } from "@/lib/games";
import type { Score, ScoresResponse } from "@/lib/scores";
import { useSession } from "@/lib/session";

// Solo ROCAS tiene partidas reales; los otros 7 juegan con un setInterval falso
// y no escriben al ranking, así que sus pestañas quedan deshabilitadas.
const ACTIVE_GAME_ID = "rocas";
const ACTIVE_GAME_TITLE =
  GAMES.find((g) => g.id === ACTIVE_GAME_ID)?.title ?? "";

type LoadState = "loading" | "ready" | "error";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Solo se dibujan los escalones que tienen dueño: 1 marca es oro a solas,
// 2 son oro y plata. Un podio con huecos "———" enseñaría el esqueleto de un
// dato que no existe.
function PodiumSlot({ score, place }: { score: Score; place: 1 | 2 | 3 }) {
  const tier = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  const champion = place === 1;

  return (
    <div className={`podium-slot ${tier}`}>
      {champion && (
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--gold)",
            letterSpacing: "0.18em",
          }}
        >
          CAMPEÓN
        </div>
      )}
      <div
        className="rank-num"
        style={champion ? { fontSize: 36, marginTop: 4 } : undefined}
      >
        {String(place).padStart(2, "0")}
      </div>
      <div className="name">{score.player_name}</div>
      <div className="score" style={champion ? { fontSize: 20 } : undefined}>
        {score.score.toLocaleString("es-ES")}
      </div>
      <div className="date">{formatDate(score.created_at)}</div>
    </div>
  );
}

function Podium({ scores }: { scores: Score[] }) {
  const [first, second, third] = scores;

  if (scores.length === 1) {
    return (
      <div className="podium solo">
        <PodiumSlot score={first} place={1} />
      </div>
    );
  }

  if (scores.length === 2) {
    return (
      <div className="podium duo">
        <PodiumSlot score={first} place={1} />
        <PodiumSlot score={second} place={2} />
      </div>
    );
  }

  return (
    <div className="podium">
      <PodiumSlot score={second} place={2} />
      <PodiumSlot score={first} place={1} />
      <PodiumSlot score={third} place={3} />
    </div>
  );
}

// Sin autenticación real, "tu marca" significa "la mejor marca de alguien que
// escribió tu mismo nombre". Si ese nombre no aparece en el top, no se renderiza
// nada: es preferible a inventar un puesto.
function YourBest({ scores, name }: { scores: Score[]; name?: string }) {
  if (!name) return null;

  const index = scores.findIndex((s) => s.player_name === name);
  if (index === -1) return null;

  const best = scores[index];

  return (
    <>
      <div className="tr you-label">▸ TU MEJOR MARCA EN {ACTIVE_GAME_TITLE}</div>
      <div
        className="tr you"
        style={{ animationDelay: `${scores.length * 50 + 50}ms` }}
      >
        <div className="rk" style={{ color: "var(--yellow)" }}>
          #{String(index + 1).padStart(2, "0")}
        </div>
        <div className="pl" style={{ color: "var(--yellow)" }}>
          {best.player_name}
        </div>
        <div
          className="sc"
          style={{
            color: "var(--yellow)",
            textShadow: "0 0 6px rgba(245,255,0,0.5)",
          }}
        >
          {best.score.toLocaleString("es-ES")}
        </div>
        <div className="dt">{formatDate(best.created_at)}</div>
      </div>
    </>
  );
}

function HallEmpty() {
  return (
    <div className="hall-empty">
      <p className="pixel">
        AÚN NO HAY MARCAS REGISTRADAS
        <span className="sep"> · </span>
        <span className="call">SÉ EL PRIMERO</span>
      </p>
      <Link href="/games/rocas/play" className="btn yellow">
        ▶ JUGAR A ROCAS
      </Link>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user } = useSession();
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

      {state === "ready" && scores.length === 0 && <HallEmpty />}

      {state === "ready" && scores.length > 0 && (
        <>
          <Podium scores={scores} />

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
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{s.player_name}</div>
                <div className="sc">{s.score.toLocaleString("es-ES")}</div>
                <div className="dt">{formatDate(s.created_at)}</div>
              </div>
            ))}
            <YourBest scores={scores} name={user?.name} />
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/games" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}

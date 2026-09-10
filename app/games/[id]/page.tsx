import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { GAMES } from "@/lib/games";
import type { Score, ScoresResponse } from "@/lib/scores";

type Props = {
  params: Promise<{ id: string }>;
};

const ROCAS_ID = "rocas";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Toda lectura del ranking pasa por GET /api/scores, también desde el servidor:
// así existe un único lugar en el proyecto que toca la tabla scores. El origen
// se deriva de la propia petición para no depender de una variable de entorno.
async function fetchTopScores(
  gameId: string,
): Promise<{ scores: Score[]; failed: boolean }> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${h.get("host")}`;

  try {
    const res = await fetch(`${origin}/api/scores?game=${gameId}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as ScoresResponse;
    if (!data.ok) return { scores: [], failed: true };
    return { scores: data.scores, failed: false };
  } catch {
    return { scores: [], failed: true };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) return {};
  return { title: `${game.title} · Arcade Vault` };
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  const { scores, failed } = await fetchTopScores(game.id);
  // "Mejor global" solo deja de ser decorativo en ROCAS, donde hay marcas reales.
  const isRocas = game.id === ROCAS_ID;
  const bestReal = isRocas ? scores[0]?.score : undefined;

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover} />
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}
              >
                {isRocas
                  ? (bestReal?.toLocaleString("es-ES") ?? "———")
                  : game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${game.id}/play`} className="btn xl pulse">
              ▶ JUGAR AHORA
            </Link>
            <Link href="/games" className="btn ghost lg">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {failed ? (
            <p
              className="pixel"
              style={{
                color: "var(--magenta)",
                fontSize: 10,
                letterSpacing: "0.06em",
                margin: "18px 0 0",
              }}
            >
              ⚠ NO SE PUDO CARGAR EL RANKING.
            </p>
          ) : scores.length === 0 ? (
            <div className="hall-empty compact">
              <p className="pixel">
                AÚN NO HAY MARCAS REGISTRADAS
                <span className="sep"> · </span>
                <span className="call">SÉ EL PRIMERO</span>
              </p>
              <Link href={`/games/${game.id}/play`} className="btn yellow">
                ▶ JUGAR A {game.title}
              </Link>
            </div>
          ) : (
            scores.map((s, i) => (
              <div
                key={s.id}
                className={
                  "lb-row" +
                  (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
                }
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">
                  {s.player_name}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {formatDate(s.created_at)}
                  </div>
                </div>
                <div className="sc">{s.score.toLocaleString("es-ES")}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

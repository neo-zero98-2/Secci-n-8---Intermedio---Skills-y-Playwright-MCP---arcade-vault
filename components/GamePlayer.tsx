"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Game } from "@/lib/games";
import type { SubmitScoreResponse } from "@/lib/scores";
import AsteroidsGame, { type AsteroidsGameHandle } from "@/components/games/AsteroidsGame";

type SaveState = "idle" | "saving" | "error";

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();

  // Solo "rocas" tiene lógica de juego real; el resto sigue con el simulador decorativo.
  const isAsteroids = game.id === "rocas";
  const asteroidsRef = useRef<AsteroidsGameHandle>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    // Sincroniza con la sesión (se hidrata async desde localStorage tras el primer render).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    // Simulador de puntuación del prototipo: solo para los juegos sin lógica real.
    if (over || paused || isAsteroids) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [over, paused, isAsteroids]);

  useEffect(() => {
    // Ratchet de nivel: mismo simulador que el prototipo (avanza ~cada 2500 puntos).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isAsteroids && score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score, isAsteroids]);

  const endGame = () => {
    // En el juego real, el fin lo dispara el propio motor (onGameOver) para que
    // la puntuación del modal sea la acumulada de verdad.
    if (isAsteroids) asteroidsRef.current?.forceGameOver();
    else setOver(true);
  };
  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveState("idle");
    asteroidsRef.current?.restart();
  };

  // Solo ROCAS escribe al ranking real; los otros 7 generan su puntuación con un
  // setInterval falso y llenarían la tabla de basura, así que siguen en localStorage.
  const submitScore = async () => {
    if (!isAsteroids) {
      saveScore({ game: game.id, score, name });
      setSaved(true);
      return;
    }

    setSaveState("saving");
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.id, player_name: name, score }),
      });
      const data = (await res.json()) as SubmitScoreResponse;
      if (!data.ok) {
        setSaveState("error");
        return;
      }
      setSaved(true);
      setSaveState("idle");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button className="btn ghost" onClick={() => router.push(`/games/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsGame
              ref={asteroidsRef}
              paused={paused}
              onScoreChange={setScore}
              onLivesChange={setLives}
              onLevelChange={setLevel}
              onGameOver={(finalScore) => {
                setScore(finalScore);
                setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>
            {game.title} · CRT-83 · 60 HZ
          </span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="TUS INICIALES"
                    disabled={saveState === "saving"}
                  />
                  <button
                    className="btn yellow"
                    onClick={submitScore}
                    disabled={saveState === "saving" || name.trim() === ""}
                  >
                    {saveState === "saving" ? (
                      <>
                        <span
                          className="spinner"
                          style={{ marginRight: 8, verticalAlign: "-3px" }}
                        />
                        GUARDANDO…
                      </>
                    ) : (
                      "GUARDAR PUNTUACIÓN"
                    )}
                  </button>
                </div>
                {saveState === "error" && (
                  <p
                    className="pixel"
                    style={{
                      color: "var(--magenta)",
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      margin: "12px 0 0",
                    }}
                  >
                    ⚠ NO SE PUDO GUARDAR LA PUNTUACIÓN. INTÉNTALO DE NUEVO.
                  </p>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/games")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

// Resolución interna fija, igual que el juego original: toda la matemática de
// spawn, wrap y colisiones vive en este espacio de coordenadas. El canvas se
// escala por CSS dentro de `.crt-screen`, que ya declara aspect-ratio 4/3.
const W = 800;
const H = 600;

// Un dt mayor teletransportaría los asteroides a través de la nave sin detectar
// la colisión, así que se capa igual que en el original tras un blur largo.
const MAX_DT = 0.05;

export default function AsteroidsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
      lastTime = ts;

      void dt; // Las entidades y su update(dt) llegan en los siguientes pasos.
      draw(ctx);

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />;
}

function draw(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
}

"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import type {
  GameEngineHandle,
  GameEngineProps,
} from "@/components/games/registry";
import {
  loadSpritesheet,
  type Spritesheet,
} from "@/components/games/arkanoid-assets";

// Resolución interna fija del original. Es el 4:3 exacto del marco CRT, así que
// el canvas se estira al marco completo sin deformarse y toda la matemática de
// posiciones, rebotes y colisiones sigue siendo válida en píxeles del canvas.
const W = 800;
const H = 600;

// El original no capa el delta. Sin el cap, volver de una pestaña en segundo
// plano avanzaría la pelota cientos de píxeles en un frame y la haría atravesar
// la pala y los bloques. El dt se mantiene en segundos, como el original, porque
// todas sus magnitudes son píxeles por segundo.
const MAX_DT = 0.05;

const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";

// Monoespaciada del sistema: `app/layout.tsx` no cablea `next/font`.
const LOADING_FONT = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";

function fondo(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
}

// El original arranca el juego entero dentro del callback de `loadSpritesheet()`
// y hasta entonces no pinta nada. Aquí el canvas ya está montado, así que
// mientras el PNG viaja se anuncia la espera.
function dibujarCargando(ctx: CanvasRenderingContext2D) {
  fondo(ctx);
  ctx.fillStyle = "#e6e9ff";
  ctx.font = LOADING_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CARGANDO…", W / 2, H / 2);
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ArkanoidGame({ ref, ...props }: GameEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Las props viven en un ref para que el efecto del loop no dependa de su
  // identidad: si dependiera, cada render de GamePlayer reiniciaría la partida.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  // El efecto publica aquí sus acciones; useImperativeHandle solo delega.
  const apiRef = useRef<GameEngineHandle | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      restart: () => apiRef.current?.restart(),
      forceGameOver: () => apiRef.current?.forceGameOver(),
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dibujarCargando(ctx);

    apiRef.current = {
      restart: () => {},
      forceGameOver: () => {},
    };

    // El spritesheet solo existe a partir de su `onload`; el loop no corre antes.
    let sheet: Spritesheet | null = null;
    let frame = 0;
    // `lastTime` se refresca en cada frame, también en pausa: si no, al reanudar
    // llegaría un delta de varios segundos de golpe.
    let lastTime: number | null = null;

    const loop = (ts: number) => {
      // dt en segundos, capado: ver MAX_DT.
      const dt =
        lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
      lastTime = ts;

      // El mundo —pala, pelota, bloques y explosiones— entra en los pasos
      // siguientes. El loop ya tiene su reloj y su ritmo de dibujo.
      if (sheet) fondo(ctx);

      frame = requestAnimationFrame(loop);
    };

    // El loop no arranca hasta que el spritesheet resuelve: si arrancara antes,
    // la partida correría invisible unos frames y la pelota podría perderse sin
    // haberse visto. Si el componente se desmonta durante la carga, `cancelar`
    // impide que el `onload` arranque un loop huérfano.
    const cancelarCarga = loadSpritesheet(SPRITESHEET_SRC, (cargado) => {
      sheet = cargado;
      frame = requestAnimationFrame(loop);
    });

    return () => {
      apiRef.current = null;
      cancelarCarga();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />
  );
}

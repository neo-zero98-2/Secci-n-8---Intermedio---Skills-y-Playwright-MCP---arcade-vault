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

// ── Constantes ────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

// ── Input ─────────────────────────────────────────────────────────────────────
type Keys = Record<string, boolean>;

// Teclas que el juego consume: sin preventDefault, las flechas y el espacio
// hacen scroll de la página durante la partida.
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];
  dead = false;

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Parpadea los últimos 2s antes de expirar
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 2;
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
// Mutable y fuera de React: el loop corre a ~60fps y re-renderizar por frame
// sería inaceptable. React solo se entera por callbacks (paso 7 del plan).
type GamePhase = "playing" | "dead" | "gameover";

type GameState = {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  lives: number;
  level: number;
  // Renombrado desde `state` de game.js para no chocar con el vocabulario de React.
  phase: GamePhase;
  deadTimer: number;
  // Un power-up por nivel: garantizado a los 5 kills si el 15% no ha saltado antes.
  powerUpSpawned: boolean;
  killsSinceSpawn: number;
};

function spawnAsteroids(g: GameState, count: number) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    g.asteroids.push(new Asteroid(x, y, 3));
  }
}

function createGame(): GameState {
  const g: GameState = {
    ship: new Ship(),
    bullets: [],
    asteroids: [],
    particles: [],
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    phase: "playing",
    deadTimer: 0,
    powerUpSpawned: false,
    killsSinceSpawn: 0,
  };
  spawnAsteroids(g, 4);
  return g;
}

function nextLevel(g: GameState) {
  g.level++;
  g.bullets = [];
  g.particles = [];
  g.powerUps = [];
  g.powerUpSpawned = false;
  g.killsSinceSpawn = 0;
  g.ship.reset();
  spawnAsteroids(g, 3 + g.level);
}

function explode(g: GameState, x: number, y: number, count = 8) {
  for (let i = 0; i < count; i++) g.particles.push(new Particle(x, y));
}

function killShip(g: GameState) {
  explode(g, g.ship.x, g.ship.y, 14);
  g.ship.dead = true;
  g.lives--;
  if (g.lives <= 0) {
    g.phase = "gameover";
  } else {
    g.phase = "dead";
    g.deadTimer = 2;
  }
}

function update(g: GameState, dt: number, keys: Keys, pressed: (code: string) => boolean) {
  // Fin de partida: el loop deja de procesar input y de actualizar entidades, así
  // que el canvas queda congelado detrás del modal de GamePlayer hasta restart().
  // (En game.js esta rama reiniciaba con Espacio; el spec lo desactiva a propósito.)
  if (g.phase === "gameover") return;

  if (g.phase === "dead") {
    g.deadTimer -= dt;
    g.particles.forEach((p) => p.update(dt));
    g.particles = g.particles.filter((p) => !p.dead);
    g.asteroids.forEach((a) => a.update(dt));
    if (g.deadTimer <= 0) {
      g.phase = "playing";
      g.ship.reset();
    }
    return;
  }

  if (pressed("Space")) g.bullets.push(...g.ship.tryShoot());

  g.ship.update(dt, keys);
  g.bullets.forEach((b) => b.update(dt));
  g.asteroids.forEach((a) => a.update(dt));
  g.particles.forEach((p) => p.update(dt));
  g.powerUps.forEach((p) => p.update(dt));

  g.bullets = g.bullets.filter((b) => !b.dead);
  g.particles = g.particles.filter((p) => !p.dead);
  g.powerUps = g.powerUps.filter((p) => !p.dead);

  // Recogida por colisión: activa el disparo triple
  for (const p of g.powerUps) {
    if (!p.dead && dist(g.ship, p) < g.ship.radius + p.radius) {
      p.dead = true;
      g.ship.tripleShot = POWERUP_DURATION;
    }
  }

  // Bala vs asteroide
  const newAsteroids: Asteroid[] = [];
  for (const b of g.bullets) {
    for (const a of g.asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        g.score += POINTS[a.size];
        explode(g, a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        if (!g.powerUpSpawned) {
          g.killsSinceSpawn++;
          const guaranteed = g.killsSinceSpawn >= 5;
          if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
            g.powerUps.push(new PowerUp(a.x, a.y));
            g.powerUpSpawned = true;
          }
        }
      }
    }
  }
  g.asteroids = g.asteroids.filter((a) => !a.dead).concat(newAsteroids);
  g.bullets = g.bullets.filter((b) => !b.dead);

  // Nave vs asteroide
  if (g.ship.invincible <= 0) {
    for (const a of g.asteroids) {
      if (dist(g.ship, a) < g.ship.radius + a.radius * 0.82) {
        killShip(g);
        break;
      }
    }
  }

  // Nivel completado
  if (g.asteroids.length === 0) nextLevel(g);
}

function draw(ctx: CanvasRenderingContext2D, g: GameState) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  g.particles.forEach((p) => p.draw(ctx));
  g.asteroids.forEach((a) => a.draw(ctx));
  g.powerUps.forEach((p) => p.draw(ctx));
  g.bullets.forEach((b) => b.draw(ctx));
  g.ship.draw(ctx);
}

// ── Contrato con React ────────────────────────────────────────────────────────
// Lo único que cruza la frontera React ↔ canvas. Los callbacks se emiten solo
// cuando el valor cambia respecto al último emitido, nunca en cada frame.
type AsteroidsGameProps = {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function AsteroidsGame(props: AsteroidsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Los callbacks viven en un ref para que el efecto del loop no dependa de su
  // identidad: si dependiera, cada render de GamePlayer reiniciaría la partida.
  const cbRef = useRef(props);
  useEffect(() => {
    cbRef.current = props;
  });
  // El estado del juego vive en un ref para que el paso 9 (restart/FIN) pueda
  // alcanzarlo desde fuera del efecto.
  const gameRef = useRef<GameState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Todo el estado vive dentro del efecto: sin globales de módulo, un remount
    // (StrictMode monta dos veces en dev) arranca una partida limpia.
    const keys: Keys = {};
    const justPressed: Keys = {};
    gameRef.current = createGame();

    // Disparo por flanco: una pulsación = un disparo, sin autofire por key repeat.
    const pressed = (code: string) => {
      const val = justPressed[code];
      justPressed[code] = false;
      return val;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!keys[e.code]) justPressed[e.code] = true;
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      keys[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let frame = 0;
    let lastTime: number | null = null;
    // -1 fuerza una primera emisión que sincroniza el HUD con el estado real.
    const emitido = { score: -1, lives: -1, level: -1 };
    // El fin de partida se emite una sola vez por partida: manda el modal de
    // GamePlayer. Aquí no hay overlay "GAME OVER" ni reinicio con Espacio.
    let gameOverEmitido = false;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
      lastTime = ts;

      const g = gameRef.current;
      if (g) {
        update(g, dt, keys, pressed);
        draw(ctx, g);

        if (g.score !== emitido.score) {
          emitido.score = g.score;
          cbRef.current.onScoreChange(g.score);
        }
        if (g.lives !== emitido.lives) {
          emitido.lives = g.lives;
          cbRef.current.onLivesChange(g.lives);
        }
        if (g.level !== emitido.level) {
          emitido.level = g.level;
          cbRef.current.onLevelChange(g.level);
        }
        if (g.phase === "gameover" && !gameOverEmitido) {
          gameOverEmitido = true;
          cbRef.current.onGameOver(g.score);
        }
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return <canvas ref={canvasRef} className="game-canvas" width={W} height={H} />;
}

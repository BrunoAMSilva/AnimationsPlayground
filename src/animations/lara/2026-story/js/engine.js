/* ===========================================================================
   Parabéns Lara — 10 anos  |  Engine partilhado (p5 global mode)
   Peças reutilizadas pelos 3 modos: starfield, enxame de texto, Astro,
   fogo de artifício com símbolos PlayStation, colecionáveis e áudio.
   =========================================================================== */

const AST = {};                 // assets carregados
const G = {                     // estado global partilhado
  calm: true,                   // modo calmo (menos intensidade/flashes)
  sound: true,
  cx: 0, cy: 0,                 // centro do ecrã
};

/* ---------- helpers ---------- */
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const chance = (p) => Math.random() < p;
const clampv = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function arrive(pos, vel, target, maxSpeed, maxForce, slowR = 180) {
  let desired = p5.Vector.sub(target, pos);
  let d = desired.mag();
  let speed = maxSpeed;
  if (d < slowR) speed = map(d, 0, slowR, 0, maxSpeed);
  desired.setMag(speed);
  let steer = p5.Vector.sub(desired, vel);
  steer.limit(maxForce);
  return steer;
}

/* Ajuste "cover" para desenhar uma imagem a preencher o ecrã */
function coverRect(imgW, imgH, cw, ch) {
  const s = Math.max(cw / imgW, ch / imgH);
  const w = imgW * s, h = imgH * s;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

/* =====================================================================
   Starfield — 3 camadas de estrelas com deriva suave e cintilar leve
   ===================================================================== */
class Starfield {
  constructor(n = 220) {
    this.stars = [];
    for (let i = 0; i < n; i++) {
      const layer = i % 3;
      this.stars.push({
        x: rnd(width), y: rnd(height),
        z: layer,
        r: (layer + 1) * rnd(0.5, 1.1),
        tw: rnd(TWO_PI),
        sp: (layer + 1) * 0.06,
      });
    }
  }
  resize() { this.stars.forEach(s => { s.x = rnd(width); s.y = rnd(height); }); }
  draw(drift = 1) {
    noStroke();
    for (const s of this.stars) {
      s.x -= s.sp * drift;
      if (s.x < -2) { s.x = width + 2; s.y = rnd(height); }
      s.tw += 0.03;
      const a = 140 + Math.sin(s.tw) * 90;
      fill(200, 225, 255, a);
      circle(s.x, s.y, s.r * 2);
    }
  }
}

/* =====================================================================
   Swarm — partículas que se juntam para formar texto (morphs suaves)
   ===================================================================== */
class SwarmParticle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.target = createVector(x, y);
    this.active = false;
    this.alpha = 0;                 // 0..1 — fade in/out (nunca "aparece do nada")
    this.seed = rnd(1000);
    this.max = rnd(5, 8);         // mais lento e flutuante (transições que o Bruno aprovou)
    this.force = rnd(0.45, 0.8);
  }
  update() {
    // fade suave para o estado alvo
    const want = this.active ? 1 : 0;
    this.alpha += (want - this.alpha) * (this.active ? 0.14 : 0.06);
    // move enquanto está ativo OU ainda visível (a sair para fora do ecrã)
    if (this.active || this.alpha > 0.02) {
      const steer = arrive(this.pos, this.vel, this.target, this.max, this.force);
      steer.add(rnd(-0.05, 0.05), rnd(-0.05, 0.05)); // tremor orgânico
      this.vel.add(steer);
      this.pos.add(this.vel);
    }
  }
}

class Swarm {
  constructor(font, pool = 1700) {
    this.font = font;
    this.parts = [];
    this.hue = 196;
    this.brightSeed = 0;
    this.activeCount = 0;
    // pool inteiro criado já — todos estacionados fora do ecrã
    for (let i = 0; i < pool; i++) {
      const p = new SwarmParticle(0, 0);
      this._park(p, true);
      this.parts.push(p);
    }
  }
  // um ponto num anel bem para lá das bordas do ecrã
  _offscreenPoint() {
    // anel elíptico logo por fora do retângulo do ecrã — entram limpo pelas bordas
    const a = rnd(TWO_PI);
    const m = 1.12 + rnd(0, 0.4);        // 1.12x..1.52x da meia-dimensão
    return {
      x: width / 2 + Math.cos(a) * width * 0.5 * m,
      y: height / 2 + Math.sin(a) * height * 0.5 * m,
    };
  }
  // desativa a partícula e manda-a para fora (snap = colocar já lá, invisível)
  _park(p, snap = false) {
    const o = this._offscreenPoint();
    p.active = false;
    p.target.set(o.x, o.y);
    if (snap) { p.pos.set(o.x, o.y); p.vel.set(0, 0); p.alpha = 0; }
  }
  // fallback (raro): se um texto precisar de mais pontos que o pool
  _spawn() {
    const p = new SwarmParticle(0, 0);
    this._park(p, true);
    this.parts.push(p);
    return p;
  }
  pointsFor(str, size, cx, cy, sampleFactor = 0.13) {
    const b = this.font.textBounds(str, 0, 0, size);
    const sx = cx - b.w / 2 - b.x;
    const sy = cy - b.h / 2 - b.y;
    return this.font.textToPoints(str, sx, sy, size, { sampleFactor });
  }
  pointsForLines(lines, size, cx, cy, sampleFactor = 0.13) {
    const lineH = size * 1.18;
    const totalH = lineH * lines.length;
    let all = [];
    lines.forEach((ln, i) => {
      if (!ln.trim()) return;
      const ly = cy - totalH / 2 + lineH * (i + 0.5);
      const b = this.font.textBounds(ln, 0, 0, size);
      const sx = cx - b.w / 2 - b.x;
      const sy = ly - b.h / 2 - b.y;
      all = all.concat(this.font.textToPoints(ln, sx, sy, size, { sampleFactor }));
    });
    return all;
  }
  // empurra os pontos atualmente ativos para fora (espalham numa nuvem antes de reformar)
  _burstActive(power = 11) {
    if (power <= 0) return;
    for (const p of this.parts) {
      if (!p.active) continue;
      let dx = p.pos.x - width / 2, dy = p.pos.y - height / 2;
      const d = Math.hypot(dx, dy) || 1;
      const mag = power * rnd(0.55, 1.25);                    // sobretudo radial (para fora)
      p.vel.add((dx / d) * mag + rnd(-power, power) * 0.6,    // + um pouco de aleatório
                (dy / d) * mag + rnd(-power, power) * 0.6);
    }
  }
  // espalha os pontos ativos por posições ALEATÓRIAS (nuvem que fica um momento
  // antes de reformar) — chamado na fase de dispersão entre frases
  disperse(power = 9) {
    for (const p of this.parts) {
      if (!p.active) continue;
      p.target.set(
        width * 0.5 + rnd(-1, 1) * width * 0.46,
        height * 0.46 + rnd(-1, 1) * height * 0.4
      );
      p.vel.add(rnd(-power, power), rnd(-power, power));
    }
  }
  setText(str, { size = 320, cx = width / 2, cy = height / 2, sampleFactor = 0.13, burst = 0 } = {}) {
    const lines = String(str).split("\n");
    const pts = lines.length > 1
      ? this.pointsForLines(lines, size, cx, cy, sampleFactor)
      : this.pointsFor(str, size, cx, cy, sampleFactor);
    this._burstActive(burst);   // espalha a frase atual antes de reformar na nova
    // ativa os necessários — se estavam parqueados, entram de fora do ecrã
    for (let i = 0; i < pts.length; i++) {
      const p = this.parts[i] || this._spawn();
      p.active = true;
      p.target.set(pts[i].x, pts[i].y);
    }
    // os que sobram: manda-os para fora (só os que estavam ativos; os já
    // parqueados ficam onde estão, invisíveis, prontos a ser reutilizados)
    for (let i = pts.length; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.active) this._park(p);
    }
    this.activeCount = pts.length;
  }
  scatter(power = 16) {
    for (const p of this.parts) {
      if (!p.active) continue;
      p.vel.add(rnd(-power, power), rnd(-power, power));
      p.target.set(p.pos.x + rnd(-width, width), p.pos.y + rnd(-height, height));
    }
  }
  clear() { this.parts.forEach(p => this._park(p)); }

  update() { this.parts.forEach(p => p.update()); }

  draw() {
    push();
    colorMode(HSB, 360, 100, 100, 255);
    strokeWeight(G.calm ? 3.5 : 4);
    drawingContext.shadowBlur = G.calm ? 8 : 16;
    drawingContext.shadowColor = "rgba(87,230,255,0.9)";
    for (const p of this.parts) {
      if (p.alpha < 0.02) continue;                 // ainda parqueado/invisível
      const b = 55 + noise(this.brightSeed, p.seed) * 45;
      stroke((this.hue + noise(p.seed) * 20) % 360, 65, b, p.alpha * 255);
      point(p.pos.x, p.pos.y);
      this.brightSeed += 0.00008;
    }
    drawingContext.shadowBlur = 0;
    pop();
  }
}

/* =====================================================================
   Astro — sprite que segue um alvo com suavidade, flutua e inclina
   ===================================================================== */
// frame atual de um sprite (frames descodificados) para o tempo ms
function spriteFrame(sp, ms) {
  let t = ms % sp.total;
  for (let i = 0; i < sp.n; i++) { t -= sp.durations[i]; if (t < 0) return sp.frames[i]; }
  return sp.frames[sp.n - 1];
}

class Astro {
  constructor(img) {
    this.img = img;
    this.pos = createVector(width / 2, height / 2);
    this.vel = createVector(0, 0);
    this.target = createVector(width / 2, height / 2);
    this.size = Math.min(width, height) * 0.16;
    this.bob = rnd(TWO_PI);
    this.maxSpeed = 14;
    this.maxForce = 1.1;
    this.trail = [];
    this.face = 1;
    this.getSprite = null;
  }
  setTarget(x, y) { this.target.set(x, y); }
  setImg(img, getSprite) { this.img = img; this.getSprite = getSprite || null; }

  update() {
    const steer = arrive(this.pos, this.vel, this.target, this.maxSpeed, this.maxForce, 220);
    this.vel.add(steer);
    this.vel.mult(0.92);
    this.pos.add(this.vel);
    this.bob += 0.05;
    if (Math.abs(this.vel.x) > 0.4) this.face = this.vel.x > 0 ? 1 : -1;
    // jatos dos pés quando se move
    const spd = this.vel.mag();
    if (spd > 0.8) {
      const sp0 = this.getSprite && this.getSprite();
      const iw = (sp0 && sp0.w) || this.img.naturalWidth || this.img.width || 1;
      const ih = (sp0 && sp0.h) || this.img.naturalHeight || this.img.height || 1;
      const imgH = this.size * (ih / iw);
      const drawY = this.pos.y + Math.sin(this.bob) * 8;   // mesmo y do desenho (com bob)
      const feetY = drawY + imgH * 0.40;                   // pés perto do fundo da imagem
      const dirx = -this.vel.x * 0.3;
      const diry = 1.2 - this.vel.y * 0.2;             // sai para baixo (e atrás)
      for (const fx of [-this.size * 0.14, this.size * 0.14]) {
        this.trail.push({
          x: this.pos.x + fx + rnd(-2, 2), y: feetY + rnd(-2, 2),
          vx: dirx + rnd(-0.5, 0.5), vy: diry + rnd(-0.2, 0.6),
          life: 1, r: rnd(5, 9) * Math.min(1.7, 0.6 + spd * 0.14),
        });
      }
    }
    for (const t of this.trail) {
      t.x += t.vx || 0; t.y += t.vy || 0;
      if (t.vx !== undefined) { t.vx *= 0.9; t.vy = t.vy * 0.95 + 0.12; }
      t.life -= 0.06;
    }
    this.trail = this.trail.filter(t => t.life > 0);
  }

  drawTrail() {
    push();
    noStroke();
    drawingContext.globalCompositeOperation = "lighter";   // brilho aditivo
    for (const t of this.trail) {
      const L = t.life, r = t.r * L;
      fill(60, 150, 255, L * 55); circle(t.x, t.y, r * 2.3);    // halo azul
      fill(150, 220, 255, L * 150); circle(t.x, t.y, r * 1.1);  // corpo azul-claro
      fill(240, 250, 255, L * 140); circle(t.x, t.y, r * 0.5);  // núcleo branco
    }
    drawingContext.globalCompositeOperation = "source-over";
    pop();
  }

  draw() {
    this.drawTrail();
    const y = this.pos.y + Math.sin(this.bob) * 8;
    const tilt = clampv(this.vel.x * 0.02, -0.35, 0.35);
    // brilho de sustentação (glow, não sombra escura — funciona no espaço)
    push();
    noStroke();
    drawingContext.shadowBlur = 26;
    drawingContext.shadowColor = "rgba(87,230,255,0.7)";
    fill(87, 230, 255, 34);
    ellipse(this.pos.x, y + this.size * 0.52, this.size * 1.0, this.size * 0.34);
    drawingContext.shadowBlur = 0;
    pop();

    push();
    translate(this.pos.x, y);
    rotate(tilt);
    scale(this.face, 1);
    const sp = this.getSprite && this.getSprite();
    let frame = null, iw, ih;
    if (sp && sp.frames && sp.frames.length) {
      frame = spriteFrame(sp, millis()); iw = sp.w; ih = sp.h;   // frame animado descodificado
    } else {
      iw = this.img.naturalWidth || this.img.width || 1;
      ih = this.img.naturalHeight || this.img.height || 1;
      if (iw > 1 && this.img.complete !== false) frame = this.img;  // fallback estático
    }
    const w = this.size, h = this.size * (ih / iw);
    drawingContext.shadowBlur = 24;
    drawingContext.shadowColor = "rgba(27,157,255,0.55)";
    if (frame) drawingContext.drawImage(frame, -w / 2, -h / 2, w, h);
    pop();
  }
}

/* =====================================================================
   Símbolos PlayStation (✕ ○ △ ▢) desenhados em vetor + partícula
   ===================================================================== */
const PS_COLORS = {
  cross:    [87, 196, 255],
  circle:   [245, 70, 110],
  triangle: [83, 224, 160],
  square:   [244, 95, 208],
};
const PS_KINDS = ["cross", "circle", "triangle", "square"];
const PS_HUE = { cross: 205, circle: 345, triangle: 150, square: 315 };

function drawPsSymbol(kind, s, col, weight = 3) {
  push();
  noFill();
  stroke(col[0], col[1], col[2], col[3] ?? 255);
  strokeWeight(weight);
  strokeJoin(ROUND); strokeCap(ROUND);
  const u = s * 0.5;
  if (kind === "cross") { line(-u, -u, u, u); line(u, -u, -u, u); }
  else if (kind === "circle") { circle(0, 0, s); }
  else if (kind === "triangle") { const h = s * 0.5; triangle(0, -h, -h, h * 0.8, h, h * 0.8); }
  else { rectMode(CENTER); rect(0, 0, s * 0.92, s * 0.92, s * 0.08); }
  pop();
}

// Curva do coração (a mesma do original 2023). t em [0, TWO_PI].
// x ~ [-16,16]; y negativo = para cima (coração ao direito).
function heartPoint(t) {
  return {
    x: 16 * Math.pow(Math.sin(t), 3),
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
  };
}

// Contorno do triângulo (△, ponta para cima) — u em [0,1). Escala ~±16.
const _TRI = [[0, -16], [-14, 10], [14, 10]];
function trianglePoint(u) {
  u = ((u % 1) + 1) % 1;                      // normaliza (aceita u negativo do jitter)
  const seg = u * 3, i = Math.floor(seg) % 3, f = seg - Math.floor(seg);
  const a = _TRI[i], b = _TRI[(i + 1) % 3];
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
}
// Contorno do X (✕) — duas diagonais. u em [0,1). Escala ~±13.
function crossPoint(u) {
  u = ((u % 1) + 1) % 1;                      // normaliza (aceita u negativo)
  if (u < 0.5) { const f = u * 2; return { x: -13 + 26 * f, y: -13 + 26 * f }; }
  const f = (u - 0.5) * 2; return { x: 13 - 26 * f, y: -13 + 26 * f };
}
// Contorno do quadrado (▢) — 4 lados. u em [0,1). Escala ~±14.
const _SQ = [[-14, -14], [14, -14], [14, 14], [-14, 14]];
function squarePoint(u) {
  u = ((u % 1) + 1) % 1;
  const seg = u * 4, i = Math.floor(seg) % 4, f = seg - Math.floor(seg);
  const a = _SQ[i], b = _SQ[(i + 1) % 4];
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f };
}
// Contorno do círculo (○). u em [0,1). Escala ~16.
function circlePoint(u) {
  const a = u * TWO_PI;
  return { x: Math.cos(a) * 16, y: Math.sin(a) * 16 };
}

function drawStar(x, y, outer, inner, npoints = 5, rot = 0) {
  beginShape();
  for (let i = 0; i < npoints * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot - HALF_PI + (PI / npoints) * i;
    vertex(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  endShape(CLOSE);
}

/* Estrela dourada colecionável (modo "Apanha as estrelas") */
class StarPickup {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.base = createVector(x, y);
    this.phase = rnd(TWO_PI);
    this.spin = rnd(0.01, 0.03) * (chance(0.5) ? 1 : -1);
    this.rot = rnd(TWO_PI);
    this.collected = false;
    this.pop = 0;
    this.size = Math.min(width, height) * 0.052;
    this.r = this.size * 1.25;
  }
  update() {
    this.phase += 0.035; this.rot += this.spin;
    this.pos.y = this.base.y + Math.sin(this.phase) * 9;
    if (this.collected && this.pop < 1) this.pop += 0.08;
  }
  hit(x, y, radius) {
    if (this.collected) return false;
    if (dist(x, y, this.pos.x, this.pos.y) < radius + this.r) { this.collected = true; return true; }
    return false;
  }
  draw() {
    if (this.collected && this.pop >= 1) return;
    const grow = this.collected ? 1 + this.pop * 1.1 : 1;
    const fade = this.collected ? 1 - this.pop : 1;
    const pulse = 1 + Math.sin(this.phase * 2) * 0.06;
    push();
    translate(this.pos.x, this.pos.y);
    drawingContext.shadowBlur = 22; drawingContext.shadowColor = "rgba(255,214,90,0.85)";
    // corpo da estrela
    noStroke();
    fill(255, 224, 130, 255 * fade);
    drawStar(0, 0, this.size * pulse * grow, this.size * 0.44 * pulse * grow, 5, this.rot);
    // núcleo brilhante
    fill(255, 255, 240, 220 * fade);
    drawStar(0, 0, this.size * 0.55 * grow, this.size * 0.24 * grow, 5, this.rot);
    drawingContext.shadowBlur = 0;
    pop();
  }
}

class PsParticle {
  constructor(x, y, vx, vy, kind, life, sizeMul = 1) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.kind = kind;
    this.life = life; this.maxLife = life;
    this.spin = rnd(-0.15, 0.15); this.rot = rnd(TWO_PI);
    this.s = rnd(6, 12) * sizeMul;  // símbolos pequenos; interiores ainda mais pequenos
  }
  update() { this.vel.y += 0.07; this.vel.mult(0.993); this.pos.add(this.vel); this.rot += this.spin; this.life--; }
  draw() {
    const a = clampv((this.life / this.maxLife) * 255, 0, 255);
    const c = PS_COLORS[this.kind];
    push();
    translate(this.pos.x, this.pos.y); rotate(this.rot);
    // brilho via blending aditivo (definido no Story.draw) — sem shadowBlur (caro)
    drawPsSymbol(this.kind, this.s * 1.7, [c[0], c[1], c[2], a * 0.16], 3);  // halo
    drawPsSymbol(this.kind, this.s, [c[0], c[1], c[2], a], 2);               // núcleo
    pop();
  }
}

/* Coração formado por MUITOS símbolos PlayStation pequenos a cintilar
   (brilho/saturação) — a forma emerge do conjunto, não de uma linha exacta */
class PsHeart {
  constructor(x, y, size) {
    this.pos = createVector(x, y);
    this.size = size;
    this.sway = rnd(TWO_PI);
    this.swaySpeed = rnd(0.01, 0.024);
    this.drift = rnd(0.7, 1.4);             // sobe enquanto floresce
    this.rot = rnd(-0.12, 0.12);
    this.spin = rnd(-0.004, 0.004);
    this.life = 1;
    this.fade = rnd(0.011, 0.018);          // dissipa depressa (~1-1.5s)
    this.scale = 0.5;
    this.grow = rnd(0.016, 0.028);          // cresce (floresce)
    this.age = 0;
    const sc = size / 34;
    const base = size * 0.07;               // símbolos pequenos
    const N = Math.min(60, Math.max(38, Math.round(size / 3.2)));  // muitos
    this.pts = [];
    for (let i = 0; i < N; i++) {
      const t = (TWO_PI / N) * i;
      const hp = heartPoint(t);
      const jr = size * 0.05;               // espalha a linha -> vários símbolos, não linha exacta
      this.pts.push({
        x: hp.x * sc + rnd(-jr, jr),
        y: hp.y * sc + rnd(-jr, jr),
        kind: PS_KINDS[floor(rnd(4))],
        ph: rnd(TWO_PI),                     // fase de cintilação própria
        sp: rnd(0.05, 0.11),                 // velocidade de pulsação
        s: base * rnd(0.7, 1.3),             // tamanhos ligeiramente variados
      });
    }
  }
  update() {
    this.age++;
    this.pos.y -= this.drift;
    this.sway += this.swaySpeed;
    this.pos.x += Math.sin(this.sway) * 0.5;
    this.rot += this.spin;
    this.scale += this.grow;                 // cresce
    this.life -= this.fade;                  // e dissipa depressa
  }
  done() { return this.life <= 0; }
  draw() {
    if (this.life <= 0) return;
    const fadeIn = Math.min(1, this.age / 6);
    const baseA = clampv(this.life * 255, 0, 255) * (G.calm ? 0.8 : 1) * fadeIn;
    const sc = this.scale;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rot);
    colorMode(HSB, 360, 100, 100, 255);
    for (const p of this.pts) {
      const tw = 0.5 + 0.5 * Math.sin(frameCount * p.sp + p.ph);   // cintila 0..1
      const sat = 45 + tw * 55;              // pulsa saturação
      const bri = 60 + tw * 40;              // pulsa brilho
      const a = baseA * (0.28 + tw * 0.72);  // pulsa alpha
      const hue = PS_HUE[p.kind];
      const s = p.s * sc;
      push();
      translate(p.x * sc, p.y * sc);
      drawPsSymbol(p.kind, s * 1.7, [hue, sat, bri * 0.8, a * 0.2], 1.6);            // halo (glow)
      drawPsSymbol(p.kind, s * (0.85 + tw * 0.35), [hue, sat, bri, a], 1.4);         // núcleo
      pop();
    }
    pop();
  }
}

/* Onda de choque — anel de luz que se expande a partir de um ponto */
class Shockwave {
  constructor(x, y, color) {
    this.pos = createVector(x, y);
    this.r = 6;
    this.maxR = Math.min(width, height) * (G.calm ? 0.34 : 0.5);
    this.age = 0;
    this.dur = G.calm ? 42 : 34;               // frames até desaparecer por completo
    this.life = 1;
    this.color = color || [150, 215, 255];
    this.w = G.calm ? 6 : 9;
  }
  update() {
    this.age++;
    const p = Math.min(1, this.age / this.dur);
    this.r = 6 + (this.maxR - 6) * (1 - Math.pow(1 - p, 2));  // expande (ease-out) até maxR
    this.life = 1 - p;                                        // e desaparece garantidamente
  }
  done() { return this.age >= this.dur; }
  draw() {
    if (this.life <= 0) return;
    const c = this.color, L = this.life;
    push(); noFill();
    stroke(c[0], c[1], c[2], L * 210); strokeWeight(this.w * L);
    circle(this.pos.x, this.pos.y, this.r * 2);
    stroke(255, 255, 255, L * 140); strokeWeight(this.w * L * 0.4);
    circle(this.pos.x, this.pos.y, this.r * 1.7);
    pop();
  }
}

/* Clarão de transição — gradiente CÓNICO centrado num canto FORA do ecrã, com
   uma só secção colorida (o resto transparente), que RODA para varrer a cena. */
class LightFlash {
  constructor(x, y, color, strength) {
    this.color = color || [175, 220, 255];
    this.strength = (strength ?? 1) * (G.calm ? 1.0 : 1.35);
    this.t = 0;
    this.dur = G.calm ? 46 : 36;
    // centro do cónico fora do viewport, num canto
    const corners = [[-0.12, -0.12], [1.12, -0.12], [1.12, 1.12], [-0.12, 1.12]];
    const cn = corners[floor(rnd(corners.length))];
    this.cx = width * cn[0]; this.cy = height * cn[1];
    this.sector = 0.17;                                    // só UMA secção colorida
    const toCenter = Math.atan2(height / 2 - this.cy, width / 2 - this.cx);
    this.sweep = G.calm ? 0.85 : 1.15;                    // arco varrido
    this.rot = toCenter - this.sector * PI - this.sweep * 0.5;  // começa antes -> roda para aparecer
    this.spin = this.sweep / this.dur;
  }
  update() { this.t++; this.rot += this.spin; }
  done() { return this.t >= this.dur; }
  draw() {
    if (!drawingContext.createConicGradient) return;      // fallback: sem clarão
    const p = this.t / this.dur;
    const env = p < 0.16 ? (p / 0.16) : Math.pow(Math.max(0, 1 - (p - 0.16) / 0.84), 1.5);
    const a = env * this.strength;
    if (a <= 0.003) return;
    const c = this.color;
    const cg = drawingContext.createConicGradient(this.rot, this.cx, this.cy);
    cg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    cg.addColorStop(this.sector * 0.14, `rgba(${c[0]},${c[1]},${c[2]},${0.62 * a})`);
    cg.addColorStop(this.sector * 0.55, `rgba(${c[0]},${c[1]},${c[2]},${0.34 * a})`);
    cg.addColorStop(this.sector, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    cg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    drawingContext.fillStyle = cg;
    drawingContext.fillRect(0, 0, width, height);
  }
}

/* =====================================================================
   Montagem de fotos -> a estrela nasce -> explode para o "Parabéns"
   Fotos vêm de posições aleatórias fora do ecrã, convergem para o centro
   (que fica cada vez mais brilhante) até à última = a estrela nasce.
   ===================================================================== */
// desenha um cartão de foto (ou placeholder colorido) centrado na origem, largura = size
function drawPhotoCard(img, col, size, glow) {
  const w = size, h = size * 0.72, r = size * 0.06;
  push();
  rectMode(CENTER); noStroke();
  if (glow > 0) { drawingContext.shadowBlur = 24 * glow; drawingContext.shadowColor = `rgba(150,210,255,${0.55 * glow})`; }
  fill(246, 249, 255); rect(0, 0, w, h, r);          // moldura branca (polaroid)
  drawingContext.shadowBlur = 0;
  const pad = size * 0.05, iw = w - pad * 2, ih = h - pad * 2;
  if (img && (img.naturalWidth || img.width)) {
    const swh = img.naturalWidth || img.width, shh = img.naturalHeight || img.height;
    const ar = swh / shh, box = iw / ih;
    let sw, sh, sx, sy;
    if (ar > box) { sh = shh; sw = sh * box; sx = (swh - sw) / 2; sy = 0; }
    else { sw = swh; sh = sw / box; sx = 0; sy = (shh - sh) / 2; }
    drawingContext.drawImage(img, sx, sy, sw, sh, -iw / 2, -ih / 2, iw, ih);   // cover-fit
  } else if (col) {
    fill(col[0], col[1], col[2]); rect(0, 0, iw, ih, r * 0.6);
  }
  pop();
}

class PhotoMontage {
  constructor(images) {
    const m = Math.min(width, height);
    this.cx = width / 2; this.cy = height * 0.46;
    const imgs = images || [];
    this.n = imgs.length;                 // 0 = a estrela nasce só de luz (público, sem fotos)
    this.gatherDur = 3.0;                                     // sem fotos (só luz)
    this.stagger = this.n ? Math.max(0.11, Math.min(0.6, 9 / this.n)) : 0;   // muitas -> ritmo rápido
    this.flyDur = 0.7;
    this.mergeDur = 0.25;                                    // ao chegar, a foto some depressa (vira 1 partícula)
    this.baseSize = m * (this.n > 24 ? 0.23 : 0.3);
    this.stars = [];                                         // 1 partícula por foto -> formam a estrela
    this.starR = m * 0.02;                                  // raio da estrela (cresce com cada foto)
    this.items = [];
    for (let i = 0; i < this.n; i++) {
      const a = rnd(TWO_PI), R = m * 1.2;
      this.items.push({
        img: imgs[i],
        sx: this.cx + Math.cos(a) * R, sy: this.cy + Math.sin(a) * R,   // fora do ecrã, aleatório
        tx: this.cx + rnd(-1, 1) * m * 0.055, ty: this.cy + rnd(-1, 1) * m * 0.05,
        rot0: rnd(-0.7, 0.7), rot1: rnd(-0.16, 0.16),
        appear: i * this.stagger, arr: 0,
        size: this.baseSize * rnd(0.9, 1.1),
        exdir: rnd(TWO_PI), ex: 0,
      });
    }
    this.t = 0; this.core = 0; this.phase = "gather"; this.bornT = 0; this.explodeT = 0; this.arrived = 0;
    this.onExplode = null;
  }
  update(dt) {
    const s = Math.min(dt, 50) / 1000;
    this.t += s;
    if (this.phase === "gather") {
      if (this.n === 0) {                                  // sem fotos: a estrela nasce só de luz
        this.core = Math.min(1, this.t / this.gatherDur);
        if (this.t >= this.gatherDur) { this.phase = "born"; this.bornT = 0; }
      } else {
        let arrived = 0;
        for (const it of this.items) {
          const local = this.t - it.appear;
          it.arr = local <= 0 ? 0 : Math.min(1, local / this.flyDur);
          if (it.arr >= 1) arrived++;
        }
        this.arrived = arrived;
        this.core = arrived / this.n;                      // brilho cresce com as fotos
        if (arrived >= this.n) { this.phase = "born"; this.bornT = 0; }
      }
    } else if (this.phase === "born") {
      this.bornT += s;
      this.core = 1 + this.bornT * 2.2;                   // super-brilho: a estrela nasce
      if (this.bornT > 0.6) {
        this.phase = "explode"; this.explodeT = 0;
        for (const p of this.stars) { const a = Math.atan2(p.y - this.cy, p.x - this.cx) || rnd(TWO_PI); const sp = rnd(7, 17); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; }
        if (this.onExplode) this.onExplode(this.cx, this.cy);
      }
    } else if (this.phase === "explode") {
      this.explodeT += s;
      const k = this.explodeT / 0.45;
      for (const it of this.items) it.ex = k;             // fotos disparam para fora
      this.core = Math.max(0, 2 - k * 5);
      if (this.explodeT > 0.45) this.phase = "done";
    }

    // cada foto que chega vira 1 partícula
    const m = Math.min(width, height);
    for (const it of this.items) {
      if (it.arr >= 1 && !it.burst) {
        it.burst = true;
        const a0 = (it.img && it.img.avg) || { r: 200, g: 226, b: 255 };
        const k = 255 / Math.max(a0.r, a0.g, a0.b, 1);   // normaliza p/ brilho máximo mantendo o tom da foto
        this.stars.push({ x: it.tx, y: it.ty, vx: 0, vy: 0, hrFrac: Math.sqrt(rnd()), ha: rnd(TWO_PI), sw: rnd(-0.01, 0.01), ph: rnd(TWO_PI), spd: rnd(0.04, 0.1), r: Math.min(255, a0.r * k), g: Math.min(255, a0.g * k), b: Math.min(255, a0.b * k) });
      }
    }
    // a estrela CRESCE de tamanho com o nº de fotos que já chegaram
    const arrivedFrac = this.n ? Math.min(1, this.arrived / this.n) : 1;
    this.starR = m * (0.03 + 0.15 * arrivedFrac);
    const exploding = this.phase === "explode";
    for (const p of this.stars) {
      if (exploding) { p.vx *= 0.99; p.vy *= 0.99; }
      else {
        p.ha += p.sw;                                          // roda devagar (a estrela cintila)
        const tx = this.cx + Math.cos(p.ha) * p.hrFrac * this.starR, ty = this.cy + Math.sin(p.ha) * p.hrFrac * this.starR;
        p.vx += (tx - p.x) * 0.05; p.vy += (ty - p.y) * 0.05; p.vx *= 0.8; p.vy *= 0.8;
      }
      p.x += p.vx; p.y += p.vy;
    }
  }
  get explodeDone() { return this.phase === "done"; }
  draw() {
    const ci = Math.min(1.3, this.core);
    const explFade = this.phase === "explode" ? Math.max(0, 1 - this.explodeT / 0.45) : 1;
    // 1) halo suave de fundo (cresce com a estrela)
    const cr = this.starR * 1.9;
    push();
    drawingContext.globalCompositeOperation = "lighter";
    const g = drawingContext.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, cr * 2.6);
    g.addColorStop(0, `rgba(220,236,255,${(0.16 + Math.min(1, ci) * 0.46) * explFade})`);
    g.addColorStop(0.5, `rgba(150,200,255,${(0.06 + 0.12 * Math.min(1, ci)) * explFade})`);
    g.addColorStop(1, "rgba(120,190,255,0)");
    drawingContext.fillStyle = g; drawingContext.fillRect(0, 0, width, height);
    drawingContext.globalCompositeOperation = "source-over";
    pop();

    // 2) fotos (entram de fora e desfazem-se ao chegar)
    for (const it of this.items) {
      if (it.arr <= 0) continue;
      const e = easeOutCubic(it.arr);
      let x = it.sx + (it.tx - it.sx) * e, y = it.sy + (it.ty - it.sy) * e;
      let rot = it.rot0 + (it.rot1 - it.rot0) * e;
      let alpha = 1, sc = 0.6 + 0.4 * e;
      if (this.phase === "explode") { alpha = 0; }        // já viraram partículas
      else if (it.arr >= 1) {
        const mg = Math.min(1, (this.t - (it.appear + this.flyDur)) / this.mergeDur);
        if (mg >= 1) continue;
        const me = mg * mg;
        x = it.tx + (this.cx - it.tx) * me; y = it.ty + (this.cy - it.ty) * me;
        sc *= (1 - 0.55 * me); alpha = 1 - me;
      }
      if (alpha <= 0.02) continue;
      push();
      translate(x, y); rotate(rot); scale(sc);
      drawingContext.globalAlpha = alpha;
      drawPhotoCard(it.img.bmp, null, it.size, Math.min(1, this.core));
      drawingContext.globalAlpha = 1;
      pop();
    }

    // 3) núcleo quente — o coração brilhante da estrela (cresce e floresce ao nascer)
    push();
    drawingContext.globalCompositeOperation = "lighter";
    const cb = this.starR * (0.85 + 0.35 * Math.min(1.4, this.core)) * explFade;
    const ca = Math.min(1, 0.35 + this.core * 0.6) * explFade;
    const cg = drawingContext.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(1, cb));
    cg.addColorStop(0, `rgba(255,255,255,${0.95 * ca})`);
    cg.addColorStop(0.3, `rgba(224,240,255,${0.6 * ca})`);
    cg.addColorStop(1, "rgba(150,200,255,0)");
    drawingContext.fillStyle = cg; drawingContext.fillRect(0, 0, width, height);
    drawingContext.globalCompositeOperation = "source-over";
    pop();

    // 4) partículas da estrela POR CIMA — a estrela visível a crescer
    push();
    drawingContext.globalCompositeOperation = "lighter";
    noStroke();
    for (const p of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(frameCount * p.spd + p.ph);
      const a = 235 * tw * explFade;
      fill(p.r, p.g, p.b, a); circle(p.x, p.y, 7 * tw);              // cor da foto
      fill(255, 255, 255, a * 0.6); circle(p.x, p.y, 3 * tw);       // núcleo branco -> estrela
    }
    drawingContext.globalCompositeOperation = "source-over";
    pop();
  }
}

/* Slideshow das fotos no final — passam em fundo; botão passa para 1º plano.
   Carrega uma foto de cada vez (salta .mov/faltas) -> leve com centenas de fotos. */
const _SLIDE_EXTS = ["jpeg", "jpg", "png", "webp"];
class Slideshow {
  constructor() {
    this.mode = "bg";                 // "bg" | "fg"
    this.idx = 0; this.maxTry = 1500;
    this.cur = null; this.next = null; this.prev = null;
    this.fade = 1; this.t = 0;
    this._preload();
  }
  toggle() { this.mode = this.mode === "bg" ? "fg" : "bg"; }
  _preload() {
    const tryIdx = (guard) => {
      this.idx++; if (this.idx > this.maxTry) this.idx = 1;
      let e = 0;
      const tryExt = () => {
        if (e >= _SLIDE_EXTS.length) { if (guard < 60) tryIdx(guard + 1); return; }   // salta .mov/faltas
        const im = new Image();
        im.onload = () => { this.next = im; };
        im.onerror = () => { e++; tryExt(); };
        im.src = `assets/photos/${this.idx}.${_SLIDE_EXTS[e]}`;
      };
      tryExt();
    };
    tryIdx(0);
  }
  update(dt) {
    if (!this.cur && this.next) { this.cur = this.next; this.next = null; this.fade = 0; this.t = 0; this._preload(); return; }
    this.fade = Math.min(1, this.fade + dt / 450);
    this.t += dt;
    const interval = this.mode === "fg" ? 3200 : 2400;
    if (this.t > interval && this.next) { this.prev = this.cur; this.cur = this.next; this.next = null; this.fade = 0; this.t = 0; this._preload(); }
  }
  _drawImg(img, alpha) {
    if (!img || alpha <= 0.01 || !(img.naturalWidth || img.width)) return;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, ar = iw / ih, box = width / height;
    let sw, sh, sx, sy;
    if (ar > box) { sh = ih; sw = sh * box; sx = (iw - sw) / 2; sy = 0; }   // cover-fit ecrã inteiro
    else { sw = iw; sh = sw / box; sx = 0; sy = (ih - sh) / 2; }
    push(); drawingContext.globalAlpha = alpha;
    drawingContext.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    drawingContext.globalAlpha = 1; pop();
  }
  draw() {
    const baseA = this.mode === "fg" ? 0.97 : 0.16;
    if (this.prev) this._drawImg(this.prev, baseA * (1 - this.fade));
    this._drawImg(this.cur, baseA * this.fade);
  }
}

class Firework {
  constructor(x, y, shape = null) {
    this.pos = createVector(x ?? rnd(width * 0.15, width * 0.85), y ?? height);
    this.vel = createVector(rnd(-1.2, 1.2), rnd(-13, -10));
    this.exploded = false;
    this.parts = [];
    this.trail = [];
    this.kind = PS_KINDS[floor(rnd(4))];
    // shape: "heart" | "triangle" | "cross" | "radial" | true(=heart) | null(=aleatório)
    this.shape = shape;
  }
  explode() {
    this.exploded = true;
    let shape = this.shape === true ? "heart" : this.shape;
    if (shape == null) shape = chance(0.35) ? "radial" : ["heart", "triangle", "cross", "square", "circle"][floor(rnd(5))];
    const shapeFn = shape === "heart" ? (u) => heartPoint(u * TWO_PI)
      : shape === "triangle" ? trianglePoint
        : shape === "cross" ? crossPoint
          : shape === "square" ? squarePoint
            : shape === "circle" ? circlePoint : null;
    const themeKind = shape === "triangle" ? "triangle" : shape === "cross" ? "cross"
      : shape === "square" ? "square" : shape === "circle" ? "circle" : null;
    const n = shapeFn ? (G.calm ? 60 : 92) : (G.calm ? 40 : 66);  // MUITAS partículas -> formas coerentes
    const kBase = G.calm ? 0.72 : 1.1;                  // escala da forma
    const spMax = G.calm ? 12 : 17;                     // velocidade máx do radial
    for (let i = 0; i < n; i++) {
      let vx, vy, rad;
      if (shapeFn) {
        const p = shapeFn(i / n + rnd(-0.015, 0.015));
        rad = 0.42 + 0.58 * Math.max(rnd(), rnd());      // umas no contorno, outras mais interiores
        vx = p.x * kBase * rad; vy = p.y * kBase * rad;
      } else {
        const ang = rnd(TWO_PI);                          // ângulo aleatório -> rebentamento natural
        rad = 0.3 + 0.7 * Math.max(rnd(), rnd());        // volume: uns na borda, uns no interior
        const sp = spMax * rad;
        vx = Math.cos(ang) * sp; vy = Math.sin(ang) * sp;
      }
      const sizeMul = 0.5 + 0.6 * rad;                   // interiores (rad menor) mais pequenas
      const kind = themeKind
        ? (chance(0.72) ? themeKind : PS_KINDS[floor(rnd(4))])   // forma reforça a cor do símbolo
        : (chance(0.5) ? this.kind : PS_KINDS[floor(rnd(4))]);
      this.parts.push(new PsParticle(this.pos.x, this.pos.y, vx, vy, kind, floor(rnd(55, 85)), sizeMul));
    }
  }
  update() {
    if (!this.exploded) {
      this.vel.y += 0.16;
      this.pos.add(this.vel);
      this.trail.push({ x: this.pos.x, y: this.pos.y, life: 1 });
      if (this.trail.length > 12) this.trail.shift();
      if (this.vel.y >= -1) this.explode();
    } else {
      this.parts.forEach(p => p.update());
      this.parts = this.parts.filter(p => p.life > 0);
    }
  }
  done() { return this.exploded && this.parts.length === 0; }
  draw() {
    if (!this.exploded) {
      push(); noStroke();
      this.trail.forEach((t, i) => { fill(255, 255, 255, (i / this.trail.length) * 200); circle(t.x, t.y, 4); });
      const c = PS_COLORS[this.kind];
      drawingContext.shadowBlur = 12; drawingContext.shadowColor = `rgb(${c[0]},${c[1]},${c[2]})`;
      fill(255); circle(this.pos.x, this.pos.y, 6); drawingContext.shadowBlur = 0;
      pop();
    } else {
      this.parts.forEach(p => p.draw());
    }
  }
}

/* =====================================================================
   Medal / colecionável — flutua, "roda" e brilha; apanhado pelo Astro
   ===================================================================== */
class Medal {
  constructor(x, y, img) {
    this.pos = createVector(x, y);
    this.base = createVector(x, y);
    this.img = img;
    this.size = Math.min(width, height) * 0.11;
    this.phase = rnd(TWO_PI);
    this.collected = false;
    this.pop = 0;
    this.r = this.size * 0.55;
  }
  update() {
    this.phase += 0.03;
    this.pos.y = this.base.y + Math.sin(this.phase) * 10;
    if (this.collected && this.pop < 1) this.pop += 0.08;
  }
  hit(x, y, radius) {
    if (this.collected) return false;
    if (dist(x, y, this.pos.x, this.pos.y) < radius + this.r) { this.collected = true; return true; }
    return false;
  }
  draw() {
    if (this.collected && this.pop >= 1) return;
    push();
    translate(this.pos.x, this.pos.y);
    const grow = this.collected ? 1 + this.pop * 0.8 : 1;
    const fade = this.collected ? 1 - this.pop : 1;
    // anel de brilho pulsante
    noFill();
    stroke(87, 230, 255, 120 * fade);
    strokeWeight(2);
    circle(0, 0, this.size * (1.15 + Math.sin(this.phase * 2) * 0.06) * grow);
    // "rotação" fingida via escala horizontal
    const sx = Math.cos(this.phase) * 0.5 + 0.5;
    imageMode(CENTER);
    drawingContext.shadowBlur = 18; drawingContext.shadowColor = "rgba(87,230,255,0.6)";
    tint(255, 255 * fade);
    image(this.img, 0, 0, this.size * (0.35 + sx * 0.65) * grow, this.size * grow);
    noTint();
    drawingContext.shadowBlur = 0;
    pop();
  }
}

/* Sparkle burst reutilizável (ao apanhar / celebrar) */
class Sparkles {
  constructor() { this.list = []; }
  burst(x, y, n = 14, hue = [87, 230, 255]) {
    for (let i = 0; i < n; i++) {
      const a = rnd(TWO_PI), sp = rnd(1, 5);
      this.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: rnd(2, 5), hue });
    }
  }
  update() {
    for (const s of this.list) { s.x += s.vx; s.y += s.vy; s.vy += 0.05; s.vx *= 0.96; s.life -= 0.03; }
    this.list = this.list.filter(s => s.life > 0);
  }
  draw() {
    push(); noStroke();
    for (const s of this.list) { fill(s.hue[0], s.hue[1], s.hue[2], s.life * 220); circle(s.x, s.y, s.r * s.life); }
    pop();
  }
}

/* =====================================================================
   Áudio — SFX sintetizados (WebAudio) + música fornecida pelo utilizador
   Ficheiro opcional: music/theme.mp3  (o pai coloca a música do Astro)
   ===================================================================== */
const Sound = {
  ctx: null,
  music: null,
  ready: false,
  init() {
    if (this.ready) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    this.music = new Audio("music/theme.mp3");
    this.music.loop = true;
    this.music.volume = 0.55;
    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  _beep(freq, dur, type = "sine", vol = 0.2, slideTo = null) {
    if (!G.sound || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  coin() { this._beep(988, 0.08, "square", 0.15); setTimeout(() => this._beep(1319, 0.14, "square", 0.15), 70); },
  sparkle() { this._beep(1568, 0.12, "triangle", 0.1, 2637); },
  whoosh() { this._beep(180, 0.25, "sawtooth", 0.06, 900); },
  pop() { this._beep(660, 0.09, "sine", 0.12, 990); },
  fanfare() {
    if (!G.sound || !this.ctx) return;
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((f, i) => setTimeout(() => this._beep(f, 0.3, "triangle", 0.16), i * 130));
  },
  playMusic() { if (G.sound && this.music) this.music.play().catch(() => {}); },
  stopMusic() { if (this.music) { this.music.pause(); this.music.currentTime = 0; } },
};

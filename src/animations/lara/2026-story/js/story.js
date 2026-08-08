/* ===========================================================================
   A história (personalizada, em partículas). Edita STORY à vontade.
   O Astro é o companheiro que acompanha visualmente cada parte.
   =========================================================================== */

// astro: [x,y] em fração do ecrã (onde o Astro se posiciona nesse momento)
const STORY = [
  { text: "Olá, Lara!",                              astro: [0.50, 0.74], hold: 2.2, img: "hello", flash: true },
  { text: "Era uma vez\numa galáxia…",              astro: [0.76, 0.30], hold: 2.8 },
  { text: "…com milhões\nde estrelas.",              astro: [0.24, 0.30], hold: 3.0 },
  { text: "O Astro procurava\na mais especial.",     astro: [0.80, 0.70], hold: 3.2 },
  { text: "Voou por mundos,\nluas e cometas…",       astro: [0.50, 0.24], hold: 3.2, fly: true },
  { text: "No planeta dos gatos,\no Simba acenou!",  astro: [0.72, 0.62], hold: 3.4, excited: true },
  { text: "…mas nunca\ndesistiu.",                   astro: [0.22, 0.30], hold: 2.8 },
  { text: "Um dia,\nencontrou-a.",                   astro: [0.78, 0.52], hold: 3.0, flash: true },
  { text: "LARA",                                    astro: [0.82, 0.26], hold: 4.0, big: true, excited: true },
  { text: "A estrela mais\nespecial és tu.",         astro: [0.20, 0.32], hold: 3.8 },
  { text: "E hoje\nfazes 10 anos!",                  astro: [0.30, 0.26], hold: 3.0, excited: true },
  { text: "10",                                      astro: [0.78, 0.30], hold: 3.2, big: true, excited: true },
  { text: "Serás sempre a estrela\nmais brilhante\nna nossa galáxia!", astro: [0.50, 0.78], hold: 4.5, flash: true },
  { montage: true },   // as fotos convergem -> a estrela nasce -> explode
  { finale: true },
];

function fitStory(lines, maxW, maxH, start) {
  const font = G.swarm.font;
  let s = start;
  for (let i = 0; i < 28; i++) {
    let w = 0;
    for (const ln of lines) { const b = font.textBounds(ln || " ", 0, 0, s); w = Math.max(w, b.w); }
    const h = s * 1.18 * lines.length;
    if (w <= maxW && h <= maxH) break;
    s *= 0.92;
  }
  return s;
}

const Story = {
  started: false, i: 0, phase: "idle", t: 0, finale: false, tapCount: 0, msgA: 0,

  start() {
    this.started = true; this.finale = false; this.i = -1; this.tapCount = 0; this.msgA = 0;
    this.montage = null; this.slideshow = null;
    G.swarm.clear();
    G.fireworks.length = 0; G.hearts.length = 0; G.shockwaves.length = 0; G.flashes.length = 0;
    G.astro.pos.set(width * 0.5, -height * 0.2);   // entra de cima
    G.astro.size = Math.min(width, height) * 0.15;
    this.flash(width / 2, height * 0.46, [150, 210, 255], 1.15);   // clarão de entrada
    this.next();
  },

  next() {
    this.i++;
    if (this.i >= STORY.length) { this.i = STORY.length - 1; return; }
    const b = STORY[this.i];
    if (b.montage) return this.startMontage();
    if (b.finale) return this.startFinale();
    // texto em partículas
    const lines = b.text.split("\n");
    const big = !!b.big;
    const maxW = width * (big ? 0.86 : 0.8);
    const maxH = height * (big ? 0.4 : 0.42);
    const startS = big ? Math.min(width * 0.34, 460) : Math.min(width * 0.14, 150);
    const size = fitStory(lines, maxW, maxH, startS);
    const cy = height * 0.46;
    G.swarm.setText(b.text, { size, cx: width / 2, cy, sampleFactor: big ? 0.12 : 0.16 });
    // pose do Astro: astro-a-6 na saudação, astro-a-5 (flutua) no resto
    if (b.img === "hello") G.astro.setImg(AST.astroHello, () => AST.spriteHello);
    else G.astro.setImg(AST.astroFly, () => AST.spriteFly);
    // Astro vai para a posição do momento
    if (b.astro) G.astro.setTarget(width * b.astro[0], height * b.astro[1]);
    if (b.excited) { G.sparkles.burst(G.astro.pos.x, G.astro.pos.y, 18); Sound.sparkle(); for (let k = 0; k < 3; k++) this.spawnHeart(); }
    else Sound.whoosh();
    // clarão de luz a preencher a cena nas mudanças importantes
    if (b.excited || b.flash) this.flash(width / 2, height * 0.46, b.big ? [255, 225, 150] : [150, 210, 255], 1.0);
    this.phase = "assemble"; this.t = 0;
  },

  tap(x, y) {
    if (!this.started) return;
    if (this.finale) {   // festa: cada toque = rebentamento espetacular no ponto tocado
      this.tapCount++;
      this.celebrateAt(x, y);
      Sound.coin();
      if (this.tapCount === 1) Sound.fanfare();
      return;
    }
    // fora do final: tocar controla o ritmo. Se já está a dispersar, reforma já;
    // caso contrário, começa a dispersar (espalhar) antes da próxima frase.
    if (this.phase === "disperse") this.next();
    else this.beginDisperse();
  },

  beginDisperse() {
    this.phase = "disperse"; this.t = 0;
    G.swarm.disperse(G.calm ? 6 : 9);   // espalha por posições aleatórias
    Sound.whoosh();
  },

  spawnHeart(x, y, size) {
    const m = Math.min(width, height);
    x = x ?? rnd(width * 0.12, width * 0.88);
    y = y ?? rnd(height * 0.5, height * 0.86);   // dentro do ecrã (florescem à vista, já não sobem de fora)
    size = size ?? rnd(m * 0.1, m * 0.17);
    G.hearts.push(new PsHeart(x, y, size));
  },

  flash(x, y, color, strength) {
    G.flashes.push(new LightFlash(x, y, color, strength));
  },

  // rebentamento espetacular no ponto tocado (várias formas + onda de choque + faíscas + coração + luz)
  celebrateAt(x, y) {
    const m = Math.min(width, height);
    const pool = ["heart", "triangle", "cross", "square", "circle"];
    const nBursts = G.fireworks.length > 24 ? 1 : 3;   // trava se já estiver muito carregado
    for (let k = 0; k < nBursts; k++) {
      const fw = new Firework(x, y, pool[floor(rnd(pool.length))]);
      fw.explode();                                     // rebenta já onde ela tocou
      G.fireworks.push(fw);
    }
    if (G.shockwaves.length < 6) G.shockwaves.push(new Shockwave(x, y));
    G.sparkles.burst(x, y, 30, [255, 240, 180]);
    this.spawnHeart(x, y, m * 0.16);
    this.flash(x, y, [180, 225, 255], 0.7);
  },

  startFinale() {
    this.finale = true; this.phase = "finale"; this.t = 0; this.msgA = 0;
    const size = fitStory(["Parabéns", "Lara!"], width * 0.84, height * 0.42, Math.min(width * 0.26, 380));
    G.swarm.setText("Parabéns,\nLara!", { size, cx: width / 2, cy: height * 0.42, sampleFactor: 0.12 });
    G.astro.setImg(AST.astroDance, () => AST.spriteDance);   // pose de dança (animada) no final
    G.astro.setTarget(width * 0.5, height * 0.68);
    Sound.fanfare(); Sound.playMusic();
    if (AST.photos && AST.photos.length) this.slideshow = new Slideshow();   // fotos a passar em fundo
    this.flash(width / 2, height * 0.42, [190, 230, 255], 1.5);   // grande clarão de abertura do final
    ["heart", "triangle", "cross", "square", "circle"].forEach((sh, k) =>   // as cinco formas logo no arranque
      G.fireworks.push(new Firework(width * (0.18 + k * 0.16), height * (0.38 + (k % 2) * 0.16), sh)));
    for (let k = 0; k < 4; k++) this.spawnHeart();
  },

  startMontage() {
    this.phase = "montage";
    this.montage = new PhotoMontage((AST.photos && AST.photos.length) ? AST.photos : null);
    this.montage.onExplode = (cx, cy) => this._explodeToFinale(cx, cy);
    Sound.whoosh();
  },

  // a estrela nasce e explode: grande clarão + o "Parabéns Lara!" a nascer do centro
  _explodeToFinale(cx, cy) {
    this.flash(cx, cy, [210, 235, 255], 1.8);
    if (G.shockwaves.length < 6) G.shockwaves.push(new Shockwave(cx, cy, [200, 230, 255]));
    this.startFinale();
    const r = Math.min(width, height) * 0.04;
    for (const p of G.swarm.parts) if (p.active) { p.pos.set(cx + rnd(-r, r), cy + rnd(-r, r)); p.vel.set(rnd(-7, 7), rnd(-7, 7)); }
  },

  update() {
    if (!this.started) return;
    const dt = Math.min(deltaTime, 50);
    this.t += dt / 1000;
    G.astro.update();
    G.swarm.update();
    G.sparkles.update();
    G.fireworks.forEach(f => f.update());
    for (let k = G.fireworks.length - 1; k >= 0; k--) if (G.fireworks[k].done()) G.fireworks.splice(k, 1);

    G.shockwaves.forEach(s => s.update());
    for (let k = G.shockwaves.length - 1; k >= 0; k--) if (G.shockwaves[k].done()) G.shockwaves.splice(k, 1);
    G.flashes.forEach(f => f.update());
    for (let k = G.flashes.length - 1; k >= 0; k--) if (G.flashes[k].done()) G.flashes.splice(k, 1);

    // montagem de fotos -> estrela nasce -> explode
    if (this.montage) { this.montage.update(dt); if (this.montage.explodeDone) this.montage = null; }

    // corações a subir (símbolos PlayStation em forma de coração)
    G.hearts.forEach(h => h.update());
    for (let k = G.hearts.length - 1; k >= 0; k--) if (G.hearts[k].done()) G.hearts.splice(k, 1);
    this._heartT = (this._heartT || 0) + dt;
    const hInt = this.finale ? (G.calm ? 700 : 430) : (G.calm ? 3200 : 2200);
    if (this._heartT > hInt && G.hearts.length < 14 && this.phase !== "montage") { this._heartT = 0; this.spawnHeart(); }

    if (this.finale) {
      if (this.slideshow) this.slideshow.update(dt);
      const gap = G.calm ? 1100 : 650;
      this._fwT = (this._fwT || 0) + dt;
      if (this._fwT > gap) { this._fwT = 0; G.fireworks.push(new Firework()); }
      this.msgA = Math.min(1, this.msgA + dt / 1400);
      // o Astro dança — baloiça de lado a lado (e os jatos disparam com o movimento)
      G.astro.setTarget(width * 0.5 + Math.sin(this.t * 2.2) * width * 0.13,
                        height * 0.66 + Math.cos(this.t * 3.1) * height * 0.05);
      return;
    }

    const b = STORY[this.i] || {};
    // Tempo de leitura: multiplica quanto tempo cada frase fica formada.
    // ↑ estes números = mais tempo para ler. Modo calmo dá ainda mais.
    const readMul = G.calm ? 2.2 : 1.8;
    if (this.phase === "assemble" && this.t > 2.0) { this.phase = "hold"; this.t = 0; }
    else if (this.phase === "hold" && this.t > (b.hold || 3) * readMul) { this.beginDisperse(); }
    else if (this.phase === "disperse" && this.t > (G.calm ? 1.4 : 1.1)) { this.next(); }
  },

  draw() {
    if (this.slideshow && this.slideshow.mode === "bg") this.slideshow.draw();   // fotos a passar em fundo
    drawingContext.globalCompositeOperation = "lighter";   // brilho aditivo (barato, sem shadowBlur)
    G.flashes.forEach(f => f.draw());
    G.shockwaves.forEach(s => s.draw());
    G.hearts.forEach(h => h.draw());
    G.fireworks.forEach(f => f.draw());
    drawingContext.globalCompositeOperation = "source-over";
    G.swarm.draw();
    G.astro.draw();
    if (this.montage) this.montage.draw();
    G.sparkles.draw();
    if (this.slideshow && this.slideshow.mode === "fg") this.slideshow.draw();   // fotos em 1º plano
    if (this.finale) {
      push();
      textAlign(CENTER, CENTER); noStroke();
      fill(200, 225, 255, this.msgA * (150 + Math.sin(frameCount * 0.06) * 60));
      textFont("Segoe UI"); textStyle(NORMAL);
      textSize(Math.min(width * 0.045, 26));
      text("Toca no céu para festejar!", width / 2, height * 0.9);
      pop();
    }
  },
};

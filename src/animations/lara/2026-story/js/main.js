/* main.js — preload, canvas, fundo de espaço, input e arranque da história */

function preload() {
  AST.font = loadFont("fonts/OleoScriptSwashCaps-Regular.ttf");
}

// carrega um webp num <img> do browser (que REPRODUZ webp animado);
// desenhamos o frame atual com drawImage. Fica no DOM (invisível) p/ animar.
// fallback estático (frame 0) enquanto os frames animados não descodificam
function makeImg(src) { const im = new Image(); im.src = src; return im; }

// descodifica TODOS os frames do webp animado (WebCodecs) -> animação determinística
async function loadSprite(src, targetW) {
  if (typeof ImageDecoder === "undefined") return null;
  try {
    const buf = await (await fetch(src)).arrayBuffer();
    const dec = new ImageDecoder({ data: buf, type: "image/webp" });
    await dec.tracks.ready;
    const n = dec.tracks.selectedTrack.frameCount;
    const frames = [], durations = [];
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      durations.push((image.duration || 50000) / 1000);          // µs -> ms
      const s = targetW ? targetW / image.displayWidth : 1;
      const bmp = await createImageBitmap(image, {
        resizeWidth: Math.round(image.displayWidth * s),
        resizeHeight: Math.round(image.displayHeight * s), resizeQuality: "high",
      });
      frames.push(bmp); image.close();
    }
    dec.close();
    const total = durations.reduce((a, b) => a + b, 0) || n * 50;
    return { frames, durations, total, n, w: frames[0].width, h: frames[0].height };
  } catch (e) { if (window.console) console.warn("sprite decode falhou:", src, e && e.message); return null; }
}

function setup() {
  pixelDensity(1.5);   // menos carga de GPU (evita degradação/paragem em ecrãs de alta densidade)
  createCanvas(windowWidth, windowHeight);
  G.stars = new Starfield(240);
  G.swarm = new Swarm(AST.font);
  AST.astroFly = makeImg("assets/astro/astro-a-5.webp");    // fallback estático (flutua)
  AST.astroHello = makeImg("assets/astro/astro-a-6.webp");  // fallback (olá)
  AST.astroDance = makeImg("assets/astro/astro-a-4.webp");  // fallback (dança)
  G.astro = new Astro(AST.astroFly);
  // descodifica os frames animados em segundo plano (a animação real)
  loadSprite("assets/astro/astro-a-5.webp", 200).then(s => (AST.spriteFly = s));
  loadSprite("assets/astro/astro-a-6.webp", 200).then(s => (AST.spriteHello = s));
  loadSprite("assets/astro/astro-a-4.webp", 260).then(s => (AST.spriteDance = s));
  G.sparkles = new Sparkles();
  G.fireworks = [];
  G.hearts = [];
  G.shockwaves = [];
  G.flashes = [];
  wireUI();
}

function draw() {
  try {
    drawSpace();
    if (Story.started) { Story.update(); Story.draw(); }
  } catch (e) {
    // rede de segurança: uma exceção nunca deve matar o loop de animação
    if (window.console) console.warn("draw recuperado:", e && e.message);
  } finally {
    // garante que o modo de mistura nunca fica "preso" em aditivo
    if (window.drawingContext) drawingContext.globalCompositeOperation = "source-over";
  }
}

function drawSpace() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#0a1338"); g.addColorStop(0.55, "#070a20"); g.addColorStop(1, "#03040c");
  drawingContext.fillStyle = g; drawingContext.fillRect(0, 0, width, height);
  const m = Math.min(width, height);
  push(); noStroke();
  drawingContext.shadowBlur = 60; drawingContext.shadowColor = "rgba(27,157,255,0.5)";
  fill(34, 66, 140, 90); circle(width * 0.86, height * 0.16, m * 0.28);
  drawingContext.shadowBlur = 45; drawingContext.shadowColor = "rgba(130,95,210,0.4)";
  fill(64, 42, 116, 66); circle(width * 0.12, height * 0.85, m * 0.18);
  drawingContext.shadowBlur = 0; pop();
  G.stars.draw(0.5);
}

function begin() {
  Sound.init(); Sound.resume();
  G.calm = document.getElementById("calm").checked;
  G.sound = document.getElementById("sound").checked;
  document.getElementById("start").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  Story.start();
}

function wireUI() {
  document.getElementById("startBtn").addEventListener("click", begin);
  document.getElementById("replayBtn").addEventListener("click", () => { Sound.stopMusic(); Story.start(); });
  const calm = document.getElementById("calm"), sound = document.getElementById("sound");
  calm.addEventListener("change", () => (G.calm = calm.checked));
  sound.addEventListener("change", () => {
    G.sound = sound.checked;
    if (!G.sound) Sound.stopMusic(); else if (Story.finale) Sound.playMusic();
  });
}

function mousePressed() { Sound.resume(); if (Story.started) Story.tap(mouseX, mouseY); }
function touchStarted() { Sound.resume(); if (Story.started) Story.tap(mouseX, mouseY); return false; }
function touchMoved() { return false; }
function windowResized() { resizeCanvas(windowWidth, windowHeight); if (G.stars) G.stars.resize(); }

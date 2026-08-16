/* main.js — preload, canvas, fundo de espaço, input e arranque da história */

function preload() {
  AST.font = loadFont("fonts/OleoScriptSwashCaps-Regular.ttf");
}

// carrega um webp num <img> do browser (que REPRODUZ webp animado);
// desenhamos o frame atual com drawImage. Fica no DOM (invisível) p/ animar.
// fallback estático (frame 0) enquanto os frames animados não descodificam
function makeImg(src) { const im = new Image(); im.src = src; return im; }

// fotos da Lara: assets/photos/1.jpg, 2.jpg, ... (também .jpeg/.png/.webp)
const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"];
// testa existência SEM descodificar a imagem (HEAD é leve); fallback p/ Image (ex.: file://)
async function _photoHead(url) {
  try { return (await fetch(url, { method: "HEAD" })).ok; }
  catch (_) { return await new Promise(r => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = url; }); }
}
function _photoExists(i) {
  return (async () => {
    for (const e of PHOTO_EXTS) { if (await _photoHead(`assets/photos/${i}.${e}`)) return true; }
    return false;
  })();
}
// existe alguma foto perto do índice i (aguenta buracos de .mov)
async function _existsNear(i) {
  for (let d = 0; d < 3; d++) { if (await _photoExists(i + d)) return true; }
  return false;
}
// conta ~quantas fotos existem (1..N), robusto a buracos de .mov
async function countPhotos(cap = 3000) {
  if (!(await _existsNear(1))) return 0;
  let hi = 1;
  while (hi * 2 <= cap && await _existsNear(hi * 2)) hi *= 2;
  let lo = hi, h2 = Math.min(hi * 2, cap);
  while (lo < h2) { const mid = Math.ceil((lo + h2) / 2); if (await _existsNear(mid)) lo = mid; else h2 = mid - 1; }
  let last = lo;
  for (let d = 0; d <= 5; d++) { if (await _photoExists(lo + d)) last = lo + d; }   // a última exata
  return last;
}
// carrega a foto i, reduzida para ~targetW de largura (thumbnail, memória leve)
// PREFERE a miniatura pré-gerada (thumbs/i.jpg, muito mais leve) e só usa o
// original de 16MP se a miniatura não existir.
async function loadPhoto(i, targetW) {
  const urls = [`assets/photos/thumbs/${i}.jpg`, ...PHOTO_EXTS.map(e => `assets/photos/${i}.${e}`)];
  for (const url of urls) {
    const res = await new Promise(r => {
      const im = new Image(); im.decoding = "async";
      im.onload = async () => {
        try {
          const s = Math.min(1, targetW / im.naturalWidth);
          const bmp = await createImageBitmap(im, { resizeWidth: Math.max(1, Math.round(im.naturalWidth * s)), resizeHeight: Math.max(1, Math.round(im.naturalHeight * s)), resizeQuality: "medium" });
          // grelha de cores — a foto desfaz-se NESTAS partículas (cada uma com a cor do seu pixel)
          let grid = null;
          try {
            const GX = 6, GY = 5;
            const cv = document.createElement("canvas"); cv.width = GX; cv.height = GY;
            const cc = cv.getContext("2d"); cc.drawImage(bmp, 0, 0, GX, GY);
            const d = cc.getImageData(0, 0, GX, GY).data;
            grid = [];
            for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
              const o = (gy * GX + gx) * 4;
              grid.push({ u: (gx + 0.5) / GX, v: (gy + 0.5) / GY, r: d[o], g: d[o + 1], b: d[o + 2] });
            }
          } catch (_) { grid = null; }
          let avg = null;
          if (grid && grid.length) {
            let R = 0, Gg = 0, B = 0;
            for (const c of grid) { R += c.r; Gg += c.g; B += c.b; }
            avg = { r: Math.round(R / grid.length), g: Math.round(Gg / grid.length), b: Math.round(B / grid.length) };
          }
          r({ bmp, grid, avg });
        } catch (_) { r(null); }
      };
      im.onerror = () => r(null);
      im.src = url;
    });
    if (res && res.bmp) return res;
  }
  return null;
}
// carrega TODAS as fotos (até maxShow); com as miniaturas leves dá para as ter todas na estrela
async function loadPhotos(maxShow = 4000, targetW = 160) {
  const total = await countPhotos();
  if (!total) return [];
  let idxs;
  if (total <= maxShow) idxs = Array.from({ length: total }, (_, k) => k + 1);
  else {
    const set = new Set();
    for (let k = 0; k < maxShow; k++) set.add(1 + Math.round(k * (total - 1) / (maxShow - 1)));
    set.add(total);                                  // a última = a estrela nasceu
    idxs = [...set].sort((a, b) => a - b);
  }
  // carrega em lotes e CEDE o fio principal ao browser entre cada lote (miniaturas -> leve)
  // (assim o clique em "Começar" e a animação nunca congelam durante o carregamento)
  const out = [];
  const BATCH = 8;
  // resolve no próximo frame OU passados 32ms — nunca fica preso se o rAF não disparar
  // (ex.: separador em segundo plano), mas cede na mesma para o browser desenhar
  const yieldFrame = () => new Promise(r => {
    let done = false; const fin = () => { if (!done) { done = true; r(); } };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(fin);
    setTimeout(fin, 32);
  });
  for (let s = 0; s < idxs.length; s += BATCH) {
    const res = await Promise.all(idxs.slice(s, s + BATCH).map(i => loadPhoto(i, targetW)));
    for (const r of res) if (r) out.push(r);
    if (typeof AST !== "undefined") AST.photos = out;   // progressivo: dá para ver o progresso
    await yieldFrame();
  }
  if (window.console) console.log(`fotos: ${total} no total, ${out.length} na montagem`);
  return out;
}

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
  AST.photos = [];
  AST.photosDone = false;   // true = carregamento terminou (mesmo que 0 fotos, ex.: versão pública)
  loadPhotos()
    .then(ps => { AST.photos = ps; if (ps.length && window.console) console.log(ps.length + " fotos carregadas"); })
    .catch(e => { if (window.console) console.warn("fotos falharam:", e && e.message); })
    .finally(() => { AST.photosDone = true; });
  wireUI();
}

function draw() {
  try {
    drawSpace();
    if (Story.started) { Story.update(); Story.draw(); }
    const sb = document.getElementById("slideBtn");
    if (sb) sb.style.display = Story.slideshow ? "flex" : "none";   // botão só no final
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
  Sound.playMusic();   // música desde o início (o clique em Começar é o gesto que desbloqueia o áudio)
  document.getElementById("start").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  Story.start();
}

function wireUI() {
  document.getElementById("startBtn").addEventListener("click", begin);
  document.getElementById("replayBtn").addEventListener("click", () => { Sound.stopMusic(); Story.start(); });
  document.getElementById("slideBtn").addEventListener("click", () => { if (Story.slideshow) Story.slideshow.toggle(); });
  const calm = document.getElementById("calm"), sound = document.getElementById("sound");
  calm.addEventListener("change", () => (G.calm = calm.checked));
  sound.addEventListener("change", () => {
    G.sound = sound.checked;
    if (!G.sound) Sound.stopMusic(); else if (Story.started) Sound.playMusic();
  });
}

function mousePressed() { Sound.resume(); if (Story.started) Story.tap(mouseX, mouseY); }
function touchStarted() { Sound.resume(); if (Story.started) Story.tap(mouseX, mouseY); return false; }
function touchMoved() { return false; }
function windowResized() { resizeCanvas(windowWidth, windowHeight); if (G.stars) G.stars.resize(); }

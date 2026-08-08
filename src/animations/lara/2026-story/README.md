# Uma história para a Lara ✨

Uma **experiência-história** para os 10 anos da Lara. A história é **escrita em partículas**,
parte a parte, sobre uma galáxia; o **Astro** acompanha como companheiro visual. No fim, a
parte **interativa**: ela toca no céu para lançar fogo de artifício sob um "Parabéns Lara!".

A história (resumo): *o Astro procura, pela galáxia, a estrela mais especial de todas… e
descobre que é a **Lara**, que hoje faz **10 anos**.*

## Correr localmente
```bash
cd src/animations/lara/2026-story
python3 -m http.server 8125
```
Abrir **http://localhost:8125** (servidor, não `file://`). Ecrã inteiro (F11) fica ótimo.
- **Começar** desbloqueia o som.
- **Tocar no ecrã** avança a história (auto-ritmo: também avança sozinha).
- No fim, **tocar** lança fogo de artifício. **↺** recomeça.

## ✍️ Mudar o texto da história (fácil)
Edita o array **`STORY`** no topo de [`js/story.js`](js/story.js). Cada linha é uma "parte":
```js
{ text: "A mais brilhante\nde todas.", astro: [0.22, 0.68], hold: 2.8 },
```
- `text` — usa `\n` para partir em duas linhas.
- `astro` — `[x,y]` em fração do ecrã: onde o Astro se posiciona nesse momento.
- `hold` — segundos que a frase fica no ecrã.
- `big: true` — texto grande (para nomes/números, ex.: `LARA`, `10`).
- `excited: true` — o Astro solta faíscas nesse momento.

## Música (opcional)
Coloca o ficheiro em **`music/theme.mp3`** (toca no final). Sem ele, os efeitos
(faíscas, moedas, fanfarra) continuam a funcionar — são sintetizados.

## Pensado para a Lara
- Modo calmo (fogo de artifício suave), **sem falhas nem pressão**.
- Auto-ritmo **e** toque para avançar → ela controla o tempo dela.
- Astro sempre com a **arte real** do jogo (2D, limpa).

## Ficheiros
- `js/story.js` — a história (`STORY`) + sequenciador + final interativo ← **edita aqui**
- `js/engine.js` — partículas (enxame de texto), Astro, fogo de artifício, faíscas, áudio
- `js/main.js` — canvas, fundo de espaço, input
- `assets/astro/` — arte do Astro · `fonts/` · `vendor/p5.min.js`

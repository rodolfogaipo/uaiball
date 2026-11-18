# Uai Ball – Pinball Mineiro

Pinball rústico mineiro feito em **Phaser 3 + Matter.js** (física já inclusa no Phaser). PWA pronta para GitHub Pages.

## Publicar no GitHub Pages
1. Crie um repositório (ex.: `uai-ball`).
2. Arraste **todo o conteúdo desta pasta** para o repositório (Add file → Upload files).
3. Settings → Pages → Branch `main` / pasta `/ (root)` → Save.
4. Abra `https://SEU-USUARIO.github.io/uai-ball/`.

## Estrutura
```
index.html  style.css  main.js  manifest.json  sw.js  firebase-rules.json
js/config.js     ← TUDO que se ajusta: física, dificuldades, geometria da mesa, Firebase
js/services.js   ← sons, ranking, armazenamento, botões
js/lights.js     ← sistema de luzes
scenes/          ← Boot, Menu, Game, GameOver, Ranking
assets/          ← logo, mesa, flipper (+flipper2), bumper, ball, ícones
```
As imagens em `assets/` já estão recortadas com fundo transparente.

## Controles
| Ação | Teclado | Celular |
|---|---|---|
| Palheta esquerda | ← , A ou Shift esquerdo | toque na metade esquerda |
| Palheta direita | → , D ou Shift direito | toque na metade direita |
| Mola | segure ↓ / Espaço e solte | com a bola no corredor, toque no canto inferior direito e arraste para cima |
| Sacudir a mesa | ↑ ou W | — |
| Pausa | P / Esc | botão II |

## Debug e editor da mesa
- **G** – mostra as colisões em vermelho (sensores em amarelo). Ou abra com `?debug=1`.
- **E** – editor: arraste os pontos (vermelho = paredes, laranja = estilingues/blocos, azul-claro = bumpers, verde = pivô das palhetas, amarelo = sensores, rosa = luzes, azul = saída da bola).
  - **N** adiciona ponto · **X** apaga ponto · **+ / -** muda o raio do bumper selecionado
  - **C** copia o JSON → cole em `js/config.js` no lugar de `UAI.DEFAULT_TABLE` (aumente o `version`)
  - **R** volta ao padrão. As edições ficam salvas no navegador enquanto o config.js não mudar.

## Ranking online (Firebase Realtime Database)
1. Em console.firebase.google.com crie um projeto → **Realtime Database** → Criar banco.
2. Na aba **Regras**, cole o conteúdo de `firebase-rules.json` e publique.
3. Copie a URL do banco (ex.: `https://uai-ball-default-rtdb.firebaseio.com`) para `FIREBASE_DB_URL` em `js/config.js`.

Sem a URL, o jogo usa um ranking local do aparelho (funciona offline).

## Regras e pontuação
3 bolas (com **bola salva** nos primeiros segundos de cada bola no Fácil e no Médio).

| Alvo | Pontos |
|---|---|
| Bumper (engrenagem) | 100 |
| Rampa da ferradura (entra pelas varetas da direita, sai pelo braço esquerdo) | 1.000 |
| Rampa reversa (sobe o braço esquerdo, desce pela direita) | 1.000 |
| Órbita da câmara da mola (lado esquerdo) | 500 |
| Buraco estrela/caveira | 750 (os 3 acesos = Mina de Ouro 3.000) |
| Buraco negro + túnel até a mola | 1.500 + 250 |
| Cubo da roda central (choque que acelera a bola) | 100 |
| Estilingue | 10 · Triângulos 50 (os 3 = 1.000) |

O multiplicador sobe a cada 5.000 pontos (até x8, mostrado no quadro de luzes).

## Física
O jogo usa um **motor de física próprio de pinball** (`js/physics.js`), feito com base no
código aberto do **Visual Pinball X** e do **Space Cadet Pinball**:
- 1000 passos de física por segundo (bola nunca atravessa parede)
- palheta gira de verdade: a ponta bate mais forte que a base
- borracha perde elasticidade em batidas fortes (falloff do VPX)
- bumpers e estilingues só chutam acima de um impacto mínimo
- buraco negro com campo de atração

Os valores ficam em `js/config.js` (bloco `UAI.PHYSICS` e `UAI.DIFFICULTIES`).

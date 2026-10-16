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
| Palheta esquerda | ← ou A | toque na metade esquerda |
| Palheta direita | → ou D | toque na metade direita |
| Mola | segure ↓ / Espaço e solte | com a bola no corredor, toque no canto inferior direito e arraste para cima |
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

## Regras
3 bolas · Bumper 100 · Rampa completa 500 · Estilingue 10 · Triângulos 50 (os 3 = 1.000) · multiplicador sobe a cada 5.000 pontos (até x8, mostrado no quadro de luzes).
A rampa é a ferradura do topo: entre por baixo do braço esquerdo ou pelo acelerador do lado direito e dê a volta completa.

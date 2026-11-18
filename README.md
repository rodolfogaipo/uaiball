# Uai Ball – Pinball Mineiro

Pinball rústico mineiro de madeira pirogravada, com **11 mesas**, carreira do jogador
(níveis, estrelas, conquistas, desafio do dia) e ranking por mesa.
Feito em **Phaser 3** (desenho e som) + **motor de física próprio** (`js/physics.js`). PWA pronta para GitHub Pages.

## Publicar no GitHub Pages
1. No repositório (ex.: `uai-ball`), apague os arquivos antigos ou suba por cima.
2. Arraste **todo o conteúdo desta pasta** (com as pastas `js`, `scenes`, `assets`) em Add file → Upload files → Commit.
3. Settings → Pages → Branch `main` / pasta `/ (root)` → Save.
4. Abra `https://SEU-USUARIO.github.io/uai-ball/` (se aparecer a versão velha, recarregue a página 2 vezes).

## Estrutura
```
index.html  style.css  main.js  manifest.json  sw.js  firebase-rules.json
js/config.js          ← Firebase, física comum, dificuldades, pontos
js/physics.js         ← motor de física de pinball (várias bolas)
js/progress.js        ← carreira: XP, níveis, estrelas, desbloqueio, conquistas, desafio do dia
js/services.js        ← sons, ranking por mesa, armazenamento, botões
js/lights.js          ← luzes (lâmpadas com brilho em estrela, pisca-pisca e shows de luz – estilo Space Cadet)
js/render/parts.js    ← bumpers 3D com 4 níveis (apagado/aceso), onda de choque, faíscas
js/tables/kit.js      ← "esqueleto" e peças para montar mesas
js/tables/t01_uaiball.js   ← mesa 1 (reconstruída da arte original: tudo o que aparece funciona)
js/tables/t02_t06.js  ← mesas 2 a 6
js/tables/t07_t11.js  ← mesas 7 a 11
js/render/tableArt.js ← desenha as 11 mesas (arte pintada, insertos, metais, verniz)
scenes/               ← Boot, Menu, TableSelect, Profile, Game (+GameRules, GameEditor), GameOver, Ranking
assets/               ← logo, mesa, flipper (+flipper2), bumper, ball, ícones
```

## As mesas (cada uma libera com 1 ⭐ na anterior)
1. **Uai Ball** – a mesa original · 2. **Cozinha da Vó** · 3. **Maria Fumaça** · 4. **Ouro Preto** ·
5. **Serra da Canastra** · 6. **Mineirão** · 7. **Arraiá** · 8. **Diamantina** · 9. **Capitólio** (sem kickback) ·
10. **Inhotim** · 11. **Avanço Tecnológico** (a mais difícil)

Cada mesa tem 3 metas de estrela, 4 missões, travas de bola para a multibola e física própria (mais rápida nas últimas).

## Regras
- **Tacada de mestre**: solte a mola quando a luz verde do medidor acender.
- **Missões** aparecem na barra de baixo; cumprir as 4 = **MESA DOMINADA** (e elas recomeçam valendo o dobro).
- **Travas**: 3 bolas no buraco de trava = **MULTIBOLA**. Na multibola, rampas e buracos dão **JACKPOT**; 3 jackpots = **SUPER JACKPOT**.
  Em algumas mesas a trava precisa ser acesa antes (derrubando/acertando o grupo indicado).
- **Pistas de cima**: mude a luz com as palhetas; completar = **bônus 2x, 3x...**
- **Saídas laterais** (outlanes): a bola se perde, a não ser que o **KICKBACK** esteja aceso.
- **Combo**: emende tiros em menos de 5 s. **Bola extra** em alguns alvos.
- **Sacudir** ajuda, mas 3 sacudidas seguidas dão **TILT** (perde a bola e o bônus).
- O **multiplicador** da mesa sobe com os pontos (até x8); no fim de cada bola vem o **bônus** × multiplicador de bônus.

## Carreira
XP a cada partida → nível e título (Visitante, Forasteiro, Caipira, Tropeiro... **Lenda de Minas**),
18 conquistas, desafio do dia (+1.000 XP) e sequência de dias seguidos. Tudo salvo no aparelho.

## Controles
| Ação | Teclado | Celular |
|---|---|---|
| Palheta esquerda | ← , A ou Shift esquerdo | toque na metade esquerda |
| Palheta direita | → , D ou Shift direito | toque na metade direita |
| Mola | segure ↓ / Espaço e solte | toque no canto inferior direito e arraste para cima |
| Sacudir a mesa | ↑ ou W | toque no alto da tela |
| Pausa | P / Esc | botão II |

## Debug e editor da mesa
- **G** – mostra as colisões (vermelho), sensores (amarelo), rampas (azul). Ou abra com `?debug=1`.
- **E** – editor de pontos da mesa que está aberta; a edição fica salva no aparelho, separada por mesa.
  **N** adiciona ponto · **X** apaga · **+ / -** raio do bumper · **C** copia o JSON · **R** volta ao padrão.

## Ranking online (Firebase Realtime Database)
1. Em console.firebase.google.com crie um projeto → **Realtime Database** → Criar banco.
2. Na aba **Regras**, cole o conteúdo de `firebase-rules.json` e publique.
3. Copie a URL do banco para `FIREBASE_DB_URL` em `js/config.js`.
Cada mesa tem seu Top 10 (`uaiball/scores/<mesa>`). Sem a URL, o ranking fica no aparelho.

## Física
Motor próprio baseado no código aberto do **Visual Pinball X** e do **Space Cadet Pinball**:
1000 passos por segundo, palheta que gira de verdade, borracha que perde elasticidade em batidas fortes,
bumpers/estilingues com limiar de chute, buraco negro com campo de atração, várias bolas com colisão entre elas,
alvos que caem e rampas aéreas de arame.

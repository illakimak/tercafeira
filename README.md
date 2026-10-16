# ITO online

Versão online do jogo de ordenar números secretos por dicas, para jogar com os amigos.
Servidor Node + Socket.IO (os números secretos ficam só no servidor) e cliente React + Vite.

Este projeto é uma versão pessoal feita para jogar entre amigos. ITO é um jogo publicado por terceiros, então mantenha o app privado e use arte e identidade próprias (as deste projeto são originais).

## Rodar na sua máquina

Precisa do Node 18 ou mais novo.

```bash
npm run setup   # instala as dependências da raiz, do servidor e do cliente
npm run dev     # sobe o servidor (porta 3001) e o cliente (porta 5173)
```

Abra http://localhost:5173, crie uma sala e passe o código (ou o link) para os amigos.

## Jogar com amigos de verdade

- **Mesma rede Wi-Fi:** o Vite mostra o endereço "Network" ao subir (algo como `http://192.168.0.10:5173`). Mande esse endereço.
- **Pela internet, sem hospedar nada:** deixe `npm run dev` rodando e abra um túnel, por exemplo `npx localtunnel --port 5173`. Mande o link que ele gerar.
- **Permanente:** hospede o projeto inteiro como um único serviço (Render, Railway, Fly.io). No Render:
  - Build command: `npm run setup && npm run build`
  - Start command: `npm start`
  - O servidor entrega o app compilado e o socket na mesma porta, sem configurar mais nada.
  - No plano gratuito o serviço "dorme" quando fica parado; a primeira visita demora alguns segundos.

## Como a partida funciona

1. O anfitrião cria a sala, ajusta vidas e rodadas e começa a partida (mínimo de 2 jogadores).
2. Cada jogador recebe um número secreto único de 1 a 100 e vê o tema da rodada.
3. Todos enviam uma dica. Quando a última chega, as cartas vão para a mesa em ordem aleatória.
4. Qualquer jogador arrasta as cartas e todos veem a mudança em tempo real.
5. O anfitrião revela os números. Se alguma carta estiver fora do lugar, o grupo perde uma vida.
6. A partida termina quando as vidas acabam (derrota) ou as rodadas terminam (vitória).

Quem cai ou atualiza a página volta para a mesma sala automaticamente. Quem entra no meio de uma rodada joga a partir da próxima.

## Estrutura

```
server/
  game.js     regras do jogo (sem dependências, fácil de testar)
  index.js    salas e eventos do Socket.IO, e entrega o cliente compilado
  themes.js   lista de temas (acrescente os seus: título, extremo baixo, extremo alto)
  test.js     simula uma partida completa com 3 jogadores (npm test)
client/
  src/screens/      Home, Lobby, Clues, Table (arrastar e revelar), GameOver
  src/components/   Hud, ThemeBanner, PlayerList
  src/styles.css    tokens no :root (cores, rampa, fontes) e todos os estilos
```

## Personalizar

- **Visual:** as cores da rampa (`--r1` a `--r10`), as fontes e a sombra estão como variáveis no topo de `client/src/styles.css`.
- **Temas:** edite `server/themes.js`.
- **Regras:** o limite de jogadores e o tamanho das dicas ficam no topo de `server/game.js`.

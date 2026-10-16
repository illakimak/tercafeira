import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import * as game from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const LOBBY_GRACE_MS = 30_000; // tempo para voltar (F5) antes de sumir do lobby
const EMPTY_ROOM_TTL_MS = 30 * 60_000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" },
});

const rooms = new Map();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I e O, para não confundir com 1 e 0

function newCode() {
  for (;;) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
}

function broadcast(room) {
  for (const p of room.players.values()) {
    if (p.socketId) io.to(p.socketId).emit("state", game.viewFor(room, p.id));
  }
}

const cleanName = (raw) =>
  String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, game.MAX_NAME_LENGTH);

const isId = (v) => typeof v === "string" && v.length >= 8 && v.length <= 64;

function attach(socket, room, player) {
  player.socketId = socket.id;
  player.connected = true;
  socket.data.code = room.code;
  socket.data.playerId = player.id;
  room.emptySince = null;
}

function dropRoomIfEmpty(room) {
  if (room.players.size === 0) rooms.delete(room.code);
}

io.on("connection", (socket) => {
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    const player = room?.players.get(socket.data.playerId);
    return room && player ? { room, player } : null;
  };

  const leaveCurrent = () => {
    const c = ctx();
    if (!c) return;
    game.removePlayer(c.room, c.player.id);
    socket.data.code = null;
    socket.data.playerId = null;
    dropRoomIfEmpty(c.room);
    if (rooms.has(c.room.code)) broadcast(c.room);
  };

  // Envolve um handler que precisa de sala (e, opcionalmente, do anfitrião).
  // O handler devolve uma mensagem de erro ou null.
  const withRoom =
    (handler, { host = false } = {}) =>
    (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      const c = ctx();
      if (!c) return reply({ ok: false, error: "Você não está em uma sala." });
      if (host && c.room.hostId !== c.player.id) {
        return reply({ ok: false, error: "Só o anfitrião pode fazer isso." });
      }
      const error = handler(c.room, c.player, payload ?? {});
      if (error) return reply({ ok: false, error });
      broadcast(c.room);
      reply({ ok: true });
    };

  socket.on("room:create", ({ playerId, name } = {}, ack) => {
    const clean = cleanName(name);
    if (!isId(playerId) || !clean) {
      return ack?.({ ok: false, error: "Digite seu nome para criar a sala." });
    }
    leaveCurrent();
    const room = game.createRoom(newCode());
    rooms.set(room.code, room);
    const player = game.addPlayer(room, playerId, clean);
    attach(socket, room, player);
    broadcast(room);
    ack?.({ ok: true, code: room.code });
  });

  socket.on("room:join", ({ playerId, name, code } = {}, ack) => {
    const clean = cleanName(name);
    if (!isId(playerId) || !clean) {
      return ack?.({ ok: false, error: "Digite seu nome para entrar." });
    }
    const room = rooms.get(String(code ?? "").trim().toUpperCase());
    if (!room) {
      return ack?.({ ok: false, error: "Sala não encontrada. Confira o código." });
    }
    let player = room.players.get(playerId);
    if (!player) {
      if (room.players.size >= game.MAX_PLAYERS) {
        return ack?.({ ok: false, error: "A sala está cheia." });
      }
      if (socket.data.code && socket.data.code !== room.code) leaveCurrent();
      player = game.addPlayer(room, playerId, clean);
    } else {
      player.name = clean;
    }
    attach(socket, room, player);
    broadcast(room);
    ack?.({ ok: true, code: room.code });
  });

  // Reconexão depois de F5 ou queda de rede
  socket.on("room:resume", ({ playerId, code } = {}, ack) => {
    const room = rooms.get(String(code ?? "").trim().toUpperCase());
    const player = room?.players.get(playerId);
    if (!room || !player) return ack?.({ ok: false });
    attach(socket, room, player);
    broadcast(room);
    ack?.({ ok: true, code: room.code });
  });

  socket.on("room:leave", (_payload, ack) => {
    leaveCurrent();
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on(
    "settings:update",
    withRoom(
      (room, _p, payload) =>
        game.updateSettings(room, payload) ? null : "Não dá para mudar as regras agora.",
      { host: true },
    ),
  );
  socket.on("game:start", withRoom((room) => game.startGame(room), { host: true }));
  socket.on("clue:submit", withRoom((room, p, { text }) => game.submitClue(room, p.id, text)));
  socket.on("order:move", withRoom((room, _p, { order }) => game.moveOrder(room, order)));
  socket.on("game:reveal", withRoom((room) => game.reveal(room), { host: true }));
  socket.on("round:next", withRoom((room) => game.nextRound(room), { host: true }));
  socket.on("game:end", withRoom((room) => game.endGame(room), { host: true }));
  socket.on("game:lobby", withRoom((room) => game.backToLobby(room), { host: true }));
  socket.on("theme:suggest", withRoom((room, p, { text, low, high }) => game.suggestTheme(room, p.id, { text, low, high })));
  socket.on("theme:pick", withRoom((room) => game.forcePick(room), { host: true }));

  socket.on("disconnect", () => {
    const c = ctx();
    // se o jogador já reconectou em outra aba, não marca como offline
    if (!c || c.player.socketId !== socket.id) return;
    const { room, player } = c;
    game.handleDisconnect(room, player.id);
    broadcast(room);

    if (room.phase === "lobby") {
      setTimeout(() => {
        const r = rooms.get(room.code);
        const p = r?.players.get(player.id);
        if (r && p && !p.connected && r.phase === "lobby") {
          game.removePlayer(r, p.id);
          dropRoomIfEmpty(r);
          if (rooms.has(r.code)) broadcast(r);
        }
      }, LOBBY_GRACE_MS).unref();
    }
  });
});

// Limpa salas abandonadas
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (game.connectedPlayers(room).length === 0) {
      room.emptySince ??= now;
      if (now - room.emptySince > EMPTY_ROOM_TTL_MS) rooms.delete(code);
    } else {
      room.emptySince = null;
    }
  }
}, 60_000).unref();

app.get("/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

// Em produção o próprio servidor entrega o app React já compilado
const dist = path.join(__dirname, "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`terça-feira rodando em http://localhost:${PORT}`);
});

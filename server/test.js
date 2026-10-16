// Simula uma partida completa com 3 jogadores conectados por socket.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3055;

const server = spawn(process.execPath, ["index.js"], {
  cwd: dir,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((resolve) =>
  server.stdout.on("data", (d) => String(d).includes("rodando") && resolve()),
);

const sockets = [];

function player(name) {
  const socket = io(`http://localhost:${PORT}`);
  sockets.push(socket);
  const id = `${name}-id-0000000000`;
  let state = null;
  const waiters = [];
  socket.on("state", (s) => {
    state = s;
    waiters.splice(0).forEach((w) => w());
  });
  const emit = (event, payload = {}) =>
    new Promise((resolve) => socket.emit(event, payload, resolve));
  const until = async (pred, label) => {
    const deadline = Date.now() + 3000;
    while (!state || !pred(state)) {
      if (Date.now() > deadline) {
        throw new Error(`timeout esperando: ${label}\nestado: ${JSON.stringify(state)}`);
      }
      await new Promise((r) => {
        waiters.push(r);
        setTimeout(r, 100);
      });
    }
  };
  return { name, id, socket, emit, until, get state() { return state; } };
}

const noNumbers = (s) => {
  const { me, ...rest } = s;
  return !JSON.stringify(rest).includes('"number"');
};

try {
  const ana = player("ana");
  const leo = player("leo");
  const bia = player("bia");
  const all = [ana, leo, bia];

  // --- sala ---
  const created = await ana.emit("room:create", { playerId: ana.id, name: "Ana" });
  assert.ok(created.ok);
  const code = created.code;
  assert.match(code, /^[A-Z]{4}$/);

  const bad = await leo.emit("room:join", { playerId: leo.id, name: "Leo", code: "ZZZZ" });
  assert.equal(bad.ok, false);

  for (const p of [leo, bia]) {
    const r = await p.emit("room:join", { playerId: p.id, name: p.name, code: code.toLowerCase() });
    assert.ok(r.ok);
  }
  await ana.until((s) => s.players.length === 3, "3 jogadores no lobby");

  assert.equal((await leo.emit("game:start")).ok, false, "só o anfitrião inicia");
  assert.equal((await leo.emit("settings:update", { lives: 5 })).ok, false);
  assert.ok((await ana.emit("settings:update", { lives: 2, rounds: 2 })).ok);
  assert.ok((await ana.emit("game:start")).ok);

  // --- rodada 1: dicas ---
  for (const p of all) await p.until((s) => s.phase === "clues" && s.me.number, "fase de dicas");
  const numbers = all.map((p) => p.state.me.number);
  assert.equal(new Set(numbers).size, 3, "números únicos");
  for (const p of all) assert.ok(noNumbers(p.state), "números dos outros não vazam nas dicas");

  assert.equal((await ana.emit("clue:submit", { text: "   " })).ok, false);
  for (const p of all) assert.ok((await p.emit("clue:submit", { text: `dica de ${p.name}` })).ok);

  // --- rodada 1: mesa ---
  for (const p of all) await p.until((s) => s.phase === "ordering", "fase de ordenação");
  assert.equal(ana.state.cards.length, 3);
  for (const p of all) assert.ok(noNumbers(p.state), "números não vazam na mesa");

  const correct = [...all].sort((a, b) => a.state.me.number - b.state.me.number).map((p) => p.id);
  assert.equal((await leo.emit("order:move", { order: ["x", "y", "z"] })).ok, false);
  assert.ok((await leo.emit("order:move", { order: correct })).ok);
  await ana.until((s) => s.cards.map((c) => c.id).join() === correct.join(), "ordem sincronizada");

  assert.equal((await leo.emit("game:reveal")).ok, false, "só o anfitrião revela");
  assert.ok((await ana.emit("game:reveal")).ok);
  await bia.until((s) => s.phase === "reveal", "revelação");
  assert.equal(bia.state.result.allCorrect, true);
  assert.equal(bia.state.lives, 2, "acertou: mantém as vidas");
  assert.ok(bia.state.cards.every((c) => c.ok && Number.isInteger(c.number)));

  // --- rodada 2: erro de propósito ---
  assert.ok((await ana.emit("round:next")).ok);
  for (const p of all) await p.until((s) => s.phase === "clues" && s.round === 2, "rodada 2");
  for (const p of all) await p.emit("clue:submit", { text: `outra de ${p.name}` });
  for (const p of all) await p.until((s) => s.phase === "ordering", "ordenação da rodada 2");

  const wrong = [...all]
    .sort((a, b) => b.state.me.number - a.state.me.number)
    .map((p) => p.id);
  await bia.emit("order:move", { order: wrong });
  await ana.until((s) => s.cards.map((c) => c.id).join() === wrong.join(), "ordem errada sincronizada");
  await ana.emit("game:reveal");
  await leo.until((s) => s.phase === "reveal", "revelação 2");
  assert.equal(leo.state.result.allCorrect, false);
  assert.equal(leo.state.lives, 1, "errou: perde uma vida");
  assert.ok(leo.state.cards.some((c) => !c.ok));

  // --- fim de jogo e volta ao lobby ---
  await ana.emit("round:next");
  await bia.until((s) => s.phase === "gameover", "fim de jogo");
  assert.equal(bia.state.outcome, "won");
  assert.ok((await ana.emit("game:lobby")).ok);
  await leo.until((s) => s.phase === "lobby", "volta ao lobby");

  // --- reconexão ---
  leo.socket.disconnect();
  await ana.until((s) => s.players.find((p) => p.id === leo.id)?.connected === false, "leo offline");
  const leo2 = player("leo");
  assert.ok((await leo2.emit("room:resume", { playerId: leo.id, code })).ok);
  await ana.until((s) => s.players.find((p) => p.id === leo.id)?.connected === true, "leo de volta");

  console.log("✔ todos os testes passaram");
} catch (err) {
  console.error("✘ falhou:", err.message);
  process.exitCode = 1;
} finally {
  sockets.forEach((s) => s.close());
  server.kill();
}

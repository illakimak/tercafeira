import { THEMES } from "./themes.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const MAX_CLUE_LENGTH = 60;
export const MAX_NAME_LENGTH = 16;

// Fases: lobby -> (theme-vote)? -> clues -> ordering -> reveal -> (theme-vote | clues | gameover) -> lobby

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRoom(code) {
  return {
    code,
    hostId: null,
    phase: "lobby",
    players: new Map(),
    settings: { themeMode: "auto" },
    errors: 0,
    correct: 0,
    round: 0,
    theme: null,
    usedThemes: [],
    themeSuggestions: new Map(),
    themeSamples: [],
    hovering: new Map(), // playerId -> cardId
    order: [],
    result: null,
    emptySince: null,
  };
}

export function addPlayer(room, id, name) {
  const player = {
    id,
    name,
    connected: true,
    socketId: null,
    inRound: false,
    number: null,
    clue: "",
  };
  room.players.set(id, player);
  if (!room.hostId) room.hostId = id;
  return player;
}

export function connectedPlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}

function pickAutoTheme(room) {
  let pool = THEMES.filter((t) => !room.usedThemes.includes(t.title));
  if (pool.length === 0) {
    room.usedThemes = [];
    pool = THEMES;
  }
  const theme = pool[Math.floor(Math.random() * pool.length)];
  room.usedThemes.push(theme.title);
  return theme;
}

export function updateSettings(room, { themeMode } = {}) {
  if (room.phase !== "lobby") return false;
  room.settings = {
    themeMode: ["auto", "vote"].includes(themeMode) ? themeMode : room.settings.themeMode,
  };
  return true;
}

function startRound(room) {
  room.round += 1;
  room.phase = "clues";
  room.result = null;
  room.order = [];
  room.hovering = new Map();

  for (const p of room.players.values()) {
    p.inRound = false;
    p.number = null;
    p.clue = "";
  }
  const numbers = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
  connectedPlayers(room).forEach((p, i) => {
    p.inRound = true;
    p.number = numbers[i];
  });
}

function startThemeVotePhase(room) {
  room.phase = "theme-vote";
  room.themeSuggestions = new Map();
  room.hovering = new Map();
  const pool = THEMES.filter((t) => !room.usedThemes.includes(t.title));
  const source = pool.length >= 5 ? pool : [...THEMES];
  room.themeSamples = shuffle(source).slice(0, 5);
}

function checkThemeProgress(room) {
  if (room.phase !== "theme-vote") return;
  const connected = connectedPlayers(room);
  if (connected.length === 0) return;
  if (connected.every((p) => room.themeSuggestions.has(p.id))) {
    applyRandomSuggestion(room);
  }
}

function applyRandomSuggestion(room) {
  const suggestions = [...room.themeSuggestions.values()];
  const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
  const fromList = THEMES.find((t) => t.title === picked.text);
  room.theme = {
    title: picked.text,
    low: picked.low || (fromList?.low ?? "pouco"),
    high: picked.high || (fromList?.high ?? "muito"),
  };
  startRound(room);
}

export function suggestTheme(room, playerId, { text, low, high } = {}) {
  if (room.phase !== "theme-vote") return "Não é hora de sugerir tema.";
  const clean = String(text ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CLUE_LENGTH);
  if (!clean) return "Escreva uma sugestão de tema.";
  const cleanLow = String(low ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CLUE_LENGTH);
  const cleanHigh = String(high ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CLUE_LENGTH);
  room.themeSuggestions.set(playerId, { text: clean, low: cleanLow, high: cleanHigh });
  checkThemeProgress(room);
  return null;
}

export function forcePick(room) {
  if (room.phase !== "theme-vote") return "Não é hora de sortear tema.";
  if (room.themeSuggestions.size === 0) return "Ninguém sugeriu um tema ainda.";
  applyRandomSuggestion(room);
  return null;
}

export function startGame(room) {
  if (room.phase !== "lobby") return "A partida já começou.";
  if (connectedPlayers(room).length < MIN_PLAYERS) {
    return `Chame pelo menos ${MIN_PLAYERS} jogadores para começar.`;
  }
  room.errors = 0;
  room.correct = 0;
  room.round = 0;
  room.usedThemes = [];
  room.theme = null;

  if (room.settings.themeMode === "vote") {
    startThemeVotePhase(room);
  } else {
    room.theme = pickAutoTheme(room);
    startRound(room);
  }
  return null;
}

export function checkClueProgress(room) {
  if (room.phase !== "clues") return;
  const inRound = [...room.players.values()].filter((p) => p.inRound);
  const waiting = inRound.filter((p) => p.connected && !p.clue);
  const withClue = inRound.filter((p) => p.clue);
  if (waiting.length === 0 && withClue.length > 0) {
    room.order = shuffle(withClue.map((p) => p.id));
    room.phase = "ordering";
  }
}

export function submitClue(room, playerId, text) {
  const p = room.players.get(playerId);
  if (room.phase !== "clues" || !p?.inRound) return "Agora não dá para enviar dica.";
  const clean = String(text ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CLUE_LENGTH);
  if (!clean) return "Escreva uma dica antes de enviar.";
  p.clue = clean;
  checkClueProgress(room);
  return null;
}

export function moveOrder(room, order) {
  if (room.phase !== "ordering" || !Array.isArray(order)) {
    return "Não dá para reordenar agora.";
  }
  const expected = new Set(room.order);
  const valid =
    order.length === room.order.length &&
    new Set(order).size === order.length &&
    order.every((id) => expected.has(id));
  if (!valid) return "Ordem inválida.";
  room.order = order;
  return null;
}

export function reveal(room) {
  if (room.phase !== "ordering") return "Ainda não dá para revelar.";
  const cards = room.order.map((id) => room.players.get(id)).filter(Boolean);
  const sorted = [...cards].sort((a, b) => a.number - b.number);
  const details = cards.map((c, i) => ({ id: c.id, ok: sorted[i].id === c.id }));
  const allCorrect = details.every((d) => d.ok);
  if (allCorrect) {
    room.correct += 1;
  } else {
    room.errors += 1;
  }
  room.result = { allCorrect, details };
  room.phase = "reveal";
  return null;
}

export function nextRound(room) {
  if (room.phase !== "reveal") return "Ainda não dá para avançar.";
  if (room.settings.themeMode === "vote") {
    startThemeVotePhase(room);
  } else {
    room.theme = pickAutoTheme(room);
    startRound(room);
  }
  return null;
}

export function setHover(room, playerId, cardId) {
  if (cardId) {
    room.hovering.set(playerId, cardId);
  } else {
    room.hovering.delete(playerId);
  }
}

export function refreshTheme(room) {
  if (room.phase !== "clues") return "Só dá para trocar o tema durante as dicas.";
  for (const p of room.players.values()) {
    p.clue = "";
  }
  room.order = [];
  room.hovering = new Map();
  if (room.settings.themeMode === "vote") {
    startThemeVotePhase(room);
  } else {
    room.theme = pickAutoTheme(room);
  }
  return null;
}

export function endGame(room) {
  if (room.phase !== "reveal") return "Ainda não dá para encerrar.";
  room.phase = "gameover";
  return null;
}

export function backToLobby(room) {
  if (room.phase !== "gameover") return "A partida ainda não terminou.";
  room.phase = "lobby";
  room.order = [];
  room.result = null;
  room.theme = null;
  room.round = 0;
  room.errors = 0;
  room.correct = 0;
  room.themeSuggestions = new Map();
  room.themeSamples = [];
  room.hovering = new Map();
  for (const p of room.players.values()) {
    p.inRound = false;
    p.number = null;
    p.clue = "";
  }
  return null;
}

export function reassignHost(room) {
  const next = connectedPlayers(room)[0] ?? [...room.players.values()][0];
  room.hostId = next?.id ?? null;
}

export function removePlayer(room, playerId) {
  room.players.delete(playerId);
  room.order = room.order.filter((id) => id !== playerId);
  room.themeSuggestions.delete(playerId);
  if (room.hostId === playerId) reassignHost(room);
  checkClueProgress(room);
  checkThemeProgress(room);
}

export function handleDisconnect(room, playerId) {
  const p = room.players.get(playerId);
  if (!p) return;
  p.connected = false;
  p.socketId = null;
  if (room.hostId === playerId) reassignHost(room);
  checkClueProgress(room);
  checkThemeProgress(room);
}

export function viewFor(room, playerId) {
  const me = room.players.get(playerId);
  const showCards = room.phase === "ordering" || room.phase === "reveal";
  const showMyNumber = ["clues", "ordering", "reveal"].includes(room.phase);

  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    errors: room.errors,
    correct: room.correct,
    round: room.round,
    theme: room.theme,
    themeVoters:
      room.phase === "theme-vote"
        ? [...room.players.values()].map((p) => ({
            id: p.id,
            name: p.name,
            connected: p.connected,
            suggestion: room.themeSuggestions.get(p.id)?.text ?? null,
          }))
        : [],
    themeSamples: room.phase === "theme-vote" ? room.themeSamples : [],
    me: me
      ? {
          id: me.id,
          name: me.name,
          inRound: me.inRound,
          clue: me.clue,
          number: me.inRound && showMyNumber ? me.number : null,
        }
      : null,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      inRound: p.inRound,
      hasClue: Boolean(p.clue),
    })),
    cards: showCards
      ? room.order
          .map((id) => room.players.get(id))
          .filter(Boolean)
          .map((p) => {
            const card = { id: p.id, name: p.name, clue: p.clue };
            if (room.phase === "reveal") {
              card.number = p.number;
              card.ok = room.result?.details.find((d) => d.id === p.id)?.ok ?? false;
            }
            card.hoverers = [...room.hovering.entries()]
              .filter(([, cid]) => cid === p.id)
              .map(([pid]) => ({ id: pid, name: room.players.get(pid)?.name }))
              .filter((h) => h.name);
            return card;
          })
      : [],
    result: room.phase === "reveal" ? { allCorrect: room.result?.allCorrect ?? false } : null,
  };
}

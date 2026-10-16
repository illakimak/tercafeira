import { io } from "socket.io-client";

// Por padrão usa a mesma origem da página. Para apontar para outro servidor,
// defina VITE_SERVER_URL ao compilar.
export const socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
  autoConnect: false,
});

const KEY = "terca-feira:session";

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSession(patch) {
  const next = { ...loadSession(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* navegação privada: segue sem persistir */
  }
  return next;
}

// Depois de sair da sala, guarda só quem é a pessoa
export function clearRoom() {
  const { playerId, name } = loadSession();
  try {
    localStorage.setItem(KEY, JSON.stringify({ playerId, name }));
  } catch {
    /* ignora */
  }
}

// Identidade estável do jogador: permite voltar à sala depois de F5 ou queda de rede
export function getPlayerId() {
  const { playerId } = loadSession();
  if (playerId) return playerId;
  // crypto.randomUUID só existe em contexto seguro (https/localhost)
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  saveSession({ playerId: id });
  return id;
}

export function emit(event, payload = {}) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, error: "O servidor não respondeu. Tente de novo." }),
      8000,
    );
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

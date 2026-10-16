import { useCallback, useEffect, useState } from "react";
import { clearRoom, emit, getPlayerId, loadSession, saveSession, socket } from "./socket.js";
import Hud from "./components/Hud.jsx";
import Clues from "./screens/Clues.jsx";
import GameOver from "./screens/GameOver.jsx";
import Home from "./screens/Home.jsx";
import Lobby from "./screens/Lobby.jsx";
import Table from "./screens/Table.jsx";
import ThemeVote from "./screens/ThemeVote.jsx";

// Hospedagem gratuita "dorme" quando fica parada: a primeira visita pode levar quase um minuto
function Boot() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="boot" role="status">
      <p>Conectando ao servidor…</p>
      {slow && <p className="muted">O servidor estava dormindo e está acordando. Pode levar até 1 minuto.</p>}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [online, setOnline] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onState = (next) => setState(next);
    const onConnect = async () => {
      setOnline(true);
      // volta para a sala depois de F5 ou queda de rede
      const { code } = loadSession();
      if (code) {
        const res = await emit("room:resume", { code, playerId: getPlayerId() });
        if (!res?.ok) {
          clearRoom();
          setState(null);
        }
      }
      setReady(true);
    };
    const onDisconnect = () => setOnline(false);

    socket.on("state", onState);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.connect();
    return () => {
      socket.off("state", onState);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, []);

  const enter = useCallback(async (event, payload) => {
    const res = await emit(event, { ...payload, playerId: getPlayerId() });
    if (res?.ok) saveSession({ code: res.code, name: payload.name });
    return res;
  }, []);

  const leave = useCallback(async () => {
    await emit("room:leave");
    clearRoom();
    setState(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!ready) return <Boot />;

  if (!state) return <Home onEnter={enter} online={online} />;

  const isHost = state.me?.id === state.hostId;
  const props = { state, isHost, act: emit };

  return (
    <div className="app">
      <Hud state={state} online={online} onLeave={leave} />
      <main className="stage">
        {state.phase === "lobby" && <Lobby {...props} />}
        {state.phase === "theme-vote" && <ThemeVote {...props} />}
        {state.phase === "clues" && <Clues {...props} />}
        {(state.phase === "ordering" || state.phase === "reveal") && <Table {...props} />}
        {state.phase === "gameover" && <GameOver {...props} />}
      </main>
    </div>
  );
}

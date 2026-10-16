import { useState } from "react";
import PlayerList from "../components/PlayerList.jsx";

export default function Lobby({ state, isHost, act }) {
  const { settings, players } = state;
  const [error, setError] = useState("");
  const canStart = players.filter((p) => p.connected).length >= 2;
  const link = `${window.location.origin}/?sala=${state.code}`;

  const update = (patch) => act("settings:update", { ...settings, ...patch });
  const start = async () => {
    const res = await act("game:start");
    setError(res?.ok ? "" : res?.error || "Não foi possível começar.");
  };

  return (
    <div className="lobby">
      <section className="panel">
        <h2>Chame os amigos</h2>
        <p className="codecard" aria-label={`Código da sala ${state.code.split("").join(" ")}`}>
          {state.code}
        </p>
        <p className="muted">
          Eles digitam o código ou abrem este link: <span className="link">{link}</span>
        </p>
      </section>

      <section className="panel">
        <h2>
          Jogadores <small>{players.length} de 10</small>
        </h2>
        <PlayerList players={players} hostId={state.hostId} meId={state.me.id} />
      </section>

      <section className="panel">
        <h2>Seleção de tema</h2>
        <div className="theme-mode">
          <button
            type="button"
            className={`btn ${settings.themeMode === "auto" ? "btn--primary" : ""}`}
            disabled={!isHost}
            onClick={() => update({ themeMode: "auto" })}
          >
            Automático
          </button>
          <button
            type="button"
            className={`btn ${settings.themeMode === "vote" ? "btn--primary" : ""}`}
            disabled={!isHost}
            onClick={() => update({ themeMode: "vote" })}
          >
            Votação dos jogadores
          </button>
        </div>
        <p className="muted">
          {settings.themeMode === "auto"
            ? "O sistema escolhe o tema de cada rodada automaticamente."
            : "Antes de cada rodada, todos sugerem um tema e um é sorteado aleatoriamente."}
        </p>
        {!isHost && <p className="muted">Só o anfitrião muda as regras.</p>}
      </section>

      {isHost ? (
        <>
          <button type="button" className="btn btn--primary btn--big" onClick={start} disabled={!canStart}>
            Começar partida
          </button>
          {!canStart && <p className="muted center">Precisa de pelo menos 2 jogadores conectados.</p>}
        </>
      ) : (
        <p className="waiting" aria-live="polite">
          Esperando o anfitrião começar a partida…
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

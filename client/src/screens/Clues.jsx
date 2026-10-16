import { useState } from "react";
import PlayerList from "../components/PlayerList.jsx";
import ThemeBanner from "../components/ThemeBanner.jsx";
import { plural, rampVar } from "../util.js";

export default function Clues({ state, act }) {
  const { me, players, hostId } = state;
  const [text, setText] = useState(me.clue || "");
  const [hidden, setHidden] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sent = Boolean(me.clue);
  const waiting = players.filter((p) => p.inRound && p.connected && !p.hasClue).length;

  const send = async (event) => {
    event.preventDefault();
    setSending(true);
    const res = await act("clue:submit", { text });
    setSending(false);
    setError(res?.ok ? "" : res?.error || "Não foi possível enviar a dica.");
  };

  if (!me.inRound) {
    return (
      <div className="clues">
        <ThemeBanner theme={state.theme} />
        <section className="panel">
          <h2>Você entra na próxima rodada</h2>
          <p className="muted">Esta rodada já começou. Acompanhe o pessoal enquanto isso.</p>
        </section>
        <PlayerList players={players} hostId={hostId} meId={me.id} showStatus />
      </div>
    );
  }

  return (
    <div className="clues">
      <ThemeBanner theme={state.theme} />

      <section className="secret" style={{ "--c": rampVar(me.number) }}>
        <p className="secret__label">Seu número. Só você vê.</p>
        <p
          className="secret__num"
          aria-label={hidden ? "Número oculto" : `Seu número é ${me.number}`}
        >
          {hidden ? "??" : me.number}
        </p>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => setHidden((h) => !h)}
          aria-pressed={hidden}
        >
          {hidden ? "Mostrar número" : "Ocultar número"}
        </button>
      </section>

      <form className="panel" onSubmit={send}>
        <label className="field">
          <span>Sua dica para este número</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={60}
            placeholder="Uma palavra ou frase, sem falar números"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={sending || !text.trim() || text.trim() === me.clue}
        >
          {sent ? "Atualizar dica" : "Enviar dica"}
        </button>
        {sent && waiting > 0 && (
          <p className="muted" aria-live="polite">
            Dica enviada. Esperando {plural(waiting, "pessoa", "pessoas")}.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      <section className="panel">
        <h2>Quem já enviou</h2>
        <PlayerList players={players} hostId={hostId} meId={me.id} showStatus />
      </section>
    </div>
  );
}

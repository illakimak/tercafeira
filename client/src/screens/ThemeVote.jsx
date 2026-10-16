import { useState } from "react";
import { hue } from "../util.js";

export default function ThemeVote({ state, isHost, act }) {
  const { me, themeVoters, themeSamples } = state;
  const [text, setText] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const myVote = themeVoters.find((v) => v.id === me.id);
  const sent = Boolean(myVote?.suggestion);
  const waiting = themeVoters.filter((v) => v.connected && !v.suggestion).length;

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await act("theme:suggest", { text, low, high });
    setSending(false);
    if (!res?.ok) setError(res?.error || "Não foi possível enviar.");
  };

  const selectSample = (sample) => {
    setText(sample.title);
    setLow(sample.low);
    setHigh(sample.high);
  };

  const forcePick = async () => {
    const res = await act("theme:pick");
    if (!res?.ok) setError(res?.error || "Não foi possível sortear.");
  };

  const unchanged =
    text.trim() === myVote?.suggestion;

  return (
    <div className="theme-vote">
      <section className="panel">
        <h2>Rodada {state.round + 1} — Sugestão de tema</h2>
        <p className="muted">
          Cada um sugere um tema. Quando todos enviarem, um é sorteado automaticamente.
        </p>
      </section>

      <section className="panel">
        <form onSubmit={submit} style={{ display: "grid", gap: "12px" }}>
          <label className="field">
            <span>{sent ? "Sua sugestão" : "Sua sugestão de tema"}</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={60}
              placeholder="Ex: temperatura de alimentos"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>
              Extremo menor (1) <small className="muted">— opcional</small>
            </span>
            <input
              value={low}
              onChange={(e) => setLow(e.target.value)}
              maxLength={60}
              placeholder="Ex: gelado, suave, pequenininho…"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>
              Extremo maior (100) <small className="muted">— opcional</small>
            </span>
            <input
              value={high}
              onChange={(e) => setHigh(e.target.value)}
              maxLength={60}
              placeholder="Ex: escaldante, intenso, gigantesco…"
              autoComplete="off"
            />
          </label>

          {themeSamples.length > 0 && (
            <div>
              <p className="muted" style={{ marginBottom: "6px" }}>
                Ou escolha um tema da lista (preenche tudo automaticamente):
              </p>
              <div className="theme-samples">
                {themeSamples.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    className={`theme-sample ${text === s.title ? "is-selected" : ""}`}
                    onClick={() => selectSample(s)}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={sending || !text.trim() || unchanged}
          >
            {sent ? "Atualizar sugestão" : "Enviar sugestão"}
          </button>

          {sent && (
            <p className="muted" aria-live="polite">
              Sugestão atual: <strong>{myVote.suggestion}</strong>
              {waiting > 0 && ` — esperando ${waiting} pessoa${waiting > 1 ? "s" : ""}.`}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>

      <section className="panel">
        <h2>Quem já sugeriu</h2>
        <ul className="players">
          {themeVoters.map((v) => (
            <li key={v.id} className={`player ${v.connected ? "" : "is-off"}`}>
              <span className="avatar" style={{ "--h": hue(v.name) }}>
                {v.name[0]}
              </span>
              <span>
                {v.name}
                {v.id === me.id && " (você)"}
              </span>
              <span className={`status ${v.suggestion ? "is-done" : ""}`}>
                {v.suggestion ? v.suggestion : "pensando…"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isHost && (
        <button
          type="button"
          className="btn btn--primary btn--big"
          onClick={forcePick}
          disabled={themeVoters.filter((v) => v.suggestion).length === 0}
        >
          Sortear tema agora
        </button>
      )}
      {!isHost && waiting > 0 && (
        <p className="waiting" aria-live="polite">
          Aguardando o anfitrião sortear o tema…
        </p>
      )}
    </div>
  );
}

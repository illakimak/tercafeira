export default function Hud({ state, online, onLeave }) {
  const playing = state.phase !== "lobby";

  const copyLink = async () => {
    const link = `${window.location.origin}/?sala=${state.code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* ignora */
    }
  };

  return (
    <header className="hud">
      <button type="button" className="hud__code" onClick={copyLink} title="Copiar o link da sala">
        <span className="hud__hint">Sala</span>
        <strong>{state.code}</strong>
      </button>

      {playing && state.phase !== "gameover" && (
        <p className="hud__round">
          Rodada <strong>{state.round}</strong>
          {state.settings.themeMode === "vote" && state.themePoolSize > 0 && (
            <span className="hud__pool" title="Temas restantes na fila">
              {" "}· {state.themePoolSize} tema{state.themePoolSize > 1 ? "s" : ""} na fila
            </span>
          )}
        </p>
      )}

      {playing && (
        <div className="score" aria-label={`${state.correct} acertos, ${state.errors} erros`}>
          <span className="score__item score__ok">✓ {state.correct}</span>
          <span className="score__item score__bad">✗ {state.errors}</span>
        </div>
      )}

      {!online && (
        <p className="hud__offline" role="status">
          Reconectando…
        </p>
      )}

      <button type="button" className="btn btn--small hud__leave" onClick={onLeave}>
        Sair da sala
      </button>
    </header>
  );
}

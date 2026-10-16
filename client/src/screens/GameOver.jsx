import { plural } from "../util.js";

export default function GameOver({ state, isHost, act }) {
  return (
    <div className="panel gameover">
      <h1>Partida encerrada!</h1>
      <p>
        {plural(state.correct, "rodada acertada", "rodadas acertadas")} e{" "}
        {plural(state.errors, "erro", "erros")} em {plural(state.round, "rodada", "rodadas")}.
      </p>
      {isHost ? (
        <button type="button" className="btn btn--primary btn--big" onClick={() => act("game:lobby")}>
          Jogar de novo
        </button>
      ) : (
        <p className="waiting" aria-live="polite">
          Esperando o anfitrião abrir uma nova partida…
        </p>
      )}
    </div>
  );
}

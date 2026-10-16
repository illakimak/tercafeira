import { useState } from "react";
import { loadSession } from "../socket.js";

export default function Home({ onEnter, online }) {
  const urlCode = (new URLSearchParams(window.location.search).get("sala") || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);

  const [name, setName] = useState(loadSession().name || "");
  const [code, setCode] = useState(urlCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (event, payload) => {
    if (!name.trim()) {
      setError("Digite seu nome para continuar.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await onEnter(event, { name: name.trim(), ...payload });
    setBusy(false);
    if (!res?.ok) setError(res?.error || "Não foi possível entrar. Tente de novo.");
  };

  const create = () => run("room:create", {});
  const join = (event) => {
    event.preventDefault();
    run("room:join", { code });
  };

  return (
    <div className="home">
      <header className="home__brand">
        <h1 className="wordmark">terça-feira</h1>
        <div className="ramp ramp--chunky" aria-hidden="true" />
        <p className="home__tagline">
          Deem dicas sobre números secretos e ordenem tudo sem revelar nenhum.
        </p>
      </header>

      <form className="panel home__form" onSubmit={join}>
        <label className="field">
          <span>Seu nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoComplete="nickname"
            placeholder="Como os amigos te chamam"
          />
        </label>

        <button
          type="button"
          className={`btn ${urlCode ? "" : "btn--primary"}`}
          onClick={create}
          disabled={busy || !online}
        >
          Criar sala
        </button>

        <p className="divider">
          <span>ou entre numa sala existente</span>
        </p>

        <label className="field">
          <span>Código da sala</span>
          <input
            className="codeinput"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
            placeholder="ABCD"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <button
          type="submit"
          className={`btn ${urlCode ? "btn--primary" : ""}`}
          disabled={busy || !online || code.length < 4}
        >
          Entrar na sala
        </button>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>

      <details className="panel howto">
        <summary>Como jogar</summary>
        <ol>
          <li>Cada pessoa recebe um número secreto de 1 a 100 e vê o tema da rodada.</li>
          <li>
            Cada um escreve uma dica que mostre a intensidade do seu número dentro do tema, sem
            falar números.
          </li>
          <li>
            Juntos, arrastem as cartas da menor para a maior intensidade. O anfitrião revela os
            números — acertos e erros são contados, mas ninguém é eliminado.
          </li>
        </ol>
      </details>
    </div>
  );
}

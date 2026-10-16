import { hue } from "../util.js";

export default function PlayerList({ players, hostId, meId, showStatus = false }) {
  return (
    <ul className="players">
      {players.map((p) => (
        <li key={p.id} className={`player ${p.connected ? "" : "is-off"}`}>
          <span className="avatar" style={{ "--h": hue(p.name) }} aria-hidden="true">
            {p.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="player__name">
            {p.name}
            {p.id === meId && " (você)"}
          </span>
          {p.id === hostId && <span className="tag">anfitrião</span>}
          {!p.connected && <span className="tag tag--off">offline</span>}
          {showStatus && (
            <span className={`status ${p.hasClue ? "is-done" : ""}`}>
              {!p.inRound ? "entra na próxima" : p.hasClue ? "dica enviada" : "pensando…"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

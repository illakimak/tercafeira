import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import ThemeBanner from "../components/ThemeBanner.jsx";
import { socket } from "../socket.js";
import { hue, rampVar } from "../util.js";

function SortableCard({ card, index, revealed, mine, meId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: revealed,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    "--h": hue(card.name),
  };
  const verdict = revealed ? (card.ok ? "is-ok" : "is-bad") : "";
  const otherHoverers = (card.hoverers || []).filter((h) => h.id !== meId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card ${verdict} ${isDragging ? "is-dragging" : ""} ${revealed ? "" : "is-movable"}`}
      onPointerEnter={() => socket.emit("card:hover", { cardId: card.id })}
      onPointerLeave={() => socket.emit("card:hover", { cardId: null })}
      {...attributes}
      {...(revealed ? {} : listeners)}
    >
      <div className="card__head">
        <span className="card__who">
          {card.name}
          {mine && " (você)"}
        </span>
        {otherHoverers.length > 0 && (
          <div className="card__cursors">
            {otherHoverers.map((h) => (
              <span
                key={h.id}
                className="card__cursor"
                style={{ "--h": hue(h.name) }}
                title={h.name}
              >
                {h.name[0]}
              </span>
            ))}
          </div>
        )}
        <span className="card__pos">{index + 1}</span>
      </div>
      <p className="card__clue">{card.clue}</p>
      {revealed && (
        <div
          className="card__reveal"
          style={{ "--c": rampVar(card.number), "--d": `${index * 160}ms` }}
        >
          <span className="card__number">{card.number}</span>
          <span className="card__verdict">{card.ok ? "no lugar" : "fora do lugar"}</span>
        </div>
      )}
    </div>
  );
}

export default function Table({ state, isHost, act }) {
  const revealed = state.phase === "reveal";
  const serverKey = state.cards.map((c) => c.id).join("|");
  const [ids, setIds] = useState(() => (serverKey ? serverKey.split("|") : []));

  useEffect(() => {
    setIds(serverKey ? serverKey.split("|") : []);
  }, [serverKey]);

  const byId = useMemo(() => Object.fromEntries(state.cards.map((c) => [c.id, c])), [state.cards]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id));
    setIds(next);
    act("order:move", { order: next });
  };

  const cards = ids.map((id) => byId[id]).filter(Boolean);
  const truth = revealed ? [...cards].sort((a, b) => a.number - b.number) : [];

  return (
    <div className="table">
      <ThemeBanner theme={state.theme} />

      {!revealed && (
        <p className="table__hint">
          Conversem e arrastem as cartas até todos concordarem: da menor intensidade (primeira) para
          a maior (última).
        </p>
      )}

      <div className="axis" aria-hidden="true">
        <span>{state.theme.low}</span>
        <div className="ramp ramp--thin" />
        <span>{state.theme.high}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="board">
            {cards.map((card, i) => (
              <SortableCard
                key={card.id}
                card={card}
                index={i}
                revealed={revealed}
                mine={card.id === state.me.id}
                meId={state.me.id}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!revealed &&
        (isHost ? (
          <button type="button" className="btn btn--primary btn--big" onClick={() => act("game:reveal")}>
            Revelar números
          </button>
        ) : (
          <p className="waiting" aria-live="polite">
            Quando todos concordarem, o anfitrião revela os números.
          </p>
        ))}

      {revealed && (
        <section className={`panel result ${state.result.allCorrect ? "is-win" : "is-lose"}`} aria-live="polite">
          <h2>{state.result.allCorrect ? "Ordem perfeita!" : "Algumas cartas ficaram fora do lugar"}</h2>
          <p>
            {state.result.allCorrect
              ? "Continuem assim!"
              : "A ordem certa era esta:"}
          </p>
          {!state.result.allCorrect && (
            <ol className="truth">
              {truth.map((c) => (
                <li key={c.id}>
                  <b style={{ background: rampVar(c.number) }}>{c.number}</b> {c.name}
                </li>
              ))}
            </ol>
          )}
          {isHost ? (
            <div className="result-actions">
              <button type="button" className="btn btn--primary btn--big" onClick={() => act("round:next")}>
                Próxima rodada
              </button>
              <button type="button" className="btn btn--big" onClick={() => act("game:end")}>
                Encerrar jogo
              </button>
            </div>
          ) : (
            <p className="waiting">Esperando o anfitrião seguir…</p>
          )}
        </section>
      )}
    </div>
  );
}

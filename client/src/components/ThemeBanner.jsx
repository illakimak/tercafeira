export default function ThemeBanner({ theme }) {
  return (
    <section className="theme" aria-label="Tema da rodada">
      <h2 className="theme__title">{theme.title}</h2>
      <div
        className="ramp"
        role="img"
        aria-label={`Escala de 1, ${theme.low}, até 100, ${theme.high}`}
      />
      <div className="theme__ends">
        <span>
          <b>1</b> {theme.low}
        </span>
        <span>
          {theme.high} <b>100</b>
        </span>
      </div>
    </section>
  );
}

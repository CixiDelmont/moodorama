import { MOODS } from '../moods';

export default function Legend() {
  return (
    <div className="overlay bottom-left legend">
      <h4>Dominant mood</h4>
      {MOODS.map((m) => (
        <div className="legend-row" key={m.id}>
          <span className="swatch" style={{ background: m.hex }} />
          <span>
            {m.emoji} {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

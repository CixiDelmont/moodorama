// import type { CSSProperties } from 'react';
import { MOODS } from '../moods';
import MoodIcon from './MoodIcon';

// const STRIPE_SAMPLE: CSSProperties = {
//   background: `repeating-linear-gradient(
//     45deg,
//     #ffd13b,
//     #ffd13b 4px,
//     #4c9be8 4px,
//     #4c9be8 8px
//   )`,
// };

export default function Legend() {
  return (
    <div className="overlay bottom-left legend">
      <h4>Mood colours</h4>
      {MOODS.map((m) => (
        <div className="legend-row" key={m.id}>
          {/* <span className="swatch" style={{ background: m.hex }} /> */}
          <span className="legend-label">
            <MoodIcon mood={m.id} size={18} className="legend-icon" />
            {m.label}
          </span>
        </div>
      ))}
      {/* <div className="legend-row" style={{ marginTop: 8 }}>
        <span className="swatch" style={STRIPE_SAMPLE} />
        <span>Mixed (30%+ each)</span>
      </div> */}
    </div>
  );
}

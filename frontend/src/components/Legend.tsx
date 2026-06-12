// import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
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
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();

  return (
    <div className={`overlay bottom-left legend${expanded ? ' legend--expanded' : ''}`}>
      <button
        type="button"
        className="legend-toggle"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <span className="legend-title">Mood colours</span>
        <svg className="legend-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="legend-body" id={bodyId}>
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
    </div>
  );
}

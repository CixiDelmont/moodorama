import { useState, type CSSProperties } from 'react';
import { MOODS, MOOD_BY_ID } from '../moods';
import type { Mood, MyMood } from '../types';
import MoodIcon from './MoodIcon';
import { getCurrentLocation } from '../lib/geo';
import { submitMood } from '../api';

const ALIAS_MAX = 32;

interface Props {
  userId: string;
  current?: MyMood | null;
  onSaved: (mood: MyMood) => void;
  onCancel?: () => void;
}

export default function MoodPicker({ userId, current, onSaved, onCancel }: Props) {
  const [alias, setAlias] = useState(current?.alias ?? '');
  const [pending, setPending] = useState<Mood | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mood: Mood) {
    setError(null);
    setPending(mood);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const trimmed = alias.trim();
      const saved = await submitMood({
        userId,
        mood,
        latitude,
        longitude,
        ...(trimmed ? { alias: trimmed } : {}),
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPending(null);
    }
  }

  return (
    <div className="picker">
      <h1>How are you feeling?</h1>
      <p className="subtitle">
        Pick one of the five core emotions. Your mood joins a live heatmap of how the
        world feels right now, and stays yours for the next 24 hours.
      </p>
      
      <label className="alias-field">
        <div className="alias-row">
          <span className="alias-label">Name or alias (optional)</span>
          <input
            type="text"
            className="alias-input"
            value={alias}
            maxLength={ALIAS_MAX}
            placeholder="e.g. Alex, NightOwl…"
            disabled={pending !== null}
            onChange={(e) => setAlias(e.target.value)}
          />
        </div>
        {/* <span className="alias-hint">
          Shown on the map when your hex is alone. Max {ALIAS_MAX} chars.
        </span> */}
      </label>

      <div className="mood-grid">
        {MOODS.map((m) => (
          <button
            key={m.id}
            className="mood-card"
            style={{ borderColor: pending === m.id ? m.hex : undefined }}
            disabled={pending !== null}
            onClick={() => choose(m.id)}
          >
            <MoodIcon mood={m.id} size={40} className="mood-card-icon" />
            <span className="name" style={{ color: m.hex }}>
              {m.label}
            </span>
          </button>
        ))}
      </div>

      {!pending && (
        <p className="hint">
          We use your location only to place a single hexagon on the map.
        </p>
      )}

      {pending && (
        <div
          className="picker-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{ '--spinner-color': MOOD_BY_ID[pending].hex } as CSSProperties}
        >
          <div className="picker-loading-content">
            <div className="picker-loading-visual">
              <div className="picker-loading-spinner" aria-hidden />
              <MoodIcon mood={pending} size={48} className="picker-loading-icon" />
            </div>
            <p>Finding your location…</p>
            <p className="picker-loading-sub">Placing you on the map</p>
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {current?.active && onCancel && !pending && (
        <button className="btn" style={{ marginTop: 20 }} onClick={onCancel}>
          ← Back to the map
        </button>
      )}
    </div>
  );
}

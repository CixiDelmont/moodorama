import { useState } from 'react';
import { MOODS } from '../moods';
import type { Mood, MyMood } from '../types';
import { getCurrentLocation } from '../lib/geo';
import { submitMood } from '../api';

interface Props {
  userId: string;
  current?: MyMood | null;
  onSaved: (mood: MyMood) => void;
  onCancel?: () => void;
}

export default function MoodPicker({ userId, current, onSaved, onCancel }: Props) {
  const [pending, setPending] = useState<Mood | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mood: Mood) {
    setError(null);
    setPending(mood);
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const saved = await submitMood({ userId, mood, latitude, longitude });
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
        world feels right now, and stays yours for the next 12 hours.
      </p>

      <div className="mood-grid">
        {MOODS.map((m) => (
          <button
            key={m.id}
            className="mood-card"
            style={{ borderColor: pending === m.id ? m.hex : undefined }}
            disabled={pending !== null}
            onClick={() => choose(m.id)}
          >
            <span className="emoji">{m.emoji}</span>
            <span className="name" style={{ color: m.hex }}>
              {m.label}
            </span>
          </button>
        ))}
      </div>

      {pending && <p className="hint">Finding your location…</p>}
      {!pending && (
        <p className="hint">
          We use your location only to place a single anonymous hexagon on the map.
        </p>
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

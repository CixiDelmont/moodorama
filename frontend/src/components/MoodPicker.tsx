import { useState } from 'react';
import { MOODS } from '../moods';
import type { Mood, MyMood } from '../types';
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
        world feels right now, and stays yours for the next 12 hours.
      </p>

      <label className="alias-field">
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
        <span className="alias-hint">Shown on the map when your hex is alone. Max {ALIAS_MAX} chars.</span>
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
          We use your location only to place a single hexagon on the map.
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

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchSnapshotCountries, fetchSnapshots } from '../api';
import { MOODS, MOOD_BY_ID } from '../moods';
import type { SnapshotMeta } from '../types';
import MoodIcon from './MoodIcon';
import {
  aggregateCountryStats,
  formatSnapshotTime,
  MOOD_SCORE_WEIGHTS,
  scoreColor,
  sortCountries,
  type CountrySortKey,
  type CountryStats,
} from '../lib/snapshot-stats';

interface Props {
  onBack: () => void;
}

export default function MoodStats({ onBack }: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [countries, setCountries] = useState<CountryStats[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CountrySortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeSnapshot = snapshots[snapshotIndex] ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSnapshots()
      .then((list) => {
        if (cancelled) return;
        setSnapshots(list);
        setSnapshotIndex(0);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load snapshots.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeSnapshot) {
      setCountries([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSnapshotCountries(activeSnapshot.snapshotAt)
      .then((rows) => {
        if (cancelled) return;
        const stats = aggregateCountryStats(rows);
        setCountries(stats);
        const top = sortCountries(stats, sortKey, sortDir)[0];
        setSelectedCode(top?.countryCode ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load country data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSnapshot?.snapshotAt]);

  const sortedCountries = useMemo(
    () => sortCountries(countries, sortKey, sortDir),
    [countries, sortKey, sortDir],
  );

  const selected = useMemo(
    () => countries.find((c) => c.countryCode === selectedCode) ?? null,
    [countries, selectedCode],
  );

  const toggleSort = useCallback((key: CountrySortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }, [sortKey]);

  function goToSnapshot(nextIndex: number) {
    setSnapshotIndex(Math.max(0, Math.min(snapshots.length - 1, nextIndex)));
  }

  const canGoNewer = snapshotIndex > 0;
  const canGoOlder = snapshotIndex < snapshots.length - 1;

  return (
    <div className="stats-page">
      <header className="stats-header">
        <button type="button" className="btn" onClick={onBack}>
          ← Map
        </button>
        <div className="stats-header-title">
          <h1>Mood stats</h1>
          <p className="subtitle">Hourly snapshots of how the world felt</p>
        </div>
      </header>

      <div className="stats-snapshot-nav">
        <button
          type="button"
          className="btn stats-snapshot-btn"
          disabled={!canGoOlder}
          onClick={() => goToSnapshot(snapshotIndex + 1)}
          aria-label="Older snapshot"
        >
          <ChevronLeftIcon />
          <span className="stats-snapshot-btn-label">← Older</span>
        </button>
        <div className="stats-snapshot-label">
          {activeSnapshot ? (
            <>
              <strong>{formatSnapshotTime(activeSnapshot.snapshotAt)}</strong>
              <span>{activeSnapshot.pointCount.toLocaleString()} moods captured</span>
            </>
          ) : (
            <span>No snapshots yet</span>
          )}
        </div>
        <button
          type="button"
          className="btn stats-snapshot-btn"
          disabled={!canGoNewer}
          onClick={() => goToSnapshot(snapshotIndex - 1)}
          aria-label="Newer snapshot"
        >
          <span className="stats-snapshot-btn-label">Newer →</span>
          <ChevronRightIcon />
        </button>
      </div>

      {error && <div className="error stats-error">{error}</div>}

      {loading && !countries.length ? (
        <p className="stats-loading">Loading…</p>
      ) : !activeSnapshot ? (
        <p className="stats-empty">No hourly snapshots have been captured yet.</p>
      ) : countries.length === 0 ? (
        <p className="stats-empty">This snapshot has no mood data.</p>
      ) : (
        <div className="stats-body">
          {selected && (
            <section className="stats-detail-panel">
              <h2 className="stats-section-title">{selected.name}</h2>
              <p className="stats-detail-summary">
                {selected.total.toLocaleString()} mood{selected.total === 1 ? '' : 's'} · score{' '}
                <span style={{ color: scoreColor(selected.score) }}>
                  {selected.score > 0 ? '+' : ''}{selected.score}
                </span>
              </p>
              <ul className="stats-breakdown">
                {MOODS.map((m) => {
                  const count = selected.counts[m.id];
                  const pct = selected.total > 0 ? (count / selected.total) * 100 : 0;
                  return (
                    <li key={m.id} className="stats-breakdown-row">
                      <span className="stats-breakdown-label">
                        <MoodIcon mood={m.id} size={20} />
                        {m.label}
                      </span>
                      <div className="stats-bar-track">
                        <div
                          className="stats-bar-fill"
                          style={{ width: `${pct}%`, background: m.hex }}
                        />
                      </div>
                      <span className="stats-breakdown-count">
                        {count.toLocaleString()} ({Math.round(pct)}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="stats-table-panel">
            <h2 className="stats-section-title">Countries</h2>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <SortHeader label="Country" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Moods" sortKey="total" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                    <SortHeader label="Score" sortKey="score" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" title="Weighted mood score from −100 to +100" />
                    <SortHeader label="Joy" sortKey="joyPct" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                    <SortHeader label="Dominant" sortKey="dominant" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedCountries.map((row) => (
                    <tr
                      key={row.countryCode}
                      className={row.countryCode === selectedCode ? 'selected' : ''}
                      onClick={() => setSelectedCode(row.countryCode)}
                    >
                      <td>
                        <span className="stats-country-name">{row.name}</span>
                        {row.countryCode !== 'XX' && (
                          <span className="stats-country-code">{row.countryCode}</span>
                        )}
                      </td>
                      <td className="num">{row.total.toLocaleString()}</td>
                      <td className="num">
                        <span className="stats-score" style={{ color: scoreColor(row.score) }}>
                          {row.score > 0 ? '+' : ''}{row.score}
                        </span>
                      </td>
                      <td className="num">{row.joyPct}%</td>
                      <td>
                        <span className="stats-dominant">
                          <MoodIcon mood={row.dominant} size={18} />
                          {MOOD_BY_ID[row.dominant].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="stats-score-help">
            <h2 className="stats-score-help-title">How scores work</h2>
            <p>
              Each country&apos;s score is a weighted average of its moods, scaled from
              −100 (mostly negative emotions) to +100 (mostly joy).
            </p>
            <ul className="stats-score-weights">
              {MOODS.map((m) => (
                <li key={m.id}>
                  <MoodIcon mood={m.id} size={18} />
                  <span className="stats-score-weight-label">{m.label}</span>
                  <span className="stats-score-weight-value">
                    {MOOD_SCORE_WEIGHTS[m.id] > 0 ? '+' : ''}
                    {MOOD_SCORE_WEIGHTS[m.id].toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align,
  title,
}: {
  label: string;
  sortKey: CountrySortKey;
  active: CountrySortKey;
  dir: 'asc' | 'desc';
  onSort: (key: CountrySortKey) => void;
  align?: 'right';
  title?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th className={align === 'right' ? 'num' : undefined}>
      <button
        type="button"
        className={`stats-sort-btn${isActive ? ' active' : ''}`}
        onClick={() => onSort(sortKey)}
        title={title}
      >
        {label}
        <span className="stats-sort-indicator" aria-hidden>
          {isActive ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="stats-snapshot-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="stats-snapshot-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

import { useEffect, useState } from 'react';
import { getUserId } from './user';
import { fetchMyMood } from './api';
import { syncPushSubscription } from './lib/push';
import type { MyMood } from './types';
import MoodPicker from './components/MoodPicker';
import MoodMap from './components/MoodMap';
import MoodStats from './components/MoodStats';

type Screen = 'loading' | 'picker' | 'map' | 'stats';

export default function App() {
  const [userId] = useState(getUserId);
  const [screen, setScreen] = useState<Screen>('loading');
  const [myMood, setMyMood] = useState<MyMood | null>(null);

  // On first load, check whether this user already has an active mood.
  useEffect(() => {
    let cancelled = false;
    fetchMyMood(userId)
      .then((mood) => {
        if (cancelled) return;
        if (mood && mood.active) {
          setMyMood(mood);
          setScreen('map');
        } else {
          setScreen('picker');
        }
      })
      .catch(() => {
        if (!cancelled) setScreen('picker');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!myMood?.active) return;
    void syncPushSubscription(userId);
  }, [userId, myMood?.active]);

  if (screen === 'loading') {
    return <div className="picker"><h1>Moodorama</h1><p className="subtitle">Loading…</p></div>;
  }

  if (screen === 'map' && myMood) {
    return (
      <MoodMap
        myMood={myMood}
        onChangeMood={() => setScreen('picker')}
        onOpenStats={() => setScreen('stats')}
      />
    );
  }

  if (screen === 'stats') {
    return <MoodStats onBack={() => setScreen('map')} />;
  }

  return (
    <MoodPicker
      userId={userId}
      current={myMood}
      onSaved={(mood) => {
        setMyMood(mood);
        setScreen('map');
      }}
      onCancel={myMood?.active ? () => setScreen('map') : undefined}
    />
  );
}

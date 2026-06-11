import type { Mood } from '../types';
import { MOOD_BY_ID } from '../moods';

interface Props {
  mood: Mood;
  size?: number;
  className?: string;
}

export default function MoodIcon({ mood, size = 24, className }: Props) {
  const meta = MOOD_BY_ID[mood];
  return (
    <img
      src={meta.icon}
      alt={meta.label}
      width={size}
      height={size}
      className={className ?? 'mood-icon'}
      draggable={false}
    />
  );
}

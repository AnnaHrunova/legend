import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { TimeGranularity } from '../../analytics/topics/aggregation';

type TimelineControlsProps = {
  buckets: string[];
  activeIndex: number;
  isPlaying: boolean;
  granularity: TimeGranularity;
  onPlayPause: () => void;
  onStep: (direction: -1 | 1) => void;
  onChange: (index: number) => void;
};

export function TimelineControls({
  buckets,
  activeIndex,
  isPlaying,
  granularity,
  onPlayPause,
  onStep,
  onChange,
}: TimelineControlsProps) {
  const activeBucket = buckets[activeIndex] ?? buckets[0];

  return (
    <div className="timeline-controls refined">
      <button type="button" className="icon-control" onClick={() => onStep(-1)} disabled={activeIndex <= 0}>
        <ChevronLeft size={16} />
      </button>
      <button type="button" className="play-control" onClick={onPlayPause}>
        {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className="icon-control"
        onClick={() => onStep(1)}
        disabled={activeIndex >= buckets.length - 1}
      >
        <ChevronRight size={16} />
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, buckets.length - 1)}
        value={activeIndex}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{activeBucket ? formatBucket(activeBucket, granularity) : 'No data'}</span>
    </div>
  );
}

function formatBucket(bucket: string, granularity: TimeGranularity) {
  if (granularity === 'month') {
    const date = new Date(`${bucket}-01T00:00:00`);
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
  }

  const date = new Date(`${bucket}T00:00:00`);
  return `Week of ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)}`;
}

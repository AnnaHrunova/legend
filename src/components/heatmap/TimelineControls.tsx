import { Pause, Play } from 'lucide-react';

type TimelineControlsProps = {
  buckets: string[];
  activeIndex: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onChange: (index: number) => void;
};

export function TimelineControls({
  buckets,
  activeIndex,
  isPlaying,
  onPlayPause,
  onChange,
}: TimelineControlsProps) {
  const activeBucket = buckets[activeIndex] ?? buckets[0];

  return (
    <div className="timeline-controls">
      <button type="button" className="primary-button" onClick={onPlayPause}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, buckets.length - 1)}
        value={activeIndex}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{activeBucket ? formatBucket(activeBucket) : 'No data'}</span>
    </div>
  );
}

function formatBucket(bucket: string) {
  const date = new Date(`${bucket}T00:00:00`);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}


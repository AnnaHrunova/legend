import { getCellCount, growthBetween, type TimeGranularity, type TopicBucket } from '../../analytics/topics/aggregateByTime';
import type { TopicSummary } from '../../analytics/topics/labelTopics';

type TopicsHeatmapProps = {
  topics: TopicSummary[];
  buckets: string[];
  cells: TopicBucket[];
  maxCount: number;
  activeBucketIndex: number;
  granularity: TimeGranularity;
  selected?: { topicId: number; timeBucket: string };
  onSelect: (topicId: number, timeBucket: string) => void;
  onTopicSelect?: (topicId: number) => void;
};

export function TopicsHeatmap({
  topics,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  granularity,
  selected,
  onSelect,
  onTopicSelect,
}: TopicsHeatmapProps) {
  return (
    <div className="topics-heatmap-shell">
      <div
        className="topics-heatmap refined"
        style={{ gridTemplateColumns: `220px repeat(${buckets.length}, minmax(48px, 1fr))` }}
      >
        <div className="heatmap-corner">Topic</div>
        {buckets.map((bucket, index) => (
          <div
            key={bucket}
            className={`heatmap-column-label ${index === activeBucketIndex ? 'active' : ''} ${
              index > activeBucketIndex ? 'future' : ''
            }`}
          >
            {formatBucket(bucket, granularity)}
          </div>
        ))}

        {topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            buckets={buckets}
            cells={cells}
            maxCount={maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={granularity}
            selected={selected}
            onSelect={onSelect}
            onTopicSelect={onTopicSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  granularity,
  selected,
  onSelect,
  onTopicSelect,
}: {
  topic: TopicSummary;
  buckets: string[];
  cells: TopicBucket[];
  maxCount: number;
  activeBucketIndex: number;
  granularity: TimeGranularity;
  selected?: { topicId: number; timeBucket: string };
  onSelect: (topicId: number, timeBucket: string) => void;
  onTopicSelect?: (topicId: number) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="heatmap-topic-label refined"
        onClick={() => {
          onTopicSelect?.(topic.id);
          if (!onTopicSelect) {
            onSelect(topic.id, buckets[activeBucketIndex]);
          }
        }}
      >
        <strong>{topic.label}</strong>
        <span>{topic.keywords.slice(0, 3).join(', ')}</span>
      </button>
      {buckets.map((bucket, index) => {
        const count = getCellCount(cells, topic.id, bucket);
        const previous = index > 0 ? getCellCount(cells, topic.id, buckets[index - 1]) : 0;
        const growth = growthBetween(count, previous);
        const intensity = maxCount ? count / maxCount : 0;
        const isSelected = selected?.topicId === topic.id && selected.timeBucket === bucket;
        const isActive = index === activeBucketIndex;
        const isFuture = index > activeBucketIndex;

        return (
          <button
            key={`${topic.id}-${bucket}`}
            type="button"
            className={`heatmap-cell refined ${isSelected ? 'selected' : ''} ${isActive ? 'active-column' : ''} ${
              isFuture ? 'future' : ''
            }`}
            style={{ background: colorFor(intensity) }}
            title={`${topic.label} · ${formatBucket(bucket, granularity)} · ${count} tickets · ${formatGrowth(growth)} vs previous`}
            onClick={() => onSelect(topic.id, bucket)}
          >
            <span>{count}</span>
          </button>
        );
      })}
    </>
  );
}

function colorFor(intensity: number) {
  const lightness = 96 - intensity * 42;
  const saturation = 76 - intensity * 18;
  return `hsl(211deg ${saturation}% ${lightness}%)`;
}

function formatGrowth(value: number) {
  if (value === 0) return 'flat';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatBucket(bucket: string, granularity: TimeGranularity) {
  if (granularity === 'month') {
    const date = new Date(`${bucket}-01T00:00:00`);
    return new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
  }

  const date = new Date(`${bucket}T00:00:00`);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

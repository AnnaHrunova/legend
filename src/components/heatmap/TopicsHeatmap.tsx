import type { TopicBucket } from '../../analytics/topics/aggregateByTime';
import type { TopicSummary } from '../../analytics/topics/labelTopics';

type TopicsHeatmapProps = {
  topics: TopicSummary[];
  buckets: string[];
  cells: TopicBucket[];
  maxCount: number;
  activeBucketIndex: number;
  selected?: { topicId: number; timeBucket: string };
  onSelect: (topicId: number, timeBucket: string) => void;
};

export function TopicsHeatmap({
  topics,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  selected,
  onSelect,
}: TopicsHeatmapProps) {
  const visibleBuckets = buckets.slice(0, activeBucketIndex + 1);

  return (
    <div className="topics-heatmap-shell">
      <div
        className="topics-heatmap"
        style={{ gridTemplateColumns: `190px repeat(${visibleBuckets.length}, minmax(28px, 1fr))` }}
      >
        <div className="heatmap-corner">Topic</div>
        {visibleBuckets.map((bucket) => (
          <div key={bucket} className="heatmap-column-label">
            {formatBucket(bucket)}
          </div>
        ))}

        {topics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            buckets={visibleBuckets}
            cells={cells}
            maxCount={maxCount}
            selected={selected}
            onSelect={onSelect}
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
  selected,
  onSelect,
}: {
  topic: TopicSummary;
  buckets: string[];
  cells: TopicBucket[];
  maxCount: number;
  selected?: { topicId: number; timeBucket: string };
  onSelect: (topicId: number, timeBucket: string) => void;
}) {
  return (
    <>
      <div className="heatmap-topic-label">
        <strong>{topic.label}</strong>
        <span>{topic.total} tickets</span>
      </div>
      {buckets.map((bucket) => {
        const cell = cells.find((item) => item.topicId === topic.id && item.timeBucket === bucket);
        const count = cell?.count ?? 0;
        const intensity = maxCount ? count / maxCount : 0;
        const isSelected = selected?.topicId === topic.id && selected.timeBucket === bucket;

        return (
          <button
            key={`${topic.id}-${bucket}`}
            type="button"
            className={`heatmap-cell ${isSelected ? 'selected' : ''}`}
            style={{ background: colorFor(intensity) }}
            title={`${topic.label}: ${count} tickets on ${bucket}`}
            onClick={() => onSelect(topic.id, bucket)}
          >
            <span>{count || ''}</span>
          </button>
        );
      })}
    </>
  );
}

function colorFor(intensity: number) {
  const alpha = 0.12 + intensity * 0.78;
  return `rgba(37, 99, 235, ${alpha})`;
}

function formatBucket(bucket: string) {
  const date = new Date(`${bucket}T00:00:00`);
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}


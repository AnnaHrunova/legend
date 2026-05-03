import {
  getCell,
  getCellCount,
  growthBetween,
  type HeatmapCell,
  type HeatmapRow,
  type TimeGranularity,
  type TopicGroupingMode,
} from '../../analytics/topics/aggregation';

type TopicsHeatmapProps = {
  rows: HeatmapRow[];
  buckets: string[];
  cells: HeatmapCell[];
  maxCount: number;
  activeBucketIndex: number;
  granularity: TimeGranularity;
  groupingMode: TopicGroupingMode;
  filterLabel?: string;
  selected?: { rowId: string; timeBucket: string };
  onSelect: (rowId: string, timeBucket: string) => void;
  onRowSelect?: (rowId: string) => void;
};

export function TopicsHeatmap({
  rows,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  granularity,
  groupingMode,
  filterLabel,
  selected,
  onSelect,
  onRowSelect,
}: TopicsHeatmapProps) {
  return (
    <div className="topics-heatmap-shell">
      <div
        className="topics-heatmap refined"
        style={{ gridTemplateColumns: `240px repeat(${buckets.length}, minmax(52px, 1fr))` }}
      >
        <div className="heatmap-corner">{groupingLabel(groupingMode)}</div>
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

        {rows.map((row) => (
          <HeatmapRowView
            key={row.id}
            row={row}
            buckets={buckets}
            cells={cells}
            maxCount={maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={granularity}
            filterLabel={filterLabel}
            selected={selected}
            onSelect={onSelect}
            onRowSelect={onRowSelect}
          />
        ))}
      </div>
    </div>
  );
}

function HeatmapRowView({
  row,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  granularity,
  filterLabel,
  selected,
  onSelect,
  onRowSelect,
}: {
  row: HeatmapRow;
  buckets: string[];
  cells: HeatmapCell[];
  maxCount: number;
  activeBucketIndex: number;
  granularity: TimeGranularity;
  filterLabel?: string;
  selected?: { rowId: string; timeBucket: string };
  onSelect: (rowId: string, timeBucket: string) => void;
  onRowSelect?: (rowId: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="heatmap-topic-label refined"
        onClick={() => {
          onRowSelect?.(row.id);
          if (!onRowSelect) {
            onSelect(row.id, buckets[activeBucketIndex]);
          }
        }}
      >
        <strong>{row.name}</strong>
        <span>
          {rowSubtitle(row)}
        </span>
      </button>
      {buckets.map((bucket, index) => {
        const cell = getCell(cells, row.id, bucket);
        const count = cell?.count ?? 0;
        const previous = index > 0 ? getCellCount(cells, row.id, buckets[index - 1]) : 0;
        const growth = growthBetween(count, previous);
        const intensity = maxCount ? count / maxCount : 0;
        const isSelected = selected?.rowId === row.id && selected.timeBucket === bucket;
        const isActive = index === activeBucketIndex;
        const isFuture = index > activeBucketIndex;

        return (
          <button
            key={`${row.id}-${bucket}`}
            type="button"
            className={`heatmap-cell refined ${isSelected ? 'selected' : ''} ${isActive ? 'active-column' : ''} ${
              isFuture ? 'future' : ''
            }`}
            style={{ background: colorFor(intensity) }}
            title={tooltipFor(row, bucket, granularity, count, growth, cell, filterLabel)}
            onClick={() => onSelect(row.id, bucket)}
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

function tooltipFor(
  row: HeatmapRow,
  bucket: string,
  granularity: TimeGranularity,
  count: number,
  growth: number,
  cell?: HeatmapCell,
  filterLabel?: string,
) {
  const label = rowKindLabel(row.kind);
  const topTopics = cell?.topTopics.length
    ? `\nTop topics:\n${cell.topTopics.map((topic) => `- ${topic.name} (${topic.count})`).join('\n')}`
    : '';
  const scope = filterLabel ? `\nFilter: ${filterLabel}` : '';

  return `${label}: ${row.name}\n${granularity === 'month' ? 'Month' : 'Week'}: ${formatBucket(bucket, granularity)}\nTickets: ${count}\nGrowth: ${formatGrowth(growth)} vs previous${scope}${topTopics}`;
}

function groupingLabel(groupingMode: TopicGroupingMode) {
  if (groupingMode === 'project') return 'Project';
  return 'Topic';
}

function rowKindLabel(kind: HeatmapRow['kind']) {
  if (kind === 'project') return 'Project';
  return 'Topic';
}

function rowSubtitle(row: HeatmapRow) {
  if (row.kind === 'project') return `${row.topicIds.length} linked topics`;
  return row.projectIds.join(', ');
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

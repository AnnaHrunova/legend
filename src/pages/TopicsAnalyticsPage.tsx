import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { track } from '../analytics/analytics';
import {
  aggregateTopics,
  bucketFor,
  filterTicketsForRow,
  getCell,
  getCellCount,
  growthBetween,
  relatedProjects,
  type HeatmapCell,
  type HeatmapRow,
  type TimeGranularity,
  type TopicGroupingMode,
} from '../analytics/topics/aggregation';
import { projects, topics } from '../analytics/topics/domain';
import { generateTopicAnalyticsTickets, type TopicAnalyticsTicket } from '../analytics/topics/mockData';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { TimelineControls } from '../components/heatmap/TimelineControls';
import { TopicsHeatmap } from '../components/heatmap/TopicsHeatmap';
import { formatDate } from '../components/format';

type DateRangeOption = '30' | '90' | '180';
type RowSort = 'volume' | 'growth';

type SelectedCell = {
  rowId: string;
  timeBucket: string;
};

type RowMovement = {
  row: HeatmapRow;
  growth: number;
  current: number;
  previous: number;
};

const dateRangeOptions: Array<{ value: DateRangeOption; label: string; days: number }> = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: '180', label: 'Last 6 months', days: 180 },
];

export function TopicsAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('180');
  const [granularity, setGranularity] = useState<TimeGranularity>('week');
  const [groupingMode, setGroupingMode] = useState<TopicGroupingMode>('topic');
  const [sort, setSort] = useState<RowSort>('volume');
  const [activeBucketIndex, setActiveBucketIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | undefined>();

  useEffect(() => {
    track('topics_page_opened', { defaultGrouping: 'topics' });
  }, []);

  const allTickets = useMemo(() => generateTopicAnalyticsTickets(), []);
  const rangeTickets = useMemo(
    () => filterTicketsByRange(allTickets, dateRangeOptions.find((option) => option.value === dateRange)?.days ?? 180),
    [allTickets, dateRange],
  );
  const aggregation = useMemo(
    () => aggregateTopics(rangeTickets, granularity, groupingMode),
    [rangeTickets, granularity, groupingMode],
  );

  const activeBucket = aggregation.buckets[activeBucketIndex] ?? aggregation.buckets[0];

  const sortedRows = useMemo(() => {
    const rows = [...aggregation.rows];
    if (sort === 'growth') {
      return rows.sort((a, b) => rollingGrowth(b.id, aggregation.cells, aggregation.buckets, activeBucketIndex) - rollingGrowth(a.id, aggregation.cells, aggregation.buckets, activeBucketIndex));
    }
    return rows.sort((a, b) => totalForRow(b.id, aggregation.cells, aggregation.buckets, activeBucketIndex) - totalForRow(a.id, aggregation.cells, aggregation.buckets, activeBucketIndex));
  }, [activeBucketIndex, aggregation.buckets, aggregation.cells, aggregation.rows, sort]);

  const movement = useMemo(
    () => rowMovements(aggregation.rows, aggregation.cells, aggregation.buckets, activeBucketIndex),
    [activeBucketIndex, aggregation.buckets, aggregation.cells, aggregation.rows],
  );
  const emergingRows = movement.filter((item) => item.current > 0).sort((a, b) => b.growth - a.growth).slice(0, 4);
  const decliningRows = movement.filter((item) => item.previous > 0).sort((a, b) => a.growth - b.growth).slice(0, 4);

  const selectedRow = selectedCell
    ? aggregation.rows.find((row) => row.id === selectedCell.rowId)
    : sortedRows[0];
  const selectedBucket = selectedCell?.timeBucket ?? activeBucket;
  const selectedTickets = selectedRow && selectedBucket
    ? filterTicketsForRow(rangeTickets, selectedRow, selectedBucket, granularity)
    : [];
  const selectedCellData = selectedRow && selectedBucket
    ? getCell(aggregation.cells, selectedRow.id, selectedBucket)
    : undefined;
  const selectedStats = selectedRow
    ? getRowDetails(selectedRow.id, aggregation.cells, aggregation.buckets, activeBucketIndex)
    : undefined;

  const visibleTickets = useMemo(
    () => ticketsThroughActiveBucket(rangeTickets, activeBucket, granularity),
    [activeBucket, rangeTickets, granularity],
  );

  useEffect(() => {
    setActiveBucketIndex(Math.max(0, aggregation.buckets.length - 1));
    setSelectedCell(undefined);
    setIsPlaying(false);
  }, [aggregation.buckets.length, dateRange, granularity, groupingMode]);

  useEffect(() => {
    if (!isPlaying || !aggregation.buckets.length) return;

    const timer = window.setInterval(() => {
      setActiveBucketIndex((current) => {
        if (current >= aggregation.buckets.length - 1) {
          setIsPlaying(false);
          return current;
        }
        const next = current + 1;
        track('topics_time_step_changed', { timeBucket: aggregation.buckets[next] });
        return next;
      });
    }, 950);

    return () => window.clearInterval(timer);
  }, [aggregation.buckets, aggregation.buckets.length, isPlaying]);

  const handleGranularityChange = (next: TimeGranularity) => {
    if (next === granularity) return;
    const previous = granularity;
    setGranularity(next);
    track('topics_granularity_changed', { from: previous, to: next });
  };

  const handleDateRangeChange = (next: DateRangeOption) => {
    if (next === dateRange) return;
    setDateRange(next);
    track('topics_date_range_changed', { range: analyticsDateRange(next) });
  };

  const handleGroupingChange = (next: TopicGroupingMode) => {
    if (next === groupingMode) return;
    const previous = groupingMode;
    setGroupingMode(next);
    track('topics_grouping_changed', {
      from: analyticsGrouping(previous),
      to: analyticsGrouping(next),
    });
  };

  const handlePlayPause = () => {
    setIsPlaying((current) => {
      const next = !current;
      if (next && activeBucketIndex >= aggregation.buckets.length - 1) {
        setActiveBucketIndex(0);
      }
      track(next ? 'topics_play_started' : 'topics_play_paused');
      return next;
    });
  };

  const selectBucket = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, aggregation.buckets.length - 1));
    setActiveBucketIndex(nextIndex);
    setIsPlaying(false);
    track('topics_time_step_changed', { timeBucket: aggregation.buckets[nextIndex] });
  };

  const handleCellSelect = (rowId: string, timeBucket: string) => {
    const row = aggregation.rows.find((item) => item.id === rowId);
    const count = getCellCount(aggregation.cells, rowId, timeBucket);
    const identity = analyticsRowIdentity(row);
    setSelectedCell({ rowId, timeBucket });
    track('topics_cell_selected', {
      mode: row?.kind ?? groupingMode,
      ...identity,
      timeBucket,
      count,
    });
    track('topics_drilldown_opened', {
      mode: row?.kind ?? groupingMode,
      ...identity,
    });
  };

  const handleRowSelect = (rowId: string) => {
    const row = aggregation.rows.find((item) => item.id === rowId);
    setSelectedCell({ rowId, timeBucket: activeBucket });
    if (row?.kind === 'project') {
      track('topics_project_selected', { projectId: row.id });
      return;
    }
    track('topics_topic_selected', { topicId: row?.id ?? rowId });
  };

  const fastestGrowing = emergingRows[0];
  const biggestDecline = decliningRows[0];
  const feedbackTopicId = selectedRow?.kind === 'topic' ? selectedRow.id : undefined;
  const feedbackProjectId = selectedRow?.kind === 'project' ? selectedRow.id : undefined;

  return (
    <section className="page-stack topics-dashboard">
      <div className="topics-dashboard-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Topics</h1>
          <p className="view-description">See which payment-app issues users report and which internal services are under stress.</p>
        </div>
        <div className="topics-header-actions">
          <label className="topics-filter-card">
            <span>Date range</span>
            <select value={dateRange} onChange={(event) => handleDateRangeChange(event.target.value as DateRangeOption)}>
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-control topics-segmented" aria-label="Time granularity">
            {(['week', 'month'] as TimeGranularity[]).map((item) => (
              <button
                key={item}
                type="button"
                className={granularity === item ? 'active' : ''}
                onClick={() => handleGranularityChange(item)}
              >
                {item === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <FeedbackButton context="reports_dashboard" variant="inline" componentLabel="Topics analytics" />
        </div>
      </div>

      <section className="topics-kpi-grid">
        <SummaryCard label="Total tickets analyzed" value={visibleTickets.length.toLocaleString()} detail={dateRangeLabel(dateRange)} />
        <SummaryCard label="Mapped topics" value={topics.length} detail={`${projects.length} internal services`} />
        <SummaryCard
          label={`Fastest growing ${groupingMode}`}
          value={fastestGrowing?.row.name ?? 'No trend'}
          detail={fastestGrowing ? `${formatGrowth(fastestGrowing.growth)} · ${fastestGrowing.current} current` : 'Not enough data'}
          tone="up"
        />
        <SummaryCard
          label={`Biggest declining ${groupingMode}`}
          value={biggestDecline?.row.name ?? 'No decline'}
          detail={biggestDecline ? `${formatGrowth(biggestDecline.growth)} · ${biggestDecline.current} current` : 'Not enough data'}
          tone="down"
        />
      </section>

      <section className="topics-dashboard-grid">
        <div className="topics-heatmap-card">
          <div className="topics-card-header">
            <div>
              <h2>Topics Heatmap</h2>
              <p>
                {groupingMode === 'project'
                  ? 'Service pressure by project. Counts include all topics mapped to each service.'
                  : 'Controlled issue taxonomy. Every topic is mapped to one or more internal services.'}
              </p>
            </div>
            <FeedbackButton
              context="topics_heatmap"
              variant="icon"
              componentLabel="Topics heatmap"
              topicId={feedbackTopicId}
              projectId={feedbackProjectId}
              timeBucket={selectedBucket}
            />
            <div className="topics-card-controls">
              <label className="compact-label topics-sort-label">
                <span>Group by</span>
                <select value={groupingMode} onChange={(event) => handleGroupingChange(event.target.value as TopicGroupingMode)}>
                  <option value="topic">Topics</option>
                  <option value="project">Projects</option>
                </select>
              </label>
              <FeedbackButton
                context="topics_grouping_control"
                variant="icon"
                componentLabel="Topics grouping control"
              />
              <label className="compact-label topics-sort-label">
                <span>Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as RowSort)}>
                  <option value="volume">By total volume</option>
                  <option value="growth">By growth rate</option>
                </select>
              </label>
            </div>
          </div>

          <div className="topics-timeline-row">
            <TimelineControls
              buckets={aggregation.buckets}
              activeIndex={activeBucketIndex}
              isPlaying={isPlaying}
              granularity={granularity}
              onPlayPause={handlePlayPause}
              onStep={(direction) => selectBucket(activeBucketIndex + direction)}
              onChange={selectBucket}
            />
            <FeedbackButton
              context="topics_timeline"
              variant="icon"
              componentLabel="Topics timeline"
              timeBucket={activeBucket}
            />
          </div>

          <TopicsHeatmap
            rows={sortedRows}
            buckets={aggregation.buckets}
            cells={aggregation.cells}
            maxCount={aggregation.maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={granularity}
            groupingMode={groupingMode}
            selected={selectedCell}
            onSelect={handleCellSelect}
            onRowSelect={handleRowSelect}
          />

          <div className="heatmap-footer">
            <div className="heatmap-legend refined">
              <span>Low</span>
              <i />
              <strong>High</strong>
            </div>
            <span>{activeBucket ? formatBucketLabel(activeBucket, granularity) : 'No period selected'}</span>
          </div>
        </div>

        <aside className="topics-detail-card">
          <div className="topics-card-header compact">
            <div>
              <p className="eyebrow">{selectedRow?.kind === 'project' ? 'Selected project' : 'Selected topic'}</p>
              <h2>{selectedRow?.name ?? 'No selection'}</h2>
            </div>
            <FeedbackButton
              context="topics_details_panel"
              variant="icon"
              componentLabel="Topics details panel"
              topicId={feedbackTopicId}
              projectId={feedbackProjectId}
              timeBucket={selectedBucket}
            />
          </div>

          {selectedRow && selectedStats ? (
            <>
              <div className="topic-detail-stats">
                <Metric label="Tickets" value={selectedStats.total.toLocaleString()} />
                <Metric label="Growth" value={formatGrowth(selectedStats.growth)} tone={selectedStats.growth >= 0 ? 'up' : 'down'} />
              </div>
              <p className="topic-trend-summary">
                {trendSummary(selectedRow.name, selectedRow.kind, selectedStats.growth, granularity)}
              </p>

              <section className="topic-keywords">
                <h3>{selectedRow.kind === 'project' ? 'Linked topics' : 'Mapped services'}</h3>
                <div>
                  {selectedRow.kind === 'project'
                    ? selectedCellData?.topTopics.map((topic) => <span key={topic.topicId}>{topic.name}</span>)
                    : relatedProjects(selectedRow).map((project) => <span key={project.id}>{project.name}</span>)}
                </div>
              </section>

              <section className="topic-keywords">
                <h3>Keyword hints</h3>
                <div>
                  {selectedRow.keywords.slice(0, 7).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </section>

              <section className="representative-tickets">
                <h3>Representative tickets</h3>
                {representativeTickets(selectedTickets, selectedRow, rangeTickets).map((ticket) => (
                  <article key={ticket.id}>
                    <div>
                      <strong>{ticket.subject}</strong>
                      <span>{formatDate(ticket.createdAt)} · {ticket.status} · {ticket.priority}</span>
                    </div>
                    <p>{ticket.description}</p>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <div className="empty-state">
              <strong>Select a heatmap cell</strong>
              <span>Topic or project details and representative tickets will appear here.</span>
            </div>
          )}
        </aside>
      </section>

      <section className="topic-trend-grid">
        <RowMovementList title={`Emerging ${groupingMode === 'project' ? 'projects' : 'topics'}`} description="Highest positive growth in the current period." items={emergingRows} direction="up" />
        <RowMovementList title={`Declining ${groupingMode === 'project' ? 'projects' : 'topics'}`} description="Strongest negative movement versus previous period." items={decliningRows} direction="down" />
      </section>
    </section>
  );
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone?: 'up' | 'down' }) {
  return (
    <article className={`topic-kpi-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: 'up' | 'down' }) {
  return (
    <div className={`topic-metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RowMovementList({
  title,
  description,
  items,
  direction,
}: {
  title: string;
  description: string;
  items: RowMovement[];
  direction: 'up' | 'down';
}) {
  const Icon = direction === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <section className="topic-movement-card">
      <div className="topics-card-header compact">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="topic-movement-list">
        {items.map((item) => (
          <article key={item.row.id}>
            <div className={`topic-movement-icon ${direction}`}>
              <Icon size={16} />
            </div>
            <div>
              <strong>{item.row.name}</strong>
              <span>{item.current} current · {item.previous} previous</span>
            </div>
            <em className={direction}>{formatGrowth(item.growth)}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function filterTicketsByRange(tickets: TopicAnalyticsTicket[], days: number) {
  const latest = tickets.reduce((max, ticket) => Math.max(max, Date.parse(ticket.createdAt)), 0);
  const cutoff = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return tickets.filter((ticket) => Date.parse(ticket.createdAt) >= cutoff);
}

function ticketsThroughActiveBucket(tickets: TopicAnalyticsTicket[], activeBucket: string | undefined, granularity: TimeGranularity) {
  if (!activeBucket) return tickets;
  return tickets.filter((ticket) => bucketFor(ticket.createdAt, granularity) <= activeBucket);
}

function rowMovements(rows: HeatmapRow[], cells: HeatmapCell[], buckets: string[], activeIndex: number): RowMovement[] {
  return rows.map((row) => {
    const current = getCellCount(cells, row.id, buckets[activeIndex] ?? '');
    const previous = activeIndex > 0 ? getCellCount(cells, row.id, buckets[activeIndex - 1]) : 0;
    return {
      row,
      current,
      previous,
      growth: growthBetween(current, previous),
    };
  });
}

function totalForRow(rowId: string, cells: HeatmapCell[], buckets: string[], activeIndex: number) {
  return buckets.slice(0, activeIndex + 1).reduce((sum, bucket) => sum + getCellCount(cells, rowId, bucket), 0);
}

function rollingGrowth(rowId: string, cells: HeatmapCell[], buckets: string[], activeIndex: number) {
  const currentBuckets = buckets.slice(Math.max(0, activeIndex - 3), activeIndex + 1);
  const previousBuckets = buckets.slice(Math.max(0, activeIndex - 7), Math.max(0, activeIndex - 3));
  const current = currentBuckets.reduce((sum, bucket) => sum + getCellCount(cells, rowId, bucket), 0);
  const previous = previousBuckets.reduce((sum, bucket) => sum + getCellCount(cells, rowId, bucket), 0);
  return growthBetween(current, previous);
}

function getRowDetails(rowId: string, cells: HeatmapCell[], buckets: string[], activeIndex: number) {
  const total = totalForRow(rowId, cells, buckets, activeIndex);
  const growth = rollingGrowth(rowId, cells, buckets, activeIndex);
  return { total, growth };
}

function representativeTickets(selectedTickets: TopicAnalyticsTicket[], row: HeatmapRow, allTickets: TopicAnalyticsTicket[]) {
  const source = selectedTickets.length
    ? selectedTickets
    : allTickets
        .filter((ticket) => row.kind === 'topic' ? ticket.topicId === row.id : ticket.projectIds.some((projectId) => projectId === row.id))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return source.slice(0, 5);
}

function trendSummary(rowName: string, rowKind: HeatmapRow['kind'], growth: number, granularity: TimeGranularity) {
  const direction = growth > 0 ? 'increased' : growth < 0 ? 'decreased' : 'stayed flat';
  const subject = rowKind === 'project' ? 'service pressure' : 'ticket volume';
  const period = granularity === 'month' ? 'the recent monthly window' : 'the last four weeks';
  if (growth === 0) {
    return `${rowName} ${subject} stayed flat across ${period}.`;
  }
  return `${rowName} ${subject} ${direction} ${Math.abs(growth)}% across ${period}.`;
}

function formatGrowth(value: number) {
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function dateRangeLabel(value: DateRangeOption) {
  return dateRangeOptions.find((option) => option.value === value)?.label ?? 'Selected range';
}

function formatBucketLabel(bucket: string, granularity: TimeGranularity) {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${bucket}-01T00:00:00`));
  }
  return `Week of ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${bucket}T00:00:00`))}`;
}

function analyticsGrouping(mode: TopicGroupingMode): 'topics' | 'projects' {
  return mode === 'project' ? 'projects' : 'topics';
}

function analyticsDateRange(value: DateRangeOption): '30d' | '90d' | '6m' {
  if (value === '30') return '30d';
  if (value === '90') return '90d';
  return '6m';
}

function analyticsRowIdentity(row?: HeatmapRow) {
  if (!row) return {};
  return row.kind === 'project' ? { projectId: row.id } : { topicId: row.id };
}

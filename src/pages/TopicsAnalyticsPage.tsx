import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { track } from '../analytics/analytics';
import {
  aggregateByTime,
  bucketFor,
  filterTicketsForBucket,
  getCellCount,
  growthBetween,
  type TimeGranularity,
  type TicketWithTopic,
  type TopicBucket,
} from '../analytics/topics/aggregateByTime';
import { clusterTopics } from '../analytics/topics/clusterTopics';
import { computeEmbeddings } from '../analytics/topics/computeEmbeddings';
import { generateMockTopicTickets, type TopicTicket } from '../analytics/topics/generateMockTickets';
import { labelTopics, type TopicSummary } from '../analytics/topics/labelTopics';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { TimelineControls } from '../components/heatmap/TimelineControls';
import { TopicsHeatmap } from '../components/heatmap/TopicsHeatmap';
import { formatDate } from '../components/format';

type DateRangeOption = '30' | '90' | '180';
type TopicSort = 'volume' | 'growth';

type SelectedCell = {
  topicId: number;
  timeBucket: string;
};

type TopicMovement = {
  topic: TopicSummary;
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
  const [sort, setSort] = useState<TopicSort>('volume');
  const [activeBucketIndex, setActiveBucketIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | undefined>();

  useEffect(() => {
    track('topics_page_opened');
  }, []);

  const fullModel = useMemo(() => {
    const tickets = generateMockTopicTickets();
    const embeddings = computeEmbeddings(tickets);
    const clusters = clusterTopics(embeddings, 10);
    const topics = labelTopics(tickets, clusters.assignments);

    return { tickets, clusters, topics };
  }, []);

  const rangeTickets = useMemo(
    () => filterTicketsByRange(fullModel.tickets, dateRangeOptions.find((option) => option.value === dateRange)?.days ?? 180),
    [dateRange, fullModel.tickets],
  );

  const aggregation = useMemo(
    () => aggregateByTime(rangeTickets, fullModel.clusters.assignments, fullModel.topics, granularity),
    [rangeTickets, fullModel.clusters.assignments, fullModel.topics, granularity],
  );

  const activeBucket = aggregation.buckets[activeBucketIndex] ?? aggregation.buckets[0];

  const sortedTopics = useMemo(() => {
    const topics = [...fullModel.topics];
    if (sort === 'growth') {
      return topics.sort((a, b) => rollingGrowth(b.id, aggregation.cells, aggregation.buckets, activeBucketIndex) - rollingGrowth(a.id, aggregation.cells, aggregation.buckets, activeBucketIndex));
    }
    return topics.sort((a, b) => totalForTopic(b.id, aggregation.cells, aggregation.buckets, activeBucketIndex) - totalForTopic(a.id, aggregation.cells, aggregation.buckets, activeBucketIndex));
  }, [activeBucketIndex, aggregation.buckets, aggregation.cells, fullModel.topics, sort]);

  const movement = useMemo(
    () => topicMovements(fullModel.topics, aggregation.cells, aggregation.buckets, activeBucketIndex),
    [activeBucketIndex, aggregation.buckets, aggregation.cells, fullModel.topics],
  );
  const emergingTopics = movement.filter((item) => item.current > 0).sort((a, b) => b.growth - a.growth).slice(0, 4);
  const decliningTopics = movement.filter((item) => item.previous > 0).sort((a, b) => a.growth - b.growth).slice(0, 4);

  const selectedTopic = selectedCell
    ? fullModel.topics.find((topic) => topic.id === selectedCell.topicId)
    : sortedTopics[0];
  const selectedBucket = selectedCell?.timeBucket ?? activeBucket;
  const selectedTickets = selectedTopic && selectedBucket
    ? filterTicketsForBucket(aggregation.ticketsWithTopics, selectedTopic.id, selectedBucket, granularity)
    : [];

  const selectedTopicStats = selectedTopic
    ? getTopicDetails(selectedTopic.id, aggregation.cells, aggregation.buckets, activeBucketIndex)
    : undefined;

  const visibleTickets = useMemo(
    () => ticketsThroughActiveBucket(aggregation.ticketsWithTopics, activeBucket, granularity),
    [activeBucket, aggregation.ticketsWithTopics, granularity],
  );

  useEffect(() => {
    setActiveBucketIndex(Math.max(0, aggregation.buckets.length - 1));
    setSelectedCell(undefined);
    setIsPlaying(false);
  }, [aggregation.buckets.length, dateRange, granularity]);

  useEffect(() => {
    if (!isPlaying || !aggregation.buckets.length) return;

    const timer = window.setInterval(() => {
      setActiveBucketIndex((current) => {
        if (current >= aggregation.buckets.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 950);

    return () => window.clearInterval(timer);
  }, [aggregation.buckets.length, isPlaying]);

  const handleGranularityChange = (next: TimeGranularity) => {
    if (next === granularity) return;
    setGranularity(next);
    track('topics_granularity_changed', { granularity: next });
  };

  const handleDateRangeChange = (next: DateRangeOption) => {
    if (next === dateRange) return;
    setDateRange(next);
    track('topics_date_range_changed', { dateRange: next });
  };

  const handlePlayPause = () => {
    setIsPlaying((current) => {
      const next = !current;
      if (next && activeBucketIndex >= aggregation.buckets.length - 1) {
        setActiveBucketIndex(0);
      }
      track(next ? 'topics_play_started' : 'topics_play_paused', {
        timeBucket: aggregation.buckets[activeBucketIndex],
        granularity,
      });
      return next;
    });
  };

  const selectBucket = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, aggregation.buckets.length - 1));
    setActiveBucketIndex(nextIndex);
    setIsPlaying(false);
    track('topics_time_bucket_selected', {
      timeBucket: aggregation.buckets[nextIndex],
      granularity,
    });
  };

  const handleCellSelect = (topicId: number, timeBucket: string) => {
    const topic = fullModel.topics.find((item) => item.id === topicId);
    setSelectedCell({ topicId, timeBucket });
    track('topics_cell_selected', {
      topic: topic?.label ?? `topic-${topicId}`,
      timeBucket,
      granularity,
      count: getCellCount(aggregation.cells, topicId, timeBucket),
    });
  };

  const handleTopicSelect = (topicId: number) => {
    const topic = fullModel.topics.find((item) => item.id === topicId);
    setSelectedCell({ topicId, timeBucket: activeBucket });
    track('topics_topic_selected', {
      topic: topic?.label ?? `topic-${topicId}`,
      timeBucket: activeBucket,
    });
  };

  const fastestGrowing = emergingTopics[0];
  const biggestDecline = decliningTopics[0];

  return (
    <section className="page-stack topics-dashboard">
      <div className="topics-dashboard-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Topics</h1>
          <p className="view-description">Track how support topics change over time</p>
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
        <SummaryCard label="Active topics" value={fullModel.topics.length} detail={`${aggregation.buckets.length} ${granularity} buckets`} />
        <SummaryCard
          label="Fastest growing topic"
          value={fastestGrowing?.topic.label ?? 'No trend'}
          detail={fastestGrowing ? `${formatGrowth(fastestGrowing.growth)} · ${fastestGrowing.current} current` : 'Not enough data'}
          tone="up"
        />
        <SummaryCard
          label="Biggest declining topic"
          value={biggestDecline?.topic.label ?? 'No decline'}
          detail={biggestDecline ? `${formatGrowth(biggestDecline.growth)} · ${biggestDecline.current} current` : 'Not enough data'}
          tone="down"
        />
      </section>

      <section className="topics-dashboard-grid">
        <div className="topics-heatmap-card">
          <div className="topics-card-header">
            <div>
              <h2>Topic Heatmap</h2>
              <p>Ticket volume by topic and {granularity === 'month' ? 'month' : 'week'}. Future periods are muted during playback.</p>
            </div>
            <label className="compact-label topics-sort-label">
              <span>Topic sorting</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as TopicSort)}>
                <option value="volume">By total volume</option>
                <option value="growth">By growth rate</option>
              </select>
            </label>
          </div>

          <TimelineControls
            buckets={aggregation.buckets}
            activeIndex={activeBucketIndex}
            isPlaying={isPlaying}
            granularity={granularity}
            onPlayPause={handlePlayPause}
            onStep={(direction) => selectBucket(activeBucketIndex + direction)}
            onChange={selectBucket}
          />

          <TopicsHeatmap
            topics={sortedTopics}
            buckets={aggregation.buckets}
            cells={aggregation.cells}
            maxCount={aggregation.maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={granularity}
            selected={selectedCell}
            onSelect={handleCellSelect}
            onTopicSelect={handleTopicSelect}
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
              <p className="eyebrow">Selected topic</p>
              <h2>{selectedTopic?.label ?? 'No topic selected'}</h2>
            </div>
          </div>

          {selectedTopic && selectedTopicStats ? (
            <>
              <div className="topic-detail-stats">
                <Metric label="Total tickets" value={selectedTopicStats.total.toLocaleString()} />
                <Metric label="Growth" value={formatGrowth(selectedTopicStats.growth)} tone={selectedTopicStats.growth >= 0 ? 'up' : 'down'} />
              </div>
              <p className="topic-trend-summary">
                {trendSummary(selectedTopic.label, selectedTopicStats.growth, granularity)}
              </p>

              <section className="topic-keywords">
                <h3>Top keywords</h3>
                <div>
                  {selectedTopic.keywords.slice(0, 6).map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </section>

              <section className="representative-tickets">
                <h3>Representative tickets</h3>
                {representativeTickets(selectedTickets, selectedTopic.id, aggregation.ticketsWithTopics).map((ticket) => (
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
              <span>Topic details and representative tickets will appear here.</span>
            </div>
          )}
        </aside>
      </section>

      <section className="topic-trend-grid">
        <TopicMovementList title="Emerging topics" description="Highest positive growth in the current period." items={emergingTopics} direction="up" />
        <TopicMovementList title="Declining topics" description="Strongest negative movement versus previous period." items={decliningTopics} direction="down" />
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

function TopicMovementList({
  title,
  description,
  items,
  direction,
}: {
  title: string;
  description: string;
  items: TopicMovement[];
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
          <article key={item.topic.id}>
            <div className={`topic-movement-icon ${direction}`}>
              <Icon size={16} />
            </div>
            <div>
              <strong>{item.topic.label}</strong>
              <span>{item.current} current · {item.previous} previous</span>
            </div>
            <em className={direction}>{formatGrowth(item.growth)}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function filterTicketsByRange(tickets: TopicTicket[], days: number) {
  const latest = tickets.reduce((max, ticket) => Math.max(max, Date.parse(ticket.createdAt)), 0);
  const cutoff = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return tickets.filter((ticket) => Date.parse(ticket.createdAt) >= cutoff);
}

function ticketsThroughActiveBucket(tickets: TicketWithTopic[], activeBucket: string | undefined, granularity: TimeGranularity) {
  if (!activeBucket) return tickets;
  return tickets.filter((ticket) => bucketFor(ticket.createdAt, granularity) <= activeBucket);
}

function topicMovements(topics: TopicSummary[], cells: TopicBucket[], buckets: string[], activeIndex: number): TopicMovement[] {
  return topics.map((topic) => {
    const current = getCellCount(cells, topic.id, buckets[activeIndex] ?? '');
    const previous = activeIndex > 0 ? getCellCount(cells, topic.id, buckets[activeIndex - 1]) : 0;
    return {
      topic,
      current,
      previous,
      growth: growthBetween(current, previous),
    };
  });
}

function totalForTopic(topicId: number, cells: TopicBucket[], buckets: string[], activeIndex: number) {
  return buckets.slice(0, activeIndex + 1).reduce((sum, bucket) => sum + getCellCount(cells, topicId, bucket), 0);
}

function rollingGrowth(topicId: number, cells: TopicBucket[], buckets: string[], activeIndex: number) {
  const currentBuckets = buckets.slice(Math.max(0, activeIndex - 3), activeIndex + 1);
  const previousBuckets = buckets.slice(Math.max(0, activeIndex - 7), Math.max(0, activeIndex - 3));
  const current = currentBuckets.reduce((sum, bucket) => sum + getCellCount(cells, topicId, bucket), 0);
  const previous = previousBuckets.reduce((sum, bucket) => sum + getCellCount(cells, topicId, bucket), 0);
  return growthBetween(current, previous);
}

function getTopicDetails(topicId: number, cells: TopicBucket[], buckets: string[], activeIndex: number) {
  const total = totalForTopic(topicId, cells, buckets, activeIndex);
  const growth = rollingGrowth(topicId, cells, buckets, activeIndex);
  return { total, growth };
}

function representativeTickets(selectedTickets: TicketWithTopic[], topicId: number, allTickets: TicketWithTopic[]) {
  const source = selectedTickets.length
    ? selectedTickets
    : allTickets.filter((ticket) => ticket.topicId === topicId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return source.slice(0, 5);
}

function trendSummary(topicLabel: string, growth: number, granularity: TimeGranularity) {
  const direction = growth > 0 ? 'increased' : growth < 0 ? 'decreased' : 'stayed flat';
  const period = granularity === 'month' ? 'the recent monthly window' : 'the last four weeks';
  if (growth === 0) {
    return `${topicLabel} stayed flat across ${period}.`;
  }
  return `${topicLabel} ${direction} ${Math.abs(growth)}% across ${period}.`;
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

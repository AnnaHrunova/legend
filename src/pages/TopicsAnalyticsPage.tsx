import { useEffect, useMemo, useState } from 'react';
import { track } from '../analytics/analytics';
import {
  aggregateByTime,
  filterTicketsForBucket,
  type TimeGranularity,
} from '../analytics/topics/aggregateByTime';
import { clusterTopics } from '../analytics/topics/clusterTopics';
import { computeEmbeddings } from '../analytics/topics/computeEmbeddings';
import { generateMockTopicTickets } from '../analytics/topics/generateMockTickets';
import { labelTopics } from '../analytics/topics/labelTopics';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { TimelineControls } from '../components/heatmap/TimelineControls';
import { TopicsHeatmap } from '../components/heatmap/TopicsHeatmap';
import { formatDate } from '../components/format';

type TopicSort = 'volume' | 'growth';

export function TopicsAnalyticsPage() {
  const [granularity, setGranularity] = useState<TimeGranularity>('week');
  const [sort, setSort] = useState<TopicSort>('volume');
  const [activeBucketIndex, setActiveBucketIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ topicId: number; timeBucket: string } | undefined>();

  useEffect(() => {
    track('view_opened', { view: 'reports' });
  }, []);

  const model = useMemo(() => {
    const tickets = generateMockTopicTickets();
    const embeddings = computeEmbeddings(tickets);
    const clusters = clusterTopics(embeddings, 8);
    const topics = labelTopics(tickets, clusters.assignments);

    return { tickets, clusters, topics };
  }, []);

  const aggregation = useMemo(
    () => aggregateByTime(model.tickets, model.clusters.assignments, model.topics, granularity),
    [granularity, model],
  );

  const sortedTopics = useMemo(() => {
    const topics = [...model.topics];
    if (sort === 'growth') {
      return topics.sort((a, b) => b.growthRate - a.growthRate);
    }
    return topics.sort((a, b) => b.total - a.total);
  }, [model.topics, sort]);

  useEffect(() => {
    setActiveBucketIndex(Math.max(0, aggregation.buckets.length - 1));
    setSelectedCell(undefined);
    setIsPlaying(false);
  }, [aggregation.buckets.length, granularity]);

  useEffect(() => {
    if (!isPlaying || !aggregation.buckets.length) return;

    const timer = window.setInterval(() => {
      setActiveBucketIndex((current) => {
        if (current >= aggregation.buckets.length - 1) {
          return 0;
        }
        return current + 1;
      });
    }, 650);

    return () => window.clearInterval(timer);
  }, [aggregation.buckets.length, isPlaying]);

  const selectedTickets = selectedCell
    ? filterTicketsForBucket(
        aggregation.ticketsWithTopics,
        selectedCell.topicId,
        selectedCell.timeBucket,
        granularity,
      )
    : [];
  const selectedTopic = selectedCell
    ? model.topics.find((topic) => topic.id === selectedCell.topicId)
    : undefined;
  const fastestGrowing = [...model.topics].sort((a, b) => b.growthRate - a.growthRate).slice(0, 3);

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Topics heatmap</h1>
          <p className="view-description">
            Prototype topic detection using deterministic mock data, hash embeddings, k-means clustering,
            and time-bucket aggregation.
          </p>
        </div>
        <FeedbackButton
          context="reports_dashboard"
          variant="inline"
          componentLabel="Topics analytics"
        />
      </div>

      <div className="topics-summary-grid">
        <Metric label="Mock tickets" value={model.tickets.length.toLocaleString()} />
        <Metric label="Detected topics" value={model.topics.length} />
        <Metric label="Time buckets" value={aggregation.buckets.length} />
        <Metric label="Fastest growth" value={`${fastestGrowing[0]?.growthRate ?? 0}%`} />
      </div>

      <section className="topics-control-panel">
        <div className="segmented-control" aria-label="Time granularity">
          {(['week', 'day'] as TimeGranularity[]).map((item) => (
            <button
              key={item}
              className={granularity === item ? 'active' : ''}
              onClick={() => setGranularity(item)}
            >
              {item === 'week' ? 'Week' : 'Day'}
            </button>
          ))}
        </div>

        <label className="compact-label">
          <span>Topic sorting</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as TopicSort)}>
            <option value="volume">By total volume</option>
            <option value="growth">By growth rate</option>
          </select>
        </label>

        <TimelineControls
          buckets={aggregation.buckets}
          activeIndex={activeBucketIndex}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying((current) => !current)}
          onChange={(index) => {
            setActiveBucketIndex(index);
            setIsPlaying(false);
          }}
        />
      </section>

      <section className="topics-layout">
        <div className="topics-main-panel">
          <div className="section-header">
            <h2>Topic frequency over time</h2>
            <div className="heatmap-legend">
              <span>Low</span>
              <i />
              <strong>High</strong>
            </div>
          </div>
          <TopicsHeatmap
            topics={sortedTopics}
            buckets={aggregation.buckets}
            cells={aggregation.cells}
            maxCount={aggregation.maxCount}
            activeBucketIndex={activeBucketIndex}
            selected={selectedCell}
            onSelect={(topicId, timeBucket) => setSelectedCell({ topicId, timeBucket })}
          />
        </div>

        <aside className="topics-side-panel">
          <section className="topic-list-panel">
            <div className="section-header">
              <h2>Topic labels</h2>
            </div>
            <div className="topic-list">
              {sortedTopics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={selectedCell?.topicId === topic.id ? 'active' : ''}
                  onClick={() =>
                    setSelectedCell({
                      topicId: topic.id,
                      timeBucket: aggregation.buckets[activeBucketIndex],
                    })
                  }
                >
                  <strong>{topic.label}</strong>
                  <span>{topic.keywords.slice(0, 4).join(', ')}</span>
                  <em>{topic.growthRate > 0 ? '+' : ''}{topic.growthRate}%</em>
                </button>
              ))}
            </div>
          </section>

          <section className="topic-list-panel">
            <div className="section-header">
              <h2>Drill-down</h2>
              <span>{selectedTickets.length} tickets</span>
            </div>
            {selectedTopic ? (
              <div className="topic-drilldown">
                <strong>{selectedTopic.label}</strong>
                <span>{selectedCell?.timeBucket}</span>
                <div>
                  {selectedTickets.slice(0, 12).map((ticket) => (
                    <article key={ticket.id}>
                      <strong>{ticket.subject}</strong>
                      <span>{ticket.id} · {formatDate(ticket.createdAt)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Select a cell</strong>
                <span>Click a heatmap cell to inspect tickets for that topic and time bucket.</span>
              </div>
            )}
          </section>
        </aside>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric-card compact">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}


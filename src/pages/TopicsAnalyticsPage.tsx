import { useEffect, useMemo, useState } from 'react';
import { track } from '../analytics/analytics';
import {
  aggregateTopics,
  filterTicketsForRow,
  getCell,
  getCellCount,
  growthBetween,
  relatedProjects,
  type HeatmapRow,
  type TimeGranularity,
} from '../analytics/topics/aggregation';
import { projects, topics } from '../analytics/topics/domain';
import { getProject, getTopic } from '../analytics/topics/domain';
import { generateTopicAnalyticsTickets, type TopicAnalyticsTicket } from '../analytics/topics/mockData';
import {
  AnalyticsFilterPanel,
  type AnalyticsFilterState,
} from '../components/analytics/AnalyticsFilterPanel';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { TimelineControls } from '../components/heatmap/TimelineControls';
import { TopicsHeatmap } from '../components/heatmap/TopicsHeatmap';
import { formatDate } from '../components/format';
import {
  severityFromRating,
  type ReviewSeverity,
  type ReviewSource,
} from '../domain/types';

const defaultTopicFilters: AnalyticsFilterState = {
  source: 'all',
  groupBy: 'topic',
  severity: 'all',
  dateRange: '90d',
  granularity: 'week',
  focusMode: 'all',
};

type SelectedCell = {
  rowId: string;
  timeBucket: string;
};

export function TopicsAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilterState>(defaultTopicFilters);
  const [activeBucketIndex, setActiveBucketIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | undefined>();

  useEffect(() => {
    track('topics_page_opened');
  }, []);

  const allTickets = useMemo(() => generateTopicAnalyticsTickets(), []);
  const rangeTickets = useMemo(
    () => filterTicketsByRange(allTickets, daysForRange(filters.dateRange)),
    [allTickets, filters.dateRange],
  );
  const filteredTickets = useMemo(
    () => rangeTickets.filter((ticket) => matchesAnalyticsFilters(ticket, filters)),
    [filters, rangeTickets],
  );
  const aggregation = useMemo(
    () => aggregateTopics(filteredTickets, filters.granularity, filters.groupBy),
    [filteredTickets, filters.granularity, filters.groupBy],
  );

  const activeBucket = aggregation.buckets[activeBucketIndex] ?? aggregation.buckets[0];
  const focusedRows = useMemo(
    () => rowsForFocus(aggregation.rows, filters),
    [aggregation.rows, filters],
  );
  const visibleRows = useMemo(
    () => sortRowsForHeatmap(focusedRows, aggregation.cells, aggregation.buckets, activeBucketIndex),
    [activeBucketIndex, aggregation.buckets, aggregation.cells, focusedRows],
  );
  const selectedRow = selectedCell
    ? focusedRows.find((row) => row.id === selectedCell.rowId)
    : visibleRows[0];
  const selectedBucket = selectedCell?.timeBucket ?? activeBucket;
  const selectedCount = selectedRow && selectedBucket ? getCellCount(aggregation.cells, selectedRow.id, selectedBucket) : 0;
  const previousCount = selectedRow && selectedBucket
    ? previousCellCount(aggregation.buckets, aggregation.cells, selectedRow.id, selectedBucket)
    : 0;
  const selectedGrowth = growthBetween(selectedCount, previousCount);
  const selectedTickets = selectedRow && selectedBucket
    ? filterTicketsForRow(filteredTickets, selectedRow, selectedBucket, filters.granularity)
    : [];
  const selectedCellData = selectedRow && selectedBucket ? getCell(aggregation.cells, selectedRow.id, selectedBucket) : undefined;
  const filterLabel = sourceFilterLabel(filters.source);

  useEffect(() => {
    setActiveBucketIndex(Math.max(0, aggregation.buckets.length - 1));
    setSelectedCell(undefined);
    setIsPlaying(false);
  }, [aggregation.buckets.length, filters]);

  useEffect(() => {
    if (!isPlaying || !aggregation.buckets.length) return;

    const timer = window.setInterval(() => {
      setActiveBucketIndex((current) => {
        if (current >= aggregation.buckets.length - 1) {
          setIsPlaying(false);
          return current;
        }
        const next = current + 1;
        track('topics_time_step_changed', {
          timeBucket: aggregation.buckets[next],
          ...analyticsFilterProperties(filters),
        });
        return next;
      });
    }, 950);

    return () => window.clearInterval(timer);
  }, [aggregation.buckets, aggregation.buckets.length, filters, isPlaying]);

  function handleFilterChange(next: AnalyticsFilterState) {
    setFilters(next);
    setSelectedCell(undefined);
  }

  function handlePlayPause() {
    setIsPlaying((current) => {
      const next = !current;
      if (next && activeBucketIndex >= aggregation.buckets.length - 1) {
        setActiveBucketIndex(0);
      }
      track(next ? 'topics_play_started' : 'topics_play_paused', analyticsFilterProperties(filters));
      return next;
    });
  }

  function selectBucket(index: number) {
    const nextIndex = Math.max(0, Math.min(index, aggregation.buckets.length - 1));
    const nextBucket = aggregation.buckets[nextIndex];
    setActiveBucketIndex(nextIndex);
    setIsPlaying(false);
    if (nextBucket) {
      track('topics_time_step_changed', {
        timeBucket: nextBucket,
        ...analyticsFilterProperties(filters),
      });
    }
  }

  function handleCellSelect(rowId: string, timeBucket: string) {
    const row = aggregation.rows.find((item) => item.id === rowId);
    const count = getCellCount(aggregation.cells, rowId, timeBucket);
    setSelectedCell({ rowId, timeBucket });
    track('topics_cell_selected', {
      groupBy: filters.groupBy,
      rowId,
      rowLabel: row?.name ?? rowId,
      timeBucket,
      count,
      source: filters.source,
      focusMode: filters.focusMode,
      ...(filters.focusId ? { focusId: filters.focusId } : {}),
    });
    track('topics_drilldown_opened', {
      groupBy: filters.groupBy,
      rowId,
      timeBucket,
      count,
    });
  }

  function handleRowSelect(rowId: string) {
    if (!activeBucket) return;
    handleCellSelect(rowId, activeBucket);
  }

  return (
    <section className="page-stack topics-dashboard focused-topics-page">
      <div className="topics-dashboard-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Topics Heatmap</h1>
          <p className="view-description">Track how support topics change over time across projects and platforms.</p>
        </div>
      </div>

      <AnalyticsFilterPanel
        value={filters}
        defaultValue={defaultTopicFilters}
        projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
        topicOptions={topics.map((topic) => ({ id: topic.id, name: topic.name }))}
        onChange={handleFilterChange}
      />

      <section className="topics-dashboard-grid focused">
        <div className="topics-heatmap-card">
          <div className="topics-card-header">
            <div>
              <h2>Heatmap</h2>
              <p>{heatmapDescription(filters)}</p>
            </div>
            <FeedbackButton
              context="topics_heatmap"
              variant="icon"
              componentLabel="Topics heatmap"
              source={filters.source}
              groupBy={filters.groupBy}
              severity={filters.severity}
              focusMode={filters.focusMode}
              focusId={filters.focusId}
              timeBucket={selectedBucket}
            />
          </div>

          <div className="topics-timeline-row compact top">
            <TimelineControls
              buckets={aggregation.buckets}
              activeIndex={activeBucketIndex}
              isPlaying={isPlaying}
              granularity={filters.granularity}
              onPlayPause={handlePlayPause}
              onStep={(direction) => selectBucket(activeBucketIndex + direction)}
              onChange={selectBucket}
            />
            <FeedbackButton
              context="topics_timeline"
              variant="icon"
              componentLabel="Topics timeline"
              source={filters.source}
              groupBy={filters.groupBy}
              focusMode={filters.focusMode}
              focusId={filters.focusId}
              timeBucket={activeBucket}
            />
          </div>

          <TopicsHeatmap
            rows={visibleRows}
            buckets={aggregation.buckets}
            cells={aggregation.cells}
            maxCount={aggregation.maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={filters.granularity}
            groupingMode={filters.groupBy}
            filterLabel={filterLabel}
            selected={selectedCell}
            onSelect={handleCellSelect}
            onRowSelect={handleRowSelect}
          />

          {aggregation.buckets.length === 0 && (
            <div className="empty-state heatmap-empty-state">
              <strong>No matching tickets</strong>
              <span>Try a wider time range or remove severity/focus filters.</span>
            </div>
          )}

          <div className="heatmap-footer">
            <div className="heatmap-legend refined">
              <span>Low</span>
              <i />
              <strong>High</strong>
            </div>
            <span>
              {filteredTickets.length.toLocaleString()} matching items · {activeBucket ? formatBucketLabel(activeBucket, filters.granularity) : 'No period selected'}
            </span>
          </div>
        </div>

        <aside className="topics-detail-card compact-drilldown">
          <div className="topics-card-header compact">
            <div>
              <p className="eyebrow">Drill-down</p>
              <h2>{selectedRow?.name ?? 'Select a cell'}</h2>
            </div>
            <FeedbackButton
              context="topics_drilldown_panel"
              variant="icon"
              componentLabel="Topics drill-down panel"
              source={filters.source}
              groupBy={filters.groupBy}
              severity={filters.severity}
              focusMode={filters.focusMode}
              focusId={filters.focusId}
              timeBucket={selectedBucket}
            />
          </div>

          {selectedRow && selectedBucket ? (
            <>
              <dl className="compact-drilldown-stats">
                <div>
                  <dt>Period</dt>
                  <dd>{formatBucketLabel(selectedBucket, filters.granularity)}</dd>
                </div>
                <div>
                  <dt>Count</dt>
                  <dd>{selectedCount}</dd>
                </div>
                <div>
                  <dt>Growth</dt>
                  <dd className={selectedGrowth >= 0 ? 'up' : 'down'}>{formatGrowth(selectedGrowth)}</dd>
                </div>
              </dl>

              {selectedRow.kind === 'topic' && (
                <section className="topic-keywords compact">
                  <h3>Related projects</h3>
                  <div>
                    {relatedProjects(selectedRow).map((project) => (
                      <span key={project.id}>{project.name}</span>
                    ))}
                  </div>
                </section>
              )}

              {selectedRow.kind === 'project' && selectedCellData?.topTopics.length ? (
                <section className="topic-keywords compact">
                  <h3>Top topics</h3>
                  <div>
                    {selectedCellData.topTopics.map((topic) => (
                      <span key={topic.topicId}>{topic.name}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              {selectedRow.kind === 'project' && relatedProjectsForProject(selectedRow.id).length ? (
                <section className="topic-keywords compact">
                  <h3>Related projects</h3>
                  <div>
                    {relatedProjectsForProject(selectedRow.id).map((project) => (
                      <span key={project.id}>{project.name}</span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="representative-tickets compact">
                <h3>Representative tickets and reviews</h3>
                {representativeTickets(selectedTickets, selectedRow, filteredTickets).map((ticket) => (
                  <article key={ticket.id}>
                    <div>
                      <strong>{ticket.subject}</strong>
                      <span>{ticketMeta(ticket)}</span>
                    </div>
                    <p>{ticket.description}</p>
                  </article>
                ))}
              </section>
            </>
          ) : (
            <div className="empty-state">
              <strong>Select a heatmap cell</strong>
              <span>Matching tickets, reviews, and period movement will appear here.</span>
            </div>
          )}
        </aside>
      </section>
    </section>
  );
}

function filterTicketsByRange(tickets: TopicAnalyticsTicket[], days: number) {
  const latest = tickets.reduce((max, ticket) => Math.max(max, Date.parse(ticket.createdAt)), 0);
  const cutoff = latest - (days - 1) * 24 * 60 * 60 * 1000;
  return tickets.filter((ticket) => Date.parse(ticket.createdAt) >= cutoff);
}

function rowsForFocus(rows: HeatmapRow[], filters: AnalyticsFilterState) {
  if (filters.focusMode === 'all' || !filters.focusId) return rows;

  if (filters.focusMode === 'project') {
    if (filters.groupBy === 'project') {
      return rows.filter((row) => row.kind === 'project' && row.id === filters.focusId);
    }
    return rows.filter((row) => row.kind === 'topic' && row.projectIds.some((projectId) => projectId === filters.focusId));
  }

  const focusedTopic = getTopic(filters.focusId);
  if (filters.groupBy === 'topic') {
    return rows.filter((row) => row.kind === 'topic' && row.id === filters.focusId);
  }
  return rows.filter((row) => row.kind === 'project' && focusedTopic?.projectIds.some((projectId) => projectId === row.id));
}

function sortRowsForHeatmap(rows: HeatmapRow[], cells: ReturnType<typeof aggregateTopics>['cells'], buckets: string[], activeIndex: number) {
  return rows
    .filter((row) => buckets.some((bucket) => getCellCount(cells, row.id, bucket) > 0))
    .sort((a, b) => totalThroughBucket(b.id, cells, buckets, activeIndex) - totalThroughBucket(a.id, cells, buckets, activeIndex));
}

function totalThroughBucket(rowId: string, cells: ReturnType<typeof aggregateTopics>['cells'], buckets: string[], activeIndex: number) {
  return buckets.slice(0, activeIndex + 1).reduce((sum, bucket) => sum + getCellCount(cells, rowId, bucket), 0);
}

function previousCellCount(buckets: string[], cells: ReturnType<typeof aggregateTopics>['cells'], rowId: string, bucket: string) {
  const index = buckets.indexOf(bucket);
  if (index <= 0) return 0;
  return getCellCount(cells, rowId, buckets[index - 1]);
}

function representativeTickets(selectedTickets: TopicAnalyticsTicket[], row: HeatmapRow, allTickets: TopicAnalyticsTicket[]) {
  const source = selectedTickets.length
    ? selectedTickets
    : allTickets
        .filter((ticket) => matchesRowForDetails(ticket, row))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return source.slice(0, 5);
}

function matchesRowForDetails(ticket: TopicAnalyticsTicket, row: HeatmapRow) {
  if (row.kind === 'topic') return ticket.topicId === row.id;
  if (row.kind === 'project') return ticket.projectIds.some((projectId) => projectId === row.id);
  return false;
}

function relatedProjectsForProject(projectId: string) {
  const relatedIds = new Set<string>();
  topics
    .filter((topic) => topic.projectIds.some((topicProjectId) => topicProjectId === projectId))
    .forEach((topic) => {
      topic.projectIds.forEach((relatedId) => {
        if (relatedId !== projectId) relatedIds.add(relatedId);
      });
    });
  return Array.from(relatedIds)
    .flatMap((relatedId) => {
      const project = getProject(relatedId);
      return project ? [project] : [];
    });
}

function matchesAnalyticsFilters(ticket: TopicAnalyticsTicket, filters: AnalyticsFilterState) {
  if (filters.source === 'support' && ticket.source !== 'support') return false;
  if ((filters.source === 'google_play' || filters.source === 'app_store') && ticket.reviewSource !== filters.source) return false;
  const platform = getPlatformFromSource(filters.source);
  if (platform && ticket.platform !== platform) return false;
  if (filters.severity !== 'all' && topicTicketSeverity(ticket) !== filters.severity) return false;
  if (filters.focusMode === 'topic' && filters.focusId && ticket.topicId !== filters.focusId) return false;
  if (filters.focusMode === 'project' && filters.focusId && !ticket.projectIds.some((projectId) => projectId === filters.focusId)) return false;
  return true;
}

function getPlatformFromSource(source: AnalyticsFilterState['source']) {
  if (source === 'google_play') return 'android';
  if (source === 'app_store') return 'ios';
  return undefined;
}

function topicTicketSeverity(ticket: TopicAnalyticsTicket): ReviewSeverity {
  const reviewSeverity = severityFromRating(ticket.rating);
  if (reviewSeverity) return reviewSeverity;
  if (ticket.priority === 'Urgent' || ticket.priority === 'High') return 'critical';
  if (ticket.priority === 'Normal') return 'medium';
  return 'low';
}

function analyticsFilterProperties(filters: AnalyticsFilterState) {
  return {
    source: filters.source,
    groupBy: filters.groupBy,
    focusMode: filters.focusMode,
    ...(filters.focusId ? { focusId: filters.focusId } : {}),
    granularity: filters.granularity,
  };
}

function sourceFilterLabel(source: AnalyticsFilterState['source']) {
  if (source === 'google_play') return 'Google Play reviews · Android';
  if (source === 'app_store') return 'App Store reviews · iOS';
  if (source === 'support') return 'Support tickets';
  return 'All data';
}

function heatmapDescription(filters: AnalyticsFilterState) {
  const rowLabel = filters.groupBy === 'project' ? 'projects' : 'topics';
  return `Rows are ${rowLabel}; columns are ${filters.granularity === 'month' ? 'months' : 'weeks'}; cells are ticket and review counts.`;
}

function ticketMeta(ticket: TopicAnalyticsTicket) {
  if (ticket.source === 'review') {
    return `${formatDate(ticket.createdAt)} · ${ticket.rating ?? 'n/a'} star · ${reviewSourceLabel(ticket.reviewSource)}${ticket.appVersion ? ` · v${ticket.appVersion}` : ''}`;
  }
  return `${formatDate(ticket.createdAt)} · support · ${ticket.priority} · ${ticket.status}`;
}

function reviewSourceLabel(source?: ReviewSource) {
  return source === 'google_play' ? 'Google Play' : 'App Store';
}

function formatGrowth(value: number) {
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function formatBucketLabel(bucket: string, granularity: TimeGranularity) {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${bucket}-01T00:00:00`));
  }
  return `Week of ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${bucket}T00:00:00`))}`;
}

function daysForRange(range: AnalyticsFilterState['dateRange']) {
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 180;
}

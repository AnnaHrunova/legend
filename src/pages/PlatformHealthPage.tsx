import { useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';
import { track } from '../analytics/analytics';
import {
  aggregatePlatformHeatmap,
  emergingRisks,
  filterItemsForCell,
  matchesPlatform,
  platformStats,
  severityFor,
  sourceBreakdown,
  type PlatformHealthGranularity,
  type PlatformHeatmapCell,
} from '../analytics/platformHealth/aggregation';
import {
  platformHealthTopics,
  platformProjects,
  topicById,
  type PlatformHealthTopic,
  type PlatformProjectId,
  type PlatformHealthSelection,
  type PlatformRelease,
} from '../analytics/platformHealth/domain';
import { generatePlatformHealthItems, platformHealthReleases, type PlatformHealthItem } from '../analytics/platformHealth/mockData';
import {
  AnalyticsFilterPanel,
  type AnalyticsFilterState,
} from '../components/analytics/AnalyticsFilterPanel';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { formatDate } from '../components/format';

type SelectedCell = {
  platform: PlatformHealthSelection;
  topicId: string;
  timeBucket: string;
};

const defaultAnalyticsFilters: AnalyticsFilterState = {
  source: 'all',
  severity: 'all',
  dateRange: '90d',
  granularity: 'week',
  focusMode: 'all',
  sortBy: 'total_volume',
};

export function PlatformHealthPage() {
  const [filters, setFilters] = useState<AnalyticsFilterState>(defaultAnalyticsFilters);
  const [activeBucketIndex, setActiveBucketIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | undefined>();

  useEffect(() => {
    track('platform_health_page_opened', {
      defaultRange: '90d',
      defaultGranularity: 'week',
    });
  }, []);

  const allItems = useMemo(() => generatePlatformHealthItems(), []);
  const releaseMarkers = useMemo(() => platformHealthReleases(), []);
  const days = daysForRange(filters.dateRange);
  const currentItems = useMemo(() => filterByRange(allItems, days, 0), [allItems, days]);
  const previousItems = useMemo(() => filterByRange(allItems, days, days), [allItems, days]);
  const effectivePlatform = effectivePlatformForSource(filters.source);
  const focusedTopics = useMemo(
    () => topicsForFocus(filters),
    [filters],
  );
  const filteredCurrentItems = useMemo(
    () => currentItems.filter((item) => matchesPlatformHealthFilters(item, filters)),
    [currentItems, filters],
  );
  const filteredPreviousItems = useMemo(
    () => previousItems.filter((item) => matchesPlatformHealthFilters(item, filters)),
    [filters, previousItems],
  );
  const scopedItems = useMemo(() => filteredCurrentItems, [filteredCurrentItems]);
  const heatmap = useMemo(() => aggregatePlatformHeatmap(filteredCurrentItems, filters.granularity, 'both'), [filteredCurrentItems, filters.granularity]);
  const visibleTopics = useMemo(
    () => sortPlatformTopics(focusedTopics, heatmap.cells, heatmap.buckets, filters.sortBy, activeBucketIndex),
    [activeBucketIndex, filters.sortBy, focusedTopics, heatmap.buckets, heatmap.cells],
  );
  const androidStats = useMemo(() => platformStats(filteredCurrentItems, filteredPreviousItems, 'android'), [filteredCurrentItems, filteredPreviousItems]);
  const iosStats = useMemo(() => platformStats(filteredCurrentItems, filteredPreviousItems, 'ios'), [filteredCurrentItems, filteredPreviousItems]);
  const risks = useMemo(() => emergingRisks(filteredCurrentItems, filteredPreviousItems), [filteredCurrentItems, filteredPreviousItems]);
  const breakdown = useMemo(() => sourceBreakdown(scopedItems), [scopedItems]);
  const activeBucket = heatmap.buckets[activeBucketIndex] ?? heatmap.buckets[0] ?? '';

  const selected = selectedCell ?? {
    platform: effectivePlatform,
    topicId: visibleTopics[0]?.id ?? platformHealthTopics[0]?.id ?? 'payment-failed',
    timeBucket: activeBucket,
  };
  const selectedTopic = topicById(selected.topicId);
  const selectedItems = selected.timeBucket
    ? filterItemsForCell(filteredCurrentItems, selected.topicId, selected.timeBucket, filters.granularity, 'both')
    : [];
  const selectedCriticalCount = selectedItems.filter((item) => severityFor(item) === 'critical').length;
  const selectedRatings = selectedItems.map((item) => item.rating).filter((rating): rating is 1 | 2 | 3 | 4 | 5 => rating !== undefined);
  const selectedAverageRating = selectedRatings.length
    ? (selectedRatings.reduce((sum, rating) => sum + rating, 0) / selectedRatings.length).toFixed(1)
    : 'n/a';
  const winner = androidStats.score === iosStats.score
    ? 'No clear winner this period'
    : `${androidStats.score > iosStats.score ? 'Android' : 'iOS'} healthier this period`;
  const biggestRisk = risks[0];

  useEffect(() => {
    track('platform_health_source_breakdown_viewed', {
      range: filters.dateRange,
      granularity: filters.granularity,
    });
  }, [filters.dateRange, filters.granularity]);

  useEffect(() => {
    setActiveBucketIndex(Math.max(0, heatmap.buckets.length - 1));
    setSelectedCell(undefined);
    setIsPlaying(false);
  }, [filters, heatmap.buckets.length]);

  useEffect(() => {
    if (!isPlaying || !heatmap.buckets.length) return;
    const timer = window.setInterval(() => {
      setActiveBucketIndex((current) => {
        if (current >= heatmap.buckets.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 950);
    return () => window.clearInterval(timer);
  }, [heatmap.buckets.length, isPlaying]);

  function togglePlay() {
    setIsPlaying((current) => {
      const next = !current;
      if (next && activeBucketIndex >= heatmap.buckets.length - 1) {
        setActiveBucketIndex(0);
      }
      return next;
    });
  }

  function stepTimeline(direction: number) {
    setIsPlaying(false);
    setActiveBucketIndex((current) => Math.max(0, Math.min(current + direction, heatmap.buckets.length - 1)));
  }

  function selectCell(topicId: string, timeBucket: string) {
    const cell = heatmap.cells.find((item) => item.topicId === topicId && item.timeBucket === timeBucket);
    setSelectedCell({ platform: effectivePlatform, topicId, timeBucket });
    track('platform_health_cell_selected', {
      platform: effectivePlatform,
      topicId,
      timeBucket,
      count: cell?.count ?? 0,
      criticalCount: cell?.criticalCount ?? 0,
    });
  }

  function selectTopic(topicId: string) {
    setSelectedCell({ platform: effectivePlatform, topicId, timeBucket: selected.timeBucket });
    track('platform_health_topic_selected', { platform: effectivePlatform, topicId });
  }

  function clickRelease(release: PlatformRelease) {
    track('platform_health_release_marker_clicked', {
      platform: release.platform,
      releaseVersion: release.version,
      releaseDate: release.date,
    });
  }

  return (
    <section className="page-stack platform-health-dashboard">
      <div className="topics-dashboard-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Platform Health</h1>
          <p className="view-description">Android vs iOS health based on support tickets and app reviews.</p>
        </div>
        <FeedbackButton context="platform_health_dashboard" variant="inline" componentLabel="Platform Health dashboard" platform={effectivePlatform} />
      </div>

      <AnalyticsFilterPanel
        value={filters}
        defaultValue={defaultAnalyticsFilters}
        projectOptions={Object.entries(platformProjects).map(([id, name]) => ({ id, name }))}
        topicOptions={platformHealthTopics.map((topic) => ({ id: topic.id, name: topic.name }))}
        helperText="Source controls platform context. Google Play implies Android, App Store implies iOS."
        onChange={(next) => {
          setFilters(next);
          setSelectedCell(undefined);
        }}
      />

      <section className="topics-kpi-grid">
        <SummaryCard label="Health winner" value={winner} detail="Higher score has fewer severe complaints" />
        <SummaryCard label="Android health score" value={androidStats.score} detail={`${formatTrend(androidStats.scoreTrend)} vs previous period`} tone={androidStats.scoreTrend >= 0 ? 'up' : 'down'} />
        <SummaryCard label="iOS health score" value={iosStats.score} detail={`${formatTrend(iosStats.scoreTrend)} vs previous period`} tone={iosStats.scoreTrend >= 0 ? 'up' : 'down'} />
        <SummaryCard
          label="Biggest risk"
          value={biggestRisk ? `${platformLabel(biggestRisk.platform)} ${biggestRisk.topicName}` : 'No risk'}
          detail={biggestRisk ? `${formatTrend(biggestRisk.growth)} · ${biggestRisk.current} current` : 'Not enough data'}
          tone="down"
        />
      </section>

      <section className="platform-comparison-grid">
        <PlatformComparisonCard stats={androidStats} />
        <PlatformComparisonCard stats={iosStats} />
        <div className="platform-source-card">
          <div className="topics-card-header compact">
            <div>
              <h2>Source breakdown</h2>
              <p>Selected period and platform scope.</p>
            </div>
            <FeedbackButton context="platform_source_breakdown" variant="icon" componentLabel="Platform source breakdown" platform={effectivePlatform} />
          </div>
          <SourceBar label="Support" count={breakdown.support} total={scopedItems.length} />
          <SourceBar label="Google Play" count={breakdown.google_play} total={scopedItems.length} />
          <SourceBar label="App Store" count={breakdown.app_store} total={scopedItems.length} />
        </div>
      </section>

      <section className="platform-main-grid">
        <div className="topics-heatmap-card">
          <div className="topics-card-header">
            <div>
              <h2>Platform topics heatmap</h2>
              <p>Issue volume by topic over time. Cells include support tickets and public reviews.</p>
            </div>
            <FeedbackButton context="platform_topics_heatmap" variant="icon" componentLabel="Platform topics heatmap" platform={effectivePlatform} topicId={selected.topicId} timeBucket={selected.timeBucket} />
          </div>

          <div className="platform-playback-row">
            <button type="button" onClick={() => stepTimeline(-1)} disabled={activeBucketIndex <= 0}>Previous</button>
            <button type="button" className="primary-button" onClick={togglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => stepTimeline(1)} disabled={activeBucketIndex >= heatmap.buckets.length - 1}>Next</button>
            <input
              type="range"
              min={0}
              max={Math.max(0, heatmap.buckets.length - 1)}
              value={activeBucketIndex}
              onChange={(event) => {
                setIsPlaying(false);
                setActiveBucketIndex(Number(event.target.value));
              }}
            />
            <span>Current period: {activeBucket ? formatBucketFull(activeBucket, filters.granularity) : 'No period'}</span>
          </div>

          <PlatformHeatmap
            topics={visibleTopics}
            buckets={heatmap.buckets}
            cells={heatmap.cells}
            maxCount={heatmap.maxCount}
            activeBucketIndex={activeBucketIndex}
            granularity={filters.granularity}
            selected={selectedCell}
            onSelect={selectCell}
            onTopicSelect={selectTopic}
          />

          <div className="platform-release-strip">
            <div className="section-title-row">
              <strong>Release markers</strong>
              <FeedbackButton context="platform_release_markers" variant="icon" componentLabel="Platform release markers" platform={effectivePlatform} />
            </div>
            <div className="platform-release-list">
              {releaseMarkers.map((release) => (
                <button key={`${release.platform}-${release.version}`} type="button" onClick={() => clickRelease(release)}>
                  <span>{platformLabel(release.platform)} v{release.version}</span>
                  <em>{formatDate(release.date)}</em>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="topics-detail-card platform-detail-card">
          <div className="topics-card-header compact">
            <div>
              <p className="eyebrow">{platformLabel(selected.platform)}</p>
              <h2>{selectedTopic?.name ?? 'No topic selected'}</h2>
            </div>
            <FeedbackButton context="platform_details_panel" variant="icon" componentLabel="Platform details panel" platform={selected.platform} topicId={selected.topicId} timeBucket={selected.timeBucket} />
          </div>
          <div className="topic-detail-stats">
            <Metric label="Total issues" value={selectedItems.length} />
            <Metric label="Critical" value={selectedCriticalCount} tone={selectedCriticalCount > 0 ? 'down' : 'up'} />
            <Metric label="Avg rating" value={selectedAverageRating} />
            <Metric label="Period" value={selected.timeBucket ? formatBucket(selected.timeBucket, filters.granularity) : 'n/a'} />
          </div>
          <section className="topic-keywords">
            <h3>Related projects</h3>
            <div>
              {selectedTopic?.projectIds.map((projectId) => (
                <span key={projectId}>{platformProjects[projectId]}</span>
              ))}
            </div>
          </section>
          <section className="representative-tickets">
            <h3>Representative tickets and reviews</h3>
            {(selectedItems.length ? selectedItems : scopedItems.filter((item) => item.topicId === selected.topicId).slice(0, 5)).slice(0, 5).map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.subject}</strong>
                  <span>
                    {sourceLabel(item.source)}
                    {item.rating ? ` · ${item.rating} stars` : ` · ${item.priority} · ${item.status}`}
                    {' · '}
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p>{item.description}</p>
              </article>
            ))}
          </section>
        </aside>
      </section>

      <section className="topic-movement-card">
        <div className="topics-card-header compact">
          <div>
            <h2>Emerging risks</h2>
            <p>Fastest-growing platform and topic combinations compared with the previous period.</p>
          </div>
        </div>
        <div className="platform-risk-list">
          {risks.map((risk) => (
            <article key={`${risk.platform}-${risk.topicId}`}>
              <div className="topic-movement-icon down"><AlertTriangle size={16} /></div>
              <div>
                <strong>{platformLabel(risk.platform)} — {risk.topicName}</strong>
                <span>{risk.projectIds.map((projectId) => platformProjects[projectId]).join(', ')}</span>
              </div>
              <em>{formatTrend(risk.growth)}</em>
              <small>{risk.current} current · {risk.previous} previous</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function PlatformHeatmap({
  topics,
  buckets,
  cells,
  maxCount,
  activeBucketIndex,
  granularity,
  selected,
  onSelect,
  onTopicSelect,
}: {
  topics: PlatformHealthTopic[];
  buckets: string[];
  cells: PlatformHeatmapCell[];
  maxCount: number;
  activeBucketIndex: number;
  granularity: PlatformHealthGranularity;
  selected?: SelectedCell;
  onSelect: (topicId: string, timeBucket: string) => void;
  onTopicSelect: (topicId: string) => void;
}) {
  return (
    <div className="platform-heatmap-shell">
      <div className="platform-heatmap" style={{ gridTemplateColumns: `240px repeat(${buckets.length}, minmax(54px, 1fr))` }}>
        <div className="heatmap-corner">Topic</div>
        {buckets.map((bucket, index) => (
          <div key={bucket} className={`heatmap-column-label ${index === activeBucketIndex ? 'active' : ''} ${index > activeBucketIndex ? 'future' : ''}`}>{formatBucket(bucket, granularity)}</div>
        ))}
        {topics.map((topic) => (
          <Fragment key={topic.id}>
            <button type="button" className="heatmap-topic-label refined" onClick={() => onTopicSelect(topic.id)}>
              <strong>{topic.name}</strong>
              <span>{topic.projectIds.map((projectId) => platformProjects[projectId]).join(', ')}</span>
            </button>
            {buckets.map((bucket, index) => {
              const cell = cells.find((item) => item.topicId === topic.id && item.timeBucket === bucket);
              const count = cell?.count ?? 0;
              const selectedClass = selected?.topicId === topic.id && selected.timeBucket === bucket ? 'selected' : '';
              const activeClass = index === activeBucketIndex ? 'active-column' : '';
              const futureClass = index > activeBucketIndex ? 'future' : '';
              return (
                <button
                  key={`${topic.id}-${bucket}`}
                  type="button"
                  className={`heatmap-cell refined ${selectedClass} ${activeClass} ${futureClass}`}
                  style={{ background: platformHeatColor(maxCount ? count / maxCount : 0) }}
                  title={`${topic.name}\n${formatBucket(bucket, granularity)}\nIssues: ${count}\nCritical: ${cell?.criticalCount ?? 0}\nAvg rating: ${cell?.averageRating ?? 'n/a'}\nGrowth: ${formatTrend(cell?.growth ?? 0)}`}
                  onClick={() => onSelect(topic.id, bucket)}
                >
                  <span>{count}</span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PlatformComparisonCard({ stats }: { stats: ReturnType<typeof platformStats> }) {
  return (
    <article className={`platform-comparison-card ${stats.platform}`}>
      <div className="topics-card-header compact">
        <div>
          <p className="eyebrow">{stats.platform === 'android' ? 'Google Play' : 'App Store'}</p>
          <h2>{platformLabel(stats.platform)}</h2>
        </div>
        <FeedbackButton context="platform_comparison_cards" variant="icon" componentLabel={`${platformLabel(stats.platform)} comparison card`} platform={stats.platform} />
      </div>
      <div className="platform-score-row">
        <strong>{stats.score}</strong>
        <span>{formatTrend(stats.scoreTrend)} score trend</span>
      </div>
      <dl className="platform-metric-grid">
        <div><dt>Avg rating</dt><dd>{stats.averageRating || 'n/a'}</dd></div>
        <div><dt>Total reviews</dt><dd>{stats.totalReviews}</dd></div>
        <div><dt>1-2 star reviews</dt><dd>{stats.lowRatingPercent}%</dd></div>
        <div><dt>Support tickets</dt><dd>{stats.supportTickets}</dd></div>
        <div><dt>Critical issues</dt><dd>{stats.criticalIssues}</dd></div>
        <div><dt>Top project</dt><dd>{stats.mostAffectedProject ? platformProjects[stats.mostAffectedProject] : 'n/a'}</dd></div>
      </dl>
      <span className="platform-fast-topic">Fastest growing: {stats.fastestGrowingTopic ? topicById(stats.fastestGrowingTopic)?.name : 'n/a'}</span>
    </article>
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

function SourceBar({ label, count, total }: { label: string; count: number; total: number }) {
  const percent = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="platform-source-row">
      <div><strong>{label}</strong><span>{count} items</span></div>
      <i><b style={{ width: `${percent}%` }} /></i>
      <em>{percent}%</em>
    </div>
  );
}

function sortPlatformTopics(
  topics: PlatformHealthTopic[],
  cells: PlatformHeatmapCell[],
  buckets: string[],
  sortBy: AnalyticsFilterState['sortBy'],
  activeIndex: number,
) {
  const activeBucket = buckets[activeIndex] ?? buckets[buckets.length - 1];
  return [...topics].sort((a, b) => {
    if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
    if (sortBy === 'critical_count') return criticalForTopic(b.id, cells) - criticalForTopic(a.id, cells);
    if (sortBy === 'growth_rate') {
      return growthForTopic(b.id, cells, buckets, activeIndex) - growthForTopic(a.id, cells, buckets, activeIndex);
    }
    return totalForTopic(b.id, cells, activeBucket) - totalForTopic(a.id, cells, activeBucket);
  });
}

function totalForTopic(topicId: string, cells: PlatformHeatmapCell[], activeBucket?: string) {
  return cells
    .filter((cell) => cell.topicId === topicId && (!activeBucket || cell.timeBucket <= activeBucket))
    .reduce((sum, cell) => sum + cell.count, 0);
}

function criticalForTopic(topicId: string, cells: PlatformHeatmapCell[]) {
  return cells
    .filter((cell) => cell.topicId === topicId)
    .reduce((sum, cell) => sum + cell.criticalCount, 0);
}

function growthForTopic(topicId: string, cells: PlatformHeatmapCell[], buckets: string[], activeIndex: number) {
  const current = buckets.slice(Math.max(0, activeIndex - 3), activeIndex + 1)
    .reduce((sum, bucket) => sum + (cells.find((cell) => cell.topicId === topicId && cell.timeBucket === bucket)?.count ?? 0), 0);
  const previous = buckets.slice(Math.max(0, activeIndex - 7), Math.max(0, activeIndex - 3))
    .reduce((sum, bucket) => sum + (cells.find((cell) => cell.topicId === topicId && cell.timeBucket === bucket)?.count ?? 0), 0);
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function filterByRange(items: PlatformHealthItem[], days: number, offsetDays: number) {
  const latest = items.reduce((max, item) => Math.max(max, Date.parse(item.createdAt)), 0);
  const end = latest - offsetDays * 24 * 60 * 60 * 1000;
  const start = end - (days - 1) * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const timestamp = Date.parse(item.createdAt);
    return timestamp >= start && timestamp <= end;
  });
}

function effectivePlatformForSource(source: AnalyticsFilterState['source']): PlatformHealthSelection {
  return getPlatformFromSource(source) ?? 'both';
}

function getPlatformFromSource(source: AnalyticsFilterState['source']) {
  if (source === 'google_play') return 'android';
  if (source === 'app_store') return 'ios';
  return undefined;
}

function matchesPlatformHealthFilters(
  item: PlatformHealthItem,
  filters: AnalyticsFilterState,
) {
  if (filters.source === 'support' && item.source !== 'support') return false;
  if (filters.source === 'reviews' && item.source === 'support') return false;
  if ((filters.source === 'google_play' || filters.source === 'app_store') && item.source !== filters.source) return false;
  const platform = getPlatformFromSource(filters.source);
  if (platform && !matchesPlatform(item, platform)) return false;
  if (filters.severity !== 'all' && severityFor(item) !== filters.severity) return false;
  if (filters.focusMode === 'project' && filters.focusId && !item.projectIds.includes(filters.focusId as PlatformProjectId)) return false;
  if (filters.focusMode === 'topic' && filters.focusId && item.topicId !== filters.focusId) return false;
  return true;
}

function topicsForFocus(filters: AnalyticsFilterState) {
  if (filters.focusMode === 'project' && filters.focusId) {
    return platformHealthTopics.filter((topic) => topic.projectIds.some((projectId) => projectId === filters.focusId));
  }
  if (filters.focusMode === 'topic' && filters.focusId) {
    return platformHealthTopics.filter((topic) => topic.id === filters.focusId);
  }
  return platformHealthTopics;
}

function platformHeatColor(intensity: number) {
  const lightness = 97 - intensity * 38;
  const saturation = 64 - intensity * 12;
  return `hsl(204deg ${saturation}% ${lightness}%)`;
}

function platformLabel(platform: PlatformHealthSelection) {
  if (platform === 'android') return 'Android';
  if (platform === 'ios') return 'iOS';
  return 'Both';
}

function sourceLabel(source: string) {
  if (source === 'google_play') return 'Google Play';
  if (source === 'app_store') return 'App Store';
  return 'Support';
}

function formatBucket(bucket: string, granularity: PlatformHealthGranularity) {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(`${bucket}-01T00:00:00`));
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${bucket}T00:00:00`));
}

function formatBucketFull(bucket: string, granularity: PlatformHealthGranularity) {
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(`${bucket}-01T00:00:00`));
  }
  return `Week of ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${bucket}T00:00:00`))}`;
}

function formatTrend(value: number) {
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function daysForRange(range: AnalyticsFilterState['dateRange']) {
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return 180;
}

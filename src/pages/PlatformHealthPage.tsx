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
  type PlatformHealthSelection,
  type PlatformRelease,
} from '../analytics/platformHealth/domain';
import { generatePlatformHealthItems, platformHealthReleases, type PlatformHealthItem } from '../analytics/platformHealth/mockData';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { formatDate } from '../components/format';

type DateRangeOption = '30' | '90' | '180';
type SelectedCell = {
  platform: PlatformHealthSelection;
  topicId: string;
  timeBucket: string;
};

const ranges: Array<{ value: DateRangeOption; label: string; days: number }> = [
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: '180', label: 'Last 6 months', days: 180 },
];

export function PlatformHealthPage() {
  const [range, setRange] = useState<DateRangeOption>('90');
  const [granularity, setGranularity] = useState<PlatformHealthGranularity>('week');
  const [platform, setPlatform] = useState<PlatformHealthSelection>('both');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | undefined>();

  useEffect(() => {
    track('platform_health_page_opened', {
      defaultRange: '90d',
      defaultGranularity: 'week',
    });
  }, []);

  const allItems = useMemo(() => generatePlatformHealthItems(), []);
  const releaseMarkers = useMemo(() => platformHealthReleases(), []);
  const days = ranges.find((item) => item.value === range)?.days ?? 90;
  const currentItems = useMemo(() => filterByRange(allItems, days, 0), [allItems, days]);
  const previousItems = useMemo(() => filterByRange(allItems, days, days), [allItems, days]);
  const scopedItems = useMemo(() => currentItems.filter((item) => matchesPlatform(item, platform)), [currentItems, platform]);
  const heatmap = useMemo(() => aggregatePlatformHeatmap(currentItems, granularity, platform), [currentItems, granularity, platform]);
  const androidStats = useMemo(() => platformStats(currentItems, previousItems, 'android'), [currentItems, previousItems]);
  const iosStats = useMemo(() => platformStats(currentItems, previousItems, 'ios'), [currentItems, previousItems]);
  const risks = useMemo(() => emergingRisks(currentItems, previousItems), [currentItems, previousItems]);
  const breakdown = useMemo(() => sourceBreakdown(scopedItems), [scopedItems]);

  const selected = selectedCell ?? {
    platform,
    topicId: platformHealthTopics[0]?.id ?? 'payment-failed',
    timeBucket: heatmap.buckets[heatmap.buckets.length - 1] ?? '',
  };
  const selectedTopic = topicById(selected.topicId);
  const selectedItems = selected.timeBucket
    ? filterItemsForCell(currentItems, selected.topicId, selected.timeBucket, granularity, selected.platform)
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
      range: rangeLabelForAnalytics(range),
      granularity,
    });
  }, [granularity, range]);

  function changeRange(next: DateRangeOption) {
    if (next === range) return;
    const previous = range;
    setRange(next);
    setSelectedCell(undefined);
    track('platform_health_range_changed', {
      from: rangeLabelForAnalytics(previous),
      to: rangeLabelForAnalytics(next),
    });
  }

  function changeGranularity(next: PlatformHealthGranularity) {
    if (next === granularity) return;
    const previous = granularity;
    setGranularity(next);
    setSelectedCell(undefined);
    track('platform_health_granularity_changed', { from: previous, to: next });
  }

  function changePlatform(next: PlatformHealthSelection) {
    if (next === platform) return;
    setPlatform(next);
    setSelectedCell(undefined);
    track('platform_health_platform_selected', { platform: next });
  }

  function selectCell(topicId: string, timeBucket: string) {
    const cell = heatmap.cells.find((item) => item.topicId === topicId && item.timeBucket === timeBucket);
    setSelectedCell({ platform, topicId, timeBucket });
    track('platform_health_cell_selected', {
      platform,
      topicId,
      timeBucket,
      count: cell?.count ?? 0,
      criticalCount: cell?.criticalCount ?? 0,
    });
  }

  function selectTopic(topicId: string) {
    setSelectedCell({ platform, topicId, timeBucket: selected.timeBucket });
    track('platform_health_topic_selected', { platform, topicId });
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
        <div className="topics-header-actions">
          <label className="topics-filter-card">
            <span>Date range</span>
            <select value={range} onChange={(event) => changeRange(event.target.value as DateRangeOption)}>
              {ranges.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <div className="segmented-control topics-segmented" aria-label="Platform health granularity">
            {(['week', 'month'] as PlatformHealthGranularity[]).map((item) => (
              <button key={item} type="button" className={granularity === item ? 'active' : ''} onClick={() => changeGranularity(item)}>
                {item === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <FeedbackButton context="platform_health_dashboard" variant="inline" componentLabel="Platform Health dashboard" platform={platform} />
        </div>
      </div>

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
            <FeedbackButton context="platform_source_breakdown" variant="icon" componentLabel="Platform source breakdown" platform={platform} />
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
            <FeedbackButton context="platform_topics_heatmap" variant="icon" componentLabel="Platform topics heatmap" platform={platform} topicId={selected.topicId} timeBucket={selected.timeBucket} />
            <div className="segmented-control topics-segmented" aria-label="Select platform">
              {(['android', 'ios', 'both'] as PlatformHealthSelection[]).map((item) => (
                <button key={item} type="button" className={platform === item ? 'active' : ''} onClick={() => changePlatform(item)}>
                  {platformLabel(item)}
                </button>
              ))}
            </div>
          </div>

          <PlatformHeatmap
            buckets={heatmap.buckets}
            cells={heatmap.cells}
            maxCount={heatmap.maxCount}
            granularity={granularity}
            selected={selectedCell}
            onSelect={selectCell}
            onTopicSelect={selectTopic}
          />

          <div className="platform-release-strip">
            <div className="section-title-row">
              <strong>Release markers</strong>
              <FeedbackButton context="platform_release_markers" variant="icon" componentLabel="Platform release markers" platform={platform} />
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
            <Metric label="Period" value={selected.timeBucket ? formatBucket(selected.timeBucket, granularity) : 'n/a'} />
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
  buckets,
  cells,
  maxCount,
  granularity,
  selected,
  onSelect,
  onTopicSelect,
}: {
  buckets: string[];
  cells: PlatformHeatmapCell[];
  maxCount: number;
  granularity: PlatformHealthGranularity;
  selected?: SelectedCell;
  onSelect: (topicId: string, timeBucket: string) => void;
  onTopicSelect: (topicId: string) => void;
}) {
  return (
    <div className="platform-heatmap-shell">
      <div className="platform-heatmap" style={{ gridTemplateColumns: `240px repeat(${buckets.length}, minmax(54px, 1fr))` }}>
        <div className="heatmap-corner">Topic</div>
        {buckets.map((bucket) => (
          <div key={bucket} className="heatmap-column-label">{formatBucket(bucket, granularity)}</div>
        ))}
        {platformHealthTopics.map((topic) => (
          <Fragment key={topic.id}>
            <button type="button" className="heatmap-topic-label refined" onClick={() => onTopicSelect(topic.id)}>
              <strong>{topic.name}</strong>
              <span>{topic.projectIds.map((projectId) => platformProjects[projectId]).join(', ')}</span>
            </button>
            {buckets.map((bucket) => {
              const cell = cells.find((item) => item.topicId === topic.id && item.timeBucket === bucket);
              const count = cell?.count ?? 0;
              const selectedClass = selected?.topicId === topic.id && selected.timeBucket === bucket ? 'selected' : '';
              return (
                <button
                  key={`${topic.id}-${bucket}`}
                  type="button"
                  className={`heatmap-cell refined ${selectedClass}`}
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

function filterByRange(items: PlatformHealthItem[], days: number, offsetDays: number) {
  const latest = items.reduce((max, item) => Math.max(max, Date.parse(item.createdAt)), 0);
  const end = latest - offsetDays * 24 * 60 * 60 * 1000;
  const start = end - (days - 1) * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const timestamp = Date.parse(item.createdAt);
    return timestamp >= start && timestamp <= end;
  });
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

function formatTrend(value: number) {
  if (value === 0) return '0%';
  return `${value > 0 ? '+' : ''}${value}%`;
}

function rangeLabelForAnalytics(range: DateRangeOption): '30d' | '90d' | '6m' {
  if (range === '30') return '30d';
  if (range === '90') return '90d';
  return '6m';
}

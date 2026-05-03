import {
  platformHealthTopics,
  type PlatformHealthPlatform,
  type PlatformHealthSelection,
  type PlatformHealthSeverity,
  type PlatformProjectId,
} from './domain';
import type { PlatformHealthItem } from './mockData';

export type PlatformHealthGranularity = 'week' | 'month';

export type PlatformHeatmapCell = {
  topicId: string;
  timeBucket: string;
  count: number;
  criticalCount: number;
  averageRating?: number;
  growth: number;
};

export type PlatformStats = {
  platform: PlatformHealthPlatform;
  score: number;
  scoreTrend: number;
  averageRating: number;
  totalReviews: number;
  lowRatingPercent: number;
  supportTickets: number;
  criticalIssues: number;
  fastestGrowingTopic?: string;
  mostAffectedProject?: PlatformProjectId;
};

export function severityFor(item: PlatformHealthItem): PlatformHealthSeverity {
  if ((item.rating && item.rating <= 2) || item.priority === 'urgent' || item.priority === 'high') return 'critical';
  if (item.rating === 3 || item.priority === 'normal') return 'medium';
  return 'low';
}

export function bucketForPlatformHealth(value: string, granularity: PlatformHealthGranularity) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  if (granularity === 'month') {
    date.setDate(1);
    return date.toISOString().slice(0, 7);
  }
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

export function matchesPlatform(item: PlatformHealthItem, platform: PlatformHealthSelection) {
  return platform === 'both' || item.platform === platform;
}

export function aggregatePlatformHeatmap(
  items: PlatformHealthItem[],
  granularity: PlatformHealthGranularity,
  platform: PlatformHealthSelection,
) {
  const scoped = items.filter((item) => matchesPlatform(item, platform));
  const buckets = Array.from(new Set(scoped.map((item) => bucketForPlatformHealth(item.createdAt, granularity)))).sort();
  const cells: PlatformHeatmapCell[] = [];
  let maxCount = 0;

  platformHealthTopics.forEach((topic) => {
    buckets.forEach((bucket, index) => {
      const matches = scoped.filter((item) => item.topicId === topic.id && bucketForPlatformHealth(item.createdAt, granularity) === bucket);
      const previous = index > 0
        ? scoped.filter((item) => item.topicId === topic.id && bucketForPlatformHealth(item.createdAt, granularity) === buckets[index - 1]).length
        : 0;
      const ratings = matches.map((item) => item.rating).filter((rating): rating is NonNullable<typeof rating> => Boolean(rating));
      const count = matches.length;
      maxCount = Math.max(maxCount, count);
      cells.push({
        topicId: topic.id,
        timeBucket: bucket,
        count,
        criticalCount: matches.filter((item) => severityFor(item) === 'critical').length,
        averageRating: ratings.length ? round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length, 1) : undefined,
        growth: growthBetween(count, previous),
      });
    });
  });

  return { buckets, cells, maxCount };
}

export function filterItemsForCell(
  items: PlatformHealthItem[],
  topicId: string,
  timeBucket: string,
  granularity: PlatformHealthGranularity,
  platform: PlatformHealthSelection,
) {
  return items
    .filter((item) => matchesPlatform(item, platform))
    .filter((item) => item.topicId === topicId && bucketForPlatformHealth(item.createdAt, granularity) === timeBucket)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function platformStats(
  currentItems: PlatformHealthItem[],
  previousItems: PlatformHealthItem[],
  platform: PlatformHealthPlatform,
): PlatformStats {
  const current = currentItems.filter((item) => item.platform === platform);
  const previous = previousItems.filter((item) => item.platform === platform);
  const reviews = current.filter((item) => item.rating);
  const lowRatings = reviews.filter((item) => item.rating && item.rating <= 2).length;
  const criticalIssues = current.filter((item) => severityFor(item) === 'critical').length;
  const score = healthScore(current, previous);
  const previousScore = healthScore(previous, []);
  const projectCounts = countBy(current.flatMap((item) => item.projectIds));

  return {
    platform,
    score,
    scoreTrend: score - previousScore,
    averageRating: reviews.length ? round(reviews.reduce((sum, item) => sum + (item.rating ?? 0), 0) / reviews.length, 1) : 0,
    totalReviews: reviews.length,
    lowRatingPercent: reviews.length ? Math.round((lowRatings / reviews.length) * 100) : 0,
    supportTickets: current.filter((item) => item.source === 'support').length,
    criticalIssues,
    fastestGrowingTopic: emergingRisks(currentItems, previousItems, platform)[0]?.topicId,
    mostAffectedProject: Array.from(projectCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
  };
}

export function healthScore(current: PlatformHealthItem[], previous: PlatformHealthItem[]) {
  if (!current.length) return 100;
  const criticalRate = current.filter((item) => severityFor(item) === 'critical').length / current.length;
  const reviews = current.filter((item) => item.rating);
  const lowRatingRate = reviews.length ? reviews.filter((item) => item.rating && item.rating <= 2).length / reviews.length : 0;
  const severeGrowth = growthBetween(
    current.filter((item) => severityFor(item) === 'critical').length,
    previous.filter((item) => severityFor(item) === 'critical').length,
  );
  return Math.max(0, Math.min(100, Math.round(100 - criticalRate * 44 - lowRatingRate * 30 - Math.max(0, severeGrowth) * 0.12)));
}

export function sourceBreakdown(items: PlatformHealthItem[]) {
  return {
    support: items.filter((item) => item.source === 'support').length,
    google_play: items.filter((item) => item.source === 'google_play').length,
    app_store: items.filter((item) => item.source === 'app_store').length,
  };
}

export function emergingRisks(
  currentItems: PlatformHealthItem[],
  previousItems: PlatformHealthItem[],
  platform?: PlatformHealthPlatform,
) {
  const platforms: PlatformHealthPlatform[] = platform ? [platform] : ['android', 'ios'];
  return platforms.flatMap((itemPlatform) =>
    platformHealthTopics.map((topic) => {
      const current = currentItems.filter((item) => item.platform === itemPlatform && item.topicId === topic.id).length;
      const previous = previousItems.filter((item) => item.platform === itemPlatform && item.topicId === topic.id).length;
      return {
        platform: itemPlatform,
        topicId: topic.id,
        topicName: topic.name,
        projectIds: topic.projectIds,
        current,
        previous,
        growth: growthBetween(current, previous),
      };
    }),
  )
    .filter((item) => item.current > 0)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 5);
}

export function growthBetween(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function countBy<T extends string>(values: T[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts as Map<T, number>;
}

function round(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

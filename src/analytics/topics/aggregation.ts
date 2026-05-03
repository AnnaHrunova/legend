import { projects, topics, type Project, type Topic } from './domain';
import { severityFromRating, type AnalyticsTicketSource, type ReviewSeverity } from '../../domain/types';
import type { TopicAnalyticsTicket } from './mockData';

export type TimeGranularity = 'week' | 'month';
export type TopicGroupingMode = 'topic' | 'project' | 'source' | 'severity';
export type HeatmapRowKind = 'topic' | 'project' | 'source' | 'severity';

export type HeatmapRow = {
  id: string;
  name: string;
  kind: HeatmapRowKind;
  source?: AnalyticsTicketSource;
  severity?: ReviewSeverity;
  projectIds: string[];
  topicIds: string[];
  keywords: string[];
};

export type HeatmapCell = {
  rowId: string;
  timeBucket: string;
  count: number;
  topTopics: Array<{
    topicId: string;
    name: string;
    count: number;
  }>;
};

export type TopicAggregation = {
  buckets: string[];
  rows: HeatmapRow[];
  cells: HeatmapCell[];
  maxCount: number;
};

export function aggregateTopics(
  tickets: TopicAnalyticsTicket[],
  granularity: TimeGranularity,
  groupingMode: TopicGroupingMode,
): TopicAggregation {
  const rows = rowsForGrouping(groupingMode);
  const bucketSet = new Set<string>();

  tickets.forEach((ticket) => {
    bucketSet.add(bucketFor(ticket.createdAt, granularity));
  });

  const buckets = Array.from(bucketSet).sort();
  const cells: HeatmapCell[] = [];
  let maxCount = 0;

  rows.forEach((row) => {
    buckets.forEach((timeBucket) => {
      const matchingTickets = tickets.filter((ticket) => matchesRow(ticket, row) && bucketFor(ticket.createdAt, granularity) === timeBucket);
      const topTopics = topicBreakdown(matchingTickets);
      maxCount = Math.max(maxCount, matchingTickets.length);
      cells.push({
        rowId: row.id,
        timeBucket,
        count: matchingTickets.length,
        topTopics,
      });
    });
  });

  return { buckets, rows, cells, maxCount };
}

export function bucketFor(value: string, granularity: TimeGranularity) {
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

export function filterTicketsForRow(
  tickets: TopicAnalyticsTicket[],
  row: HeatmapRow,
  timeBucket: string,
  granularity: TimeGranularity,
) {
  return tickets
    .filter((ticket) => matchesRow(ticket, row) && bucketFor(ticket.createdAt, granularity) === timeBucket)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function getCell(cells: HeatmapCell[], rowId: string, timeBucket: string) {
  return cells.find((cell) => cell.rowId === rowId && cell.timeBucket === timeBucket);
}

export function getCellCount(cells: HeatmapCell[], rowId: string, timeBucket: string) {
  return getCell(cells, rowId, timeBucket)?.count ?? 0;
}

export function growthBetween(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

export function relatedProjects(row: HeatmapRow) {
  return row.projectIds
    .map((projectId) => projects.find((project) => project.id === projectId))
    .filter(Boolean) as Project[];
}

function rowsForGrouping(groupingMode: TopicGroupingMode): HeatmapRow[] {
  if (groupingMode === 'project') return projectRows(projects, topics);
  if (groupingMode === 'source') return sourceRows();
  if (groupingMode === 'severity') return severityRows();
  return topicRows(topics);
}

function topicRows(items: Topic[]): HeatmapRow[] {
  return items.map((topic) => ({
    id: topic.id,
    name: topic.name,
    kind: 'topic',
    projectIds: topic.projectIds,
    topicIds: [topic.id],
    keywords: topic.keywords,
  }));
}

function sourceRows(): HeatmapRow[] {
  return [
    {
      id: 'support',
      name: 'Support tickets',
      kind: 'source',
      source: 'support',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['support', 'agent', 'inbox', 'customer'],
    },
    {
      id: 'google_play',
      name: 'Google Play reviews',
      kind: 'source',
      source: 'google_play',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['reviews', 'rating', 'android', 'google play'],
    },
    {
      id: 'app_store',
      name: 'App Store reviews',
      kind: 'source',
      source: 'app_store',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['reviews', 'rating', 'ios', 'app store'],
    },
  ];
}

function severityRows(): HeatmapRow[] {
  return [
    {
      id: 'critical',
      name: 'Critical reviews',
      kind: 'severity',
      severity: 'critical',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['1 star', '2 star', 'blocked', 'urgent'],
    },
    {
      id: 'medium',
      name: 'Medium reviews',
      kind: 'severity',
      severity: 'medium',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['3 star', 'partial', 'inconsistent'],
    },
    {
      id: 'low',
      name: 'Low severity reviews',
      kind: 'severity',
      severity: 'low',
      projectIds: [],
      topicIds: topics.map((topic) => topic.id),
      keywords: ['4 star', '5 star', 'minor', 'request'],
    },
  ];
}

function projectRows(projectItems: Project[], topicItems: Topic[]): HeatmapRow[] {
  return projectItems.map((project) => {
    const projectTopics = topicItems.filter((topic) => topic.projectIds.includes(project.id));
    return {
      id: project.id,
      name: project.name,
      kind: 'project',
      projectIds: [project.id],
      topicIds: projectTopics.map((topic) => topic.id),
      keywords: Array.from(new Set(projectTopics.flatMap((topic) => topic.keywords))).slice(0, 8),
    };
  });
}

function matchesRow(ticket: TopicAnalyticsTicket, row: HeatmapRow) {
  if (row.kind === 'topic') return ticket.topicId === row.id;
  if (row.kind === 'project') return ticket.projectIds.some((projectId) => projectId === row.id);
  if (row.kind === 'source') return row.source === 'support' ? ticket.source === 'support' : ticket.reviewSource === row.source;
  return severityFromRating(ticket.rating) === row.severity;
}

function topicBreakdown(tickets: TopicAnalyticsTicket[]) {
  const counts = new Map<string, number>();
  tickets.forEach((ticket) => {
    counts.set(ticket.topicId, (counts.get(ticket.topicId) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([topicId, count]) => ({
      topicId,
      name: topics.find((topic) => topic.id === topicId)?.name ?? topicId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

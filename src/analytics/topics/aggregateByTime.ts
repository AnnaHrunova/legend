import type { TopicSummary } from './labelTopics';
import type { TopicTicket } from './generateMockTickets';

export type TimeGranularity = 'day' | 'week';

export type TopicBucket = {
  topicId: number;
  timeBucket: string;
  count: number;
};

export type TicketWithTopic = TopicTicket & {
  topicId: number;
};

export type TopicAggregation = {
  buckets: string[];
  cells: TopicBucket[];
  ticketsWithTopics: TicketWithTopic[];
  maxCount: number;
};

export function aggregateByTime(
  tickets: TopicTicket[],
  assignments: Map<string, number>,
  topics: TopicSummary[],
  granularity: TimeGranularity,
): TopicAggregation {
  const ticketsWithTopics = tickets.map((ticket) => ({
    ...ticket,
    topicId: assignments.get(ticket.id) ?? 0,
  }));
  const bucketSet = new Set<string>();
  const counts = new Map<string, number>();

  ticketsWithTopics.forEach((ticket) => {
    const timeBucket = bucketFor(ticket.createdAt, granularity);
    bucketSet.add(timeBucket);
    const key = `${ticket.topicId}-${timeBucket}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const buckets = Array.from(bucketSet).sort();
  const cells: TopicBucket[] = [];
  let maxCount = 0;

  topics.forEach((topic) => {
    buckets.forEach((timeBucket) => {
      const count = counts.get(`${topic.id}-${timeBucket}`) ?? 0;
      maxCount = Math.max(maxCount, count);
      cells.push({ topicId: topic.id, timeBucket, count });
    });
  });

  return { buckets, cells, ticketsWithTopics, maxCount };
}

export function bucketFor(value: string, granularity: TimeGranularity) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  if (granularity === 'day') {
    return date.toISOString().slice(0, 10);
  }

  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().slice(0, 10);
}

export function filterTicketsForBucket(
  tickets: TicketWithTopic[],
  topicId: number,
  timeBucket: string,
  granularity: TimeGranularity,
) {
  return tickets
    .filter((ticket) => ticket.topicId === topicId && bucketFor(ticket.createdAt, granularity) === timeBucket)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}


import type {
  Priority,
  ReviewRatingRange,
  ReviewSource,
  SlaState,
  Ticket,
  TicketAssigneeFilter,
  TicketColumnKey,
  TicketDateRangeFilter,
  TicketSortOption,
  TicketView,
  TicketViewFilters,
} from './types';
import { severityFromRating } from './types';

const priorityWeight: Record<Priority, number> = {
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

const slaWeight: Record<SlaState, number> = {
  Breached: 4,
  'At risk': 3,
  'Due soon': 2,
  Healthy: 1,
};

export function applyTicketView(
  tickets: Ticket[],
  view: TicketView,
  currentUserId: string,
): Ticket[] {
  return tickets
    .filter((ticket) => matchesTicketView(ticket, view.filters, currentUserId))
    .sort((a, b) => compareTickets(a, b, view.sort));
}

export function compareTickets(a: Ticket, b: Ticket, sort: TicketSortOption): number {
  if (sort === 'oldest') return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (sort === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority];
  if (sort === 'sla') return slaWeight[b.sla.state] - slaWeight[a.sla.state];
  if (sort === 'recently-updated') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function matchesTicketView(
  ticket: Ticket,
  filters: TicketViewFilters,
  currentUserId: string,
): boolean {
  if (filters.statuses?.length && !filters.statuses.includes(ticket.status)) return false;
  if (filters.priorities?.length && !filters.priorities.includes(ticket.priority)) return false;
  if (filters.teams?.length && !filters.teams.includes(ticket.team)) return false;
  if (filters.sources?.length && !filters.sources.some((source) => source === ticket.source || ((source as string) === 'app_store' && ticket.source === 'review'))) return false;
  if (filters.reviewSources?.length && (!ticket.reviewSource || !filters.reviewSources.includes(ticket.reviewSource))) return false;
  if (filters.platforms?.length && (!ticket.platform || !filters.platforms.includes(ticket.platform))) return false;
  if (filters.ratingRanges?.length && !matchesRatingRanges(ticket.rating, filters.ratingRanges)) return false;
  const severity = severityFromRating(ticket.rating);
  if (filters.severities?.length && (!severity || !filters.severities.includes(severity))) return false;
  if (filters.slaStates?.length && !filters.slaStates.includes(ticket.sla.state)) return false;

  if (filters.assignee && !matchesAssignee(ticket, filters.assignee, currentUserId)) return false;

  if (
    filters.tagContains &&
    !ticket.tags.some((tag) => tag.toLowerCase().includes(filters.tagContains!.toLowerCase()))
  ) {
    return false;
  }

  if (
    filters.companyIs &&
    ticket.company.trim().toLowerCase() !== filters.companyIs.trim().toLowerCase()
  ) {
    return false;
  }

  if (!matchesDateRange(ticket.createdAt, filters.createdDateRange)) return false;
  if (!matchesDateRange(ticket.updatedAt, filters.updatedDateRange)) return false;

  return true;
}

export function getViewFilterChips(view: TicketView): string[] {
  const chips: string[] = [];
  const { filters } = view;

  if (filters.statuses?.length) chips.push(`Status: ${filters.statuses.join(', ')}`);
  if (filters.priorities?.length) chips.push(`Priority: ${filters.priorities.join(', ')}`);
  if (filters.teams?.length) chips.push(`Team: ${filters.teams.join(', ')}`);
  if (filters.sources?.length) chips.push(`Source: ${filters.sources.join(', ')}`);
  if (filters.reviewSources?.length) chips.push(`Review source: ${filters.reviewSources.map(reviewSourceLabel).join(', ')}`);
  if (filters.platforms?.length) chips.push(`Platform: ${filters.platforms.join(', ')}`);
  if (filters.ratingRanges?.length) chips.push(`Rating: ${filters.ratingRanges.join(', ')}`);
  if (filters.severities?.length) chips.push(`Severity: ${filters.severities.join(', ')}`);
  if (filters.slaStates?.length) chips.push(`SLA: ${filters.slaStates.join(', ')}`);
  if (filters.tagContains) chips.push(`Tag contains: ${filters.tagContains}`);
  if (filters.companyIs) chips.push(`Company: ${filters.companyIs}`);
  if (filters.assignee) chips.push(`Assignee: ${assigneeLabel(filters.assignee)}`);
  if (filters.createdDateRange) chips.push(`Created: ${dateRangeLabel(filters.createdDateRange)}`);
  if (filters.updatedDateRange) chips.push(`Updated: ${dateRangeLabel(filters.updatedDateRange)}`);

  return chips;
}

function reviewSourceLabel(source: ReviewSource) {
  return source === 'google_play' ? 'Google Play' : 'App Store';
}

function matchesRatingRanges(rating: number | undefined, ranges: ReviewRatingRange[]) {
  if (!rating) return false;
  return ranges.some((range) => {
    if (range === '1-2') return rating <= 2;
    if (range === '3') return rating === 3;
    return rating >= 4;
  });
}

export function searchTickets(tickets: Ticket[], query: string): Ticket[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tickets;

  return tickets.filter((ticket) =>
    [ticket.id, ticket.subject, ticket.customerName, ticket.company, ticket.customerEmail].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    ),
  );
}

export function ensureVisibleColumns(columns: TicketColumnKey[]): TicketColumnKey[] {
  return columns.length ? columns : ['id', 'subject', 'customer', 'priority', 'status', 'updatedAt'];
}

function matchesAssignee(
  ticket: Ticket,
  assignee: TicketAssigneeFilter,
  currentUserId: string,
): boolean {
  if (assignee.mode === 'any') return true;
  if (assignee.mode === 'currentUser') return ticket.assigneeId === currentUserId;
  if (assignee.mode === 'unassigned') return ticket.assigneeId === null;
  return ticket.assigneeId === assignee.agentId;
}

function matchesDateRange(value: string, range?: TicketDateRangeFilter): boolean {
  if (!range) return true;
  const timestamp = Date.parse(value);
  const now = Date.now();
  const from = range.preset === 'last7days' ? now - 7 * 24 * 60 * 60 * 1000 : parseDate(range.from);
  const to = parseDate(range.to, true);

  if (from && timestamp < from) return false;
  if (to && timestamp > to) return false;

  return true;
}

function parseDate(value?: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function assigneeLabel(assignee: TicketAssigneeFilter): string {
  if (assignee.mode === 'any') return 'Any';
  if (assignee.mode === 'currentUser') return 'Current user';
  if (assignee.mode === 'unassigned') return 'Unassigned';
  return assignee.agentId;
}

function dateRangeLabel(range: TicketDateRangeFilter): string {
  if (range.preset === 'last7days') return 'Last 7 days';
  if (range.from && range.to) return `${range.from} to ${range.to}`;
  if (range.from) return `from ${range.from}`;
  if (range.to) return `until ${range.to}`;
  return 'Any';
}

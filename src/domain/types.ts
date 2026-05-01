export type TicketStatus =
  | 'New'
  | 'Open'
  | 'Pending'
  | 'Waiting on customer'
  | 'Escalated'
  | 'Solved'
  | 'Closed';

export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type Team = 'Billing' | 'Technical Support' | 'Compliance' | 'Product Support';

export type SlaState = 'Healthy' | 'Due soon' | 'At risk' | 'Breached';

export type TicketSortOption = 'newest' | 'oldest' | 'priority' | 'sla' | 'recently-updated';

export type TicketColumnKey =
  | 'id'
  | 'subject'
  | 'customer'
  | 'company'
  | 'priority'
  | 'status'
  | 'assignee'
  | 'team'
  | 'tags'
  | 'createdAt'
  | 'updatedAt'
  | 'sla';

export type TicketAssigneeFilter =
  | { mode: 'any' }
  | { mode: 'is'; agentId: string }
  | { mode: 'unassigned' }
  | { mode: 'currentUser' };

export interface TicketDateRangeFilter {
  from?: string;
  to?: string;
  preset?: 'last7days';
}

export interface TicketViewFilters {
  statuses?: TicketStatus[];
  priorities?: Priority[];
  assignee?: TicketAssigneeFilter;
  teams?: Team[];
  tagContains?: string;
  companyIs?: string;
  slaStates?: SlaState[];
  createdDateRange?: TicketDateRangeFilter;
  updatedDateRange?: TicketDateRangeFilter;
}

export type TicketView = {
  id: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  color?: string;
  filters: TicketViewFilters;
  sort: TicketSortOption;
  visibleColumns: TicketColumnKey[];
};

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: 'Agent' | 'Lead' | 'Admin';
  team: Team;
  online: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: 'Starter' | 'Growth' | 'Business' | 'Enterprise';
  lastContactAt: string;
}

export interface TicketMessage {
  id: string;
  kind: 'customer' | 'agent' | 'internal';
  authorName: string;
  authorRole: 'Customer' | 'Agent' | 'System';
  body: string;
  createdAt: string;
}

export interface TicketActivity {
  id: string;
  actorName: string;
  action: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  company: string;
  priority: Priority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeName: string;
  team: Team;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  sla: {
    state: SlaState;
    firstResponseDueAt: string;
    resolutionDueAt: string;
  };
  messages: TicketMessage[];
  activity: TicketActivity[];
}

export interface Macro {
  id: string;
  name: string;
  target: 'reply' | 'note';
  body: string;
}

export interface TicketDraft {
  subject: string;
  customerId: string;
  company: string;
  description: string;
  priority: Priority;
  team: Team;
  tags: string[];
}

export const STATUSES: TicketStatus[] = [
  'New',
  'Open',
  'Pending',
  'Waiting on customer',
  'Escalated',
  'Solved',
  'Closed',
];

export const PRIORITIES: Priority[] = ['Low', 'Normal', 'High', 'Urgent'];

export const TEAMS: Team[] = ['Billing', 'Technical Support', 'Compliance', 'Product Support'];

export const SLA_STATES: SlaState[] = ['Healthy', 'Due soon', 'At risk', 'Breached'];

export const TICKET_COLUMNS: { key: TicketColumnKey; label: string }[] = [
  { key: 'id', label: 'Ticket ID' },
  { key: 'subject', label: 'Subject' },
  { key: 'customer', label: 'Customer' },
  { key: 'company', label: 'Company' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'team', label: 'Team' },
  { key: 'tags', label: 'Tags' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Updated' },
  { key: 'sla', label: 'SLA' },
];

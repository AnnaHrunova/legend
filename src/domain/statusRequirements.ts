import type { KnownIssue, Team, Ticket, TicketStatus } from './types';

export type StatusRequiredFieldKind = 'select' | 'text' | 'date';

export interface StatusRequiredFieldDefinition {
  id: string;
  label: string;
  kind: StatusRequiredFieldKind;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface StatusRequirementDefinition {
  status: TicketStatus;
  title: string;
  fields: StatusRequiredFieldDefinition[];
}

export interface StatusBackendSignal {
  id: string;
  label: string;
  detail: string;
}

export interface StatusAutofillResult {
  values: Record<string, string>;
  aiPrefilledFieldIds: string[];
  backendSignals: StatusBackendSignal[];
}

const TEAM_OPTIONS: Team[] = ['Billing', 'Technical Support', 'Compliance', 'Product Support'];

const PRODUCT_AREAS = [
  'Payments',
  'Mobile app',
  'eSIM',
  'Account/Auth',
  'Documents',
  'Notifications',
  'Savings',
  'Compliance',
  'Support workflow',
];

export const STATUS_REQUIREMENTS: Partial<Record<TicketStatus, StatusRequirementDefinition>> = {
  Pending: {
    status: 'Pending',
    title: 'Pending details',
    fields: [
      {
        id: 'waiting_on',
        label: 'Waiting on',
        kind: 'select',
        required: true,
        options: ['Customer', 'Internal team', 'Product/engineering', 'Vendor/provider'],
      },
      {
        id: 'pending_reason',
        label: 'Pending reason',
        kind: 'select',
        required: true,
        options: ['Need customer confirmation', 'Need internal check', 'Need provider response', 'Need transaction state', 'Need product review'],
      },
      {
        id: 'follow_up_date',
        label: 'Follow-up date',
        kind: 'date',
        required: true,
      },
    ],
  },
  'Waiting on customer': {
    status: 'Waiting on customer',
    title: 'Customer wait details',
    fields: [
      {
        id: 'customer_request',
        label: 'Customer request',
        kind: 'select',
        required: true,
        options: ['Confirm account context', 'Send screenshot', 'Confirm transaction', 'Try suggested step', 'Provide device/app details'],
      },
      {
        id: 'follow_up_date',
        label: 'Follow-up date',
        kind: 'date',
        required: true,
      },
    ],
  },
  Escalated: {
    status: 'Escalated',
    title: 'Escalation details',
    fields: [
      {
        id: 'escalation_reason',
        label: 'Escalation reason',
        kind: 'select',
        required: true,
        options: ['Manual account/payment action', 'Product defect suspected', 'Known issue match', 'Customer requested human', 'Policy/compliance review'],
      },
      {
        id: 'target_team',
        label: 'Target team',
        kind: 'select',
        required: true,
        options: TEAM_OPTIONS,
      },
      {
        id: 'customer_impact',
        label: 'Customer impact',
        kind: 'select',
        required: true,
        options: ['Low', 'Medium', 'High', 'Critical'],
      },
      {
        id: 'evidence_checked',
        label: 'Evidence checked',
        kind: 'select',
        required: true,
        options: ['App context reviewed', 'Transaction checked', 'Known issue checked', 'Duplicate checked', 'Needs investigation'],
      },
    ],
  },
  Solved: {
    status: 'Solved',
    title: 'Resolution details',
    fields: [
      {
        id: 'resolution_outcome',
        label: 'Resolution outcome',
        kind: 'select',
        required: true,
        options: ['Issue explained', 'Workaround provided', 'Refund/credit handled', 'Bug fixed or mitigated', 'Duplicate linked', 'No action needed'],
      },
      {
        id: 'root_cause',
        label: 'Root cause',
        kind: 'select',
        required: true,
        options: ['User education', 'Payment authentication', 'Provider delay', 'Product bug', 'Known issue', 'Account configuration', 'Unclear'],
      },
      {
        id: 'product_area',
        label: 'Product area',
        kind: 'select',
        required: true,
        options: PRODUCT_AREAS,
      },
      {
        id: 'follow_up_needed',
        label: 'Follow-up needed',
        kind: 'select',
        required: true,
        options: ['No', 'Yes - customer', 'Yes - product', 'Yes - provider'],
      },
    ],
  },
  Closed: {
    status: 'Closed',
    title: 'Closure details',
    fields: [
      {
        id: 'closure_reason',
        label: 'Closure reason',
        kind: 'select',
        required: true,
        options: ['Resolved and confirmed', 'No customer response', 'Merged into another ticket', 'Duplicate closed', 'Out of support scope'],
      },
      {
        id: 'final_outcome',
        label: 'Final outcome',
        kind: 'select',
        required: true,
        options: ['Customer issue resolved', 'Customer stopped responding', 'Known issue tracked', 'Transferred to another workflow'],
      },
    ],
  },
};

export function getStatusRequirement(status: TicketStatus) {
  return STATUS_REQUIREMENTS[status];
}

export function buildStatusAutofill(
  status: TicketStatus,
  ticket: Ticket,
  options: { knownIssue?: KnownIssue; duplicateCount?: number } = {},
): StatusAutofillResult {
  const requirement = getStatusRequirement(status);
  if (!requirement) {
    return { values: {}, aiPrefilledFieldIds: [], backendSignals: detectBackendSignals(ticket, options) };
  }

  const text = ticketText(ticket);
  const values: Record<string, string> = {};
  const aiPrefilledFieldIds: string[] = [];

  for (const field of requirement.fields) {
    const value = inferFieldValue(field, status, ticket, text, options.knownIssue);
    if (value) {
      values[field.id] = value;
      aiPrefilledFieldIds.push(field.id);
    }
  }

  return {
    values,
    aiPrefilledFieldIds,
    backendSignals: detectBackendSignals(ticket, options),
  };
}

export function missingRequiredFields(
  requirement: StatusRequirementDefinition,
  values: Record<string, string>,
) {
  return requirement.fields
    .filter((field) => field.required && !values[field.id]?.trim())
    .map((field) => field.id);
}

function inferFieldValue(
  field: StatusRequiredFieldDefinition,
  status: TicketStatus,
  ticket: Ticket,
  text: string,
  knownIssue?: KnownIssue,
) {
  if (field.kind === 'date') return nextBusinessDate();
  if (!field.options?.length) return '';

  switch (field.id) {
    case 'waiting_on':
      return option(field, knownIssue ? 'Product/engineering' : includesAny(text, ['provider', 'esim']) ? 'Vendor/provider' : 'Customer');
    case 'pending_reason':
      if (includesAny(text, ['transaction', 'payment', 'refund'])) return option(field, 'Need transaction state');
      if (knownIssue) return option(field, 'Need product review');
      return option(field, 'Need customer confirmation');
    case 'customer_request':
      if (includesAny(text, ['screenshot', 'screen'])) return option(field, 'Send screenshot');
      if (includesAny(text, ['transaction', 'payment', 'refund', '3ds'])) return option(field, 'Confirm transaction');
      if (ticket.platform || ticket.appVersion || ticket.voiceSession?.appContext.appVersion) return option(field, 'Try suggested step');
      return option(field, 'Provide device/app details');
    case 'escalation_reason':
      if (knownIssue) return option(field, 'Known issue match');
      if (includesAny(text, ['refund', 'payment', 'transaction', 'charge', '3ds'])) return option(field, 'Manual account/payment action');
      if (includesAny(text, ['human', 'agent', 'person'])) return option(field, 'Customer requested human');
      return option(field, 'Product defect suspected');
    case 'target_team':
      return option(field, ticket.team);
    case 'customer_impact':
      if (ticket.priority === 'Urgent' || ticket.rating === 1) return option(field, 'Critical');
      if (ticket.priority === 'High' || ticket.rating === 2) return option(field, 'High');
      return option(field, 'Medium');
    case 'evidence_checked':
      if (knownIssue) return option(field, 'Known issue checked');
      if (includesAny(text, ['transaction', 'payment', 'refund'])) return option(field, 'Transaction checked');
      return option(field, 'App context reviewed');
    case 'resolution_outcome':
      if (knownIssue) return option(field, 'Workaround provided');
      if (includesAny(text, ['refund', 'credit'])) return option(field, 'Refund/credit handled');
      if (includesAny(text, ['duplicate', 'same issue'])) return option(field, 'Duplicate linked');
      return option(field, status === 'Solved' ? 'Issue explained' : '');
    case 'root_cause':
      if (knownIssue) return option(field, 'Known issue');
      if (includesAny(text, ['3ds', 'payment', 'card', 'transaction'])) return option(field, 'Payment authentication');
      if (includesAny(text, ['provider', 'esim'])) return option(field, 'Provider delay');
      if (includesAny(text, ['bug', 'crash', 'broken', 'failed'])) return option(field, 'Product bug');
      return option(field, 'User education');
    case 'product_area':
      return option(field, inferProductArea(ticket, text));
    case 'follow_up_needed':
      if (knownIssue) return option(field, 'Yes - product');
      if (includesAny(text, ['provider', 'esim'])) return option(field, 'Yes - provider');
      return option(field, 'No');
    case 'closure_reason':
      if (includesAny(text, ['duplicate', 'merged'])) return option(field, 'Duplicate closed');
      return option(field, 'Resolved and confirmed');
    case 'final_outcome':
      if (knownIssue) return option(field, 'Known issue tracked');
      return option(field, 'Customer issue resolved');
    default:
      return '';
  }
}

function detectBackendSignals(ticket: Ticket, options: { knownIssue?: KnownIssue; duplicateCount?: number }) {
  const text = ticketText(ticket);
  const signals: StatusBackendSignal[] = [];
  const paymentRelated = includesAny(text, ['payment', 'refund', 'transaction', '3ds', 'card', 'charge']);
  const mobileRelated = ticket.source === 'review' || Boolean(ticket.platform || ticket.voiceSession);

  if (paymentRelated && !includesAny(text, ['stripe', 'adyen', 'visa', 'mastercard', 'apple pay', 'google pay', 'bank transfer'])) {
    signals.push({
      id: 'missing_payment_provider',
      label: 'Payment provider missing',
      detail: 'Capture provider or rail before backend design decisions.',
    });
  }

  if (paymentRelated && !/\b(txn|transaction|payment|charge)[-_:\s]?[a-z0-9]{5,}\b/i.test(text)) {
    signals.push({
      id: 'missing_transaction_reference',
      label: 'Transaction reference missing',
      detail: 'A transaction or charge reference would make payment triage traceable.',
    });
  }

  if (mobileRelated && !ticket.platform && !ticket.voiceSession?.appContext.platform) {
    signals.push({
      id: 'missing_platform',
      label: 'Platform missing',
      detail: 'Capture iOS or Android for mobile support patterns.',
    });
  }

  if (mobileRelated && !ticket.appVersion && !ticket.voiceSession?.appContext.appVersion) {
    signals.push({
      id: 'missing_app_version',
      label: 'App version missing',
      detail: 'Version is needed to connect support behavior to releases.',
    });
  }

  if (options.knownIssue && !ticket.knownIssueIds?.includes(options.knownIssue.id)) {
    signals.push({
      id: 'known_issue_not_linked',
      label: 'Known issue not linked',
      detail: `${options.knownIssue.title} matches this ticket.`,
    });
  }

  if ((options.duplicateCount ?? 0) > 0 && !ticket.relatedTicketIds?.length) {
    signals.push({
      id: 'possible_duplicate_not_linked',
      label: 'Possible duplicate not linked',
      detail: 'Related tickets can explain repeated status changes.',
    });
  }

  return signals;
}

function inferProductArea(ticket: Ticket, text: string) {
  const projectText = ticket.projectIds.join(' ');
  const combined = `${projectText} ${text}`;
  if (includesAny(combined, ['payment', 'billing', 'refund', 'transaction', '3ds'])) return 'Payments';
  if (includesAny(combined, ['mobile', 'ios', 'android', 'app', 'crash'])) return 'Mobile app';
  if (includesAny(combined, ['esim', 'activation'])) return 'eSIM';
  if (includesAny(combined, ['login', 'password', 'account', 'auth'])) return 'Account/Auth';
  if (includesAny(combined, ['document', 'statement', 'pdf', 'export'])) return 'Documents';
  if (includesAny(combined, ['notification', 'push'])) return 'Notifications';
  if (includesAny(combined, ['saving', 'balance'])) return 'Savings';
  if (ticket.team === 'Compliance') return 'Compliance';
  return 'Support workflow';
}

function option(field: StatusRequiredFieldDefinition, value: string) {
  return field.options?.includes(value) ? value : '';
}

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function ticketText(ticket: Ticket) {
  return [
    ticket.subject,
    ticket.description,
    ticket.tags.join(' '),
    ticket.messages.map((message) => message.body).join(' '),
    ticket.voiceSession?.summary,
    ticket.voiceSession?.appContext.currentScreen,
    ticket.voiceSession?.appContext.lastAction,
    ticket.voiceSession?.appContext.recentErrors.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function nextBusinessDate() {
  const date = new Date();
  date.setDate(date.getDate() + (date.getDay() === 5 ? 3 : date.getDay() === 6 ? 2 : 1));
  return date.toISOString().slice(0, 10);
}

import type { Team, TicketStatus } from './types';

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

export function missingRequiredFields(
  requirement: StatusRequirementDefinition,
  values: Record<string, string>,
) {
  return requirement.fields
    .filter((field) => field.required && !values[field.id]?.trim())
    .map((field) => field.id);
}

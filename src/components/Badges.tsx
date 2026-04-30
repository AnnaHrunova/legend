import type { Priority, SlaState, TicketStatus } from '../domain/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge status-${slug(status)}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>;
}

export function SlaBadge({ state }: { state: SlaState }) {
  return <span className={`badge sla-${slug(state)}`}>{state}</span>;
}

function slug(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-');
}

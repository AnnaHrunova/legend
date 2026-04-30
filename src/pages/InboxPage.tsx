import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { track } from '../analytics/analytics';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatShortDate } from '../components/format';
import { agents, currentUser } from '../data/mockUsers';
import { PRIORITIES, STATUSES, TEAMS, type Priority, type TicketStatus } from '../domain/types';
import { useTickets } from '../state/ticketStore';

export type InboxView = 'my' | 'unassigned' | 'urgent' | 'waiting' | 'all' | 'recent';

type SortMode = 'newest' | 'oldest' | 'priority' | 'sla';

const viewTabs: { id: InboxView; label: string }[] = [
  { id: 'my', label: 'My tickets' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'waiting', label: 'Waiting on customer' },
  { id: 'recent', label: 'Recently updated' },
];

const priorityWeight: Record<Priority, number> = {
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

const slaWeight = {
  Breached: 4,
  'At risk': 3,
  'Due soon': 2,
  Healthy: 1,
};

export function InboxPage({ initialView }: { initialView: InboxView }) {
  const [searchParams] = useSearchParams();
  const { tickets, assignToCurrentUser, bulkUpdatePriority, bulkUpdateStatus, bulkAddTag } =
    useTickets();
  const [view, setView] = useState<InboxView>(initialView);
  const [query, setQuery] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<TicketStatus | 'All'>('All');
  const [priority, setPriority] = useState<Priority | 'All'>('All');
  const [assigneeId, setAssigneeId] = useState('All');
  const [team, setTeam] = useState('All');
  const [tag, setTag] = useState('All');
  const [sort, setSort] = useState<SortMode>('newest');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState('');

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    const routeSearch = searchParams.get('search');
    if (routeSearch !== null) {
      setQuery(routeSearch);
      track('search used', { query: routeSearch, source: 'topbar' });
    }
  }, [searchParams]);

  const allTags = useMemo(
    () => Array.from(new Set(tickets.flatMap((ticket) => ticket.tags))).sort(),
    [tickets],
  );

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tickets
      .filter((ticket) => {
        if (view === 'my' && ticket.assigneeId !== currentUser.id) return false;
        if (view === 'unassigned' && ticket.assigneeId !== null) return false;
        if (view === 'urgent' && ticket.priority !== 'Urgent') return false;
        if (view === 'waiting' && ticket.status !== 'Waiting on customer') return false;
        if (status !== 'All' && ticket.status !== status) return false;
        if (priority !== 'All' && ticket.priority !== priority) return false;
        if (assigneeId === 'unassigned' && ticket.assigneeId !== null) return false;
        if (assigneeId !== 'All' && assigneeId !== 'unassigned' && ticket.assigneeId !== assigneeId)
          return false;
        if (team !== 'All' && ticket.team !== team) return false;
        if (tag !== 'All' && !ticket.tags.includes(tag)) return false;
        if (!normalizedQuery) return true;

        return [
          ticket.id,
          ticket.subject,
          ticket.customerName,
          ticket.company,
          ticket.customerEmail,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (view === 'recent') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        if (sort === 'oldest') return Date.parse(a.createdAt) - Date.parse(b.createdAt);
        if (sort === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority];
        if (sort === 'sla') return slaWeight[b.sla.state] - slaWeight[a.sla.state];
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [assigneeId, priority, query, sort, status, tag, team, tickets, view]);

  const selectedVisibleCount = visibleTickets.filter((ticket) => selected.includes(ticket.id)).length;
  const allVisibleSelected = visibleTickets.length > 0 && selectedVisibleCount === visibleTickets.length;

  function toggleAll() {
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleTickets.some((ticket) => ticket.id === id))
        : Array.from(new Set([...current, ...visibleTickets.map((ticket) => ticket.id)])),
    );
  }

  function toggleTicket(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function updateFilter(name: string, setter: (value: string) => void, value: string) {
    setter(value);
    track('filter changed', { name, value });
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Support queue</p>
          <h1>Ticket inbox</h1>
        </div>
        <div className="header-metrics">
          <span>
            <strong>{tickets.length}</strong> total
          </span>
          <span>
            <strong>{tickets.filter((ticket) => ticket.sla.state === 'Breached').length}</strong>{' '}
            SLA breached
          </span>
        </div>
      </div>

      <div className="tabs">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            className={view === tab.id ? 'active' : ''}
            onClick={() => {
              setView(tab.id);
              track('filter changed', { name: 'view', value: tab.id });
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search-field">
          <span>Search</span>
          <input
            value={query}
            onBlur={() => query.trim() && track('search used', { query })}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Subject, customer, company, ticket ID"
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) =>
              updateFilter('status', (value) => setStatus(value as TicketStatus | 'All'), event.target.value)
            }
          >
            <option>All</option>
            {STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Priority</span>
          <select
            value={priority}
            onChange={(event) =>
              updateFilter('priority', (value) => setPriority(value as Priority | 'All'), event.target.value)
            }
          >
            <option>All</option>
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Assignee</span>
          <select
            value={assigneeId}
            onChange={(event) => updateFilter('assignee', setAssigneeId, event.target.value)}
          >
            <option value="All">All</option>
            <option value="unassigned">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Team</span>
          <select value={team} onChange={(event) => updateFilter('team', setTeam, event.target.value)}>
            <option>All</option>
            {TEAMS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Tag</span>
          <select value={tag} onChange={(event) => updateFilter('tag', setTag, event.target.value)}>
            <option>All</option>
            {allTags.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="priority">Priority</option>
            <option value="sla">SLA risk</option>
          </select>
        </label>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} selected</strong>
          <button
            onClick={() => {
              assignToCurrentUser(selected);
              track('bulk action used', { action: 'assign to me', count: selected.length });
            }}
          >
            Assign to me
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              bulkUpdateStatus(selected, event.target.value as TicketStatus);
              track('bulk action used', { action: 'change status', value: event.target.value });
              event.currentTarget.value = '';
            }}
          >
            <option value="">Change status</option>
            {STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              bulkUpdatePriority(selected, event.target.value as Priority);
              track('bulk action used', { action: 'change priority', value: event.target.value });
              event.currentTarget.value = '';
            }}
          >
            <option value="">Change priority</option>
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              bulkAddTag(selected, bulkTag);
              track('bulk action used', { action: 'add tag', tag: bulkTag, count: selected.length });
              setBulkTag('');
            }}
          >
            <input
              value={bulkTag}
              onChange={(event) => setBulkTag(event.target.value)}
              placeholder="Add tag"
            />
            <button type="submit">Apply</button>
          </form>
        </div>
      )}

      <div className="table-card">
        <table className="ticket-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select visible tickets"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                />
              </th>
              <th>Ticket</th>
              <th>Customer</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Team</th>
              <th>Tags</th>
              <th>Created</th>
              <th>Updated</th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {visibleTickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${ticket.id}`}
                    checked={selected.includes(ticket.id)}
                    onChange={() => toggleTicket(ticket.id)}
                  />
                </td>
                <td className="ticket-subject-cell">
                  <Link
                    to={`/tickets/${ticket.id}`}
                    onClick={() => track('ticket opened', { ticketId: ticket.id, source: 'inbox' })}
                  >
                    {ticket.subject}
                  </Link>
                  <span>{ticket.id}</span>
                </td>
                <td>
                  <strong>{ticket.customerName}</strong>
                  <span className="muted-cell">{ticket.company}</span>
                </td>
                <td>
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td>
                  <StatusBadge status={ticket.status} />
                </td>
                <td>{ticket.assigneeName}</td>
                <td>{ticket.team}</td>
                <td className="tag-list compact">
                  {ticket.tags.slice(0, 2).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </td>
                <td>{formatShortDate(ticket.createdAt)}</td>
                <td>{formatDate(ticket.updatedAt)}</td>
                <td>
                  <SlaBadge state={ticket.sla.state} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleTickets.length === 0 && (
          <EmptyState title="No tickets found" body="Adjust filters or search terms to widen the queue." />
        )}
      </div>
    </section>
  );
}

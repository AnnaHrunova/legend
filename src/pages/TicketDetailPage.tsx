import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { track } from '../analytics/analytics';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/Badges';
import { formatDate } from '../components/format';
import { macros } from '../data/mockMacros';
import { agents, currentUser } from '../data/mockUsers';
import { PRIORITIES, STATUSES, TEAMS, type Priority, type Team, type TicketStatus } from '../domain/types';
import { useTickets } from '../state/ticketStore';

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const { getTicket, updateTicket, assignToCurrentUser, addInternalNote, addPublicReply } = useTickets();
  const ticket = ticketId ? getTicket(ticketId) : undefined;
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const activeTicketId = ticket?.id;

  const customerMeta = useMemo(() => {
    if (!ticket) return [];
    return [
      ['Name', ticket.customerName],
      ['Email', ticket.customerEmail],
      ['Company', ticket.company],
      ['Created', formatDate(ticket.createdAt)],
    ];
  }, [ticket]);

  useEffect(() => {
    if (activeTicketId) {
      track('view_opened', { view: 'ticket_detail' });
    }
  }, [activeTicketId]);

  if (!ticket) {
    return <Navigate to="/inbox" replace />;
  }

  const activeTicket = ticket;

  function changeStatus(status: TicketStatus) {
    if (status === activeTicket.status) return;
    updateTicket(activeTicket.id, { status }, `Changed status to ${status}`);
    track('ticket_status_changed', {
      ticketId: activeTicket.id,
      fromStatus: activeTicket.status,
      toStatus: status,
    });
  }

  function changePriority(priority: Priority) {
    if (priority === activeTicket.priority) return;
    updateTicket(activeTicket.id, { priority }, `Changed priority to ${priority}`);
    track('ticket_priority_changed', {
      ticketId: activeTicket.id,
      fromPriority: activeTicket.priority,
      toPriority: priority,
    });
  }

  function changeAssignee(agentId: string) {
    const agent = agents.find((item) => item.id === agentId);
    const toAssignee = agent?.name ?? 'Unassigned';
    if (toAssignee === activeTicket.assigneeName) return;
    updateTicket(
      activeTicket.id,
      {
        assigneeId: agent?.id ?? null,
        assigneeName: agent?.name ?? 'Unassigned',
      },
      agent ? `Assigned to ${agent.name}` : 'Removed assignee',
    );
    track('ticket_assignee_changed', {
      ticketId: activeTicket.id,
      fromAssignee: activeTicket.assigneeName,
      toAssignee,
    });
  }

  function changeTeam(team: Team) {
    updateTicket(activeTicket.id, { team }, `Moved to ${team}`);
  }

  function addTag() {
    const normalized = newTag.trim().toLowerCase();
    if (!normalized || activeTicket.tags.includes(normalized)) return;
    updateTicket(
      activeTicket.id,
      { tags: [...activeTicket.tags, normalized] },
      `Added tag ${normalized}`,
    );
    setNewTag('');
  }

  function removeTag(tag: string) {
    updateTicket(
      activeTicket.id,
      { tags: activeTicket.tags.filter((item) => item !== tag) },
      `Removed tag ${tag}`,
    );
  }

  return (
    <section className="detail-layout">
      <div className="ticket-detail-main">
        <Link className="back-link" to="/inbox">
          Back to inbox
        </Link>

        <div className="ticket-title-block">
          <div>
            <p className="eyebrow">{ticket.id}</p>
            <h1>{ticket.subject}</h1>
          </div>
          <div className="detail-actions">
            <button
              onClick={() => {
                if (ticket.assigneeName === currentUser.name) return;
                assignToCurrentUser([ticket.id]);
                track('ticket_assignee_changed', {
                  ticketId: ticket.id,
                  fromAssignee: ticket.assigneeName,
                  toAssignee: currentUser.name,
                });
              }}
            >
              Assign to me
            </button>
            <button
              className="success-button"
              onClick={() => {
                changeStatus('Solved');
              }}
            >
              Mark solved
            </button>
          </div>
        </div>

        <div className="summary-row">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <SlaBadge state={ticket.sla.state} />
          <span>Updated {formatDate(ticket.updatedAt)}</span>
        </div>

        <section className="conversation-panel">
          <div className="section-header">
            <h2>Conversation</h2>
            <span>{ticket.messages.length} messages</span>
          </div>
          <div className="message-list">
            {ticket.messages.map((message) => (
              <article key={message.id} className={`message message-${message.kind}`}>
                <header>
                  <strong>{message.authorName}</strong>
                  <span>
                    {message.authorRole} · {formatDate(message.createdAt)}
                  </span>
                </header>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="reply-grid">
          <div className="composer">
            <div className="section-header">
              <h2>Public reply</h2>
              <MacroSelector
                target="reply"
                onApply={(body, macroName) => {
                  setReply((current) => `${current}${current ? '\n\n' : ''}${body}`);
                  track('macro_applied', { ticketId: ticket.id, macroName });
                }}
              />
            </div>
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write a customer-facing reply..."
            />
            <button
              className="primary-button"
              disabled={!reply.trim()}
              onClick={() => {
                addPublicReply(ticket.id, reply.trim());
                track('ticket_reply_submitted', { ticketId: ticket.id });
                setReply('');
              }}
            >
              Send reply
            </button>
          </div>

          <div className="composer note-composer">
            <div className="section-header">
              <h2>Internal note</h2>
              <MacroSelector
                target="note"
                onApply={(body, macroName) => {
                  setNote((current) => `${current}${current ? '\n\n' : ''}${body}`);
                  track('macro_applied', { ticketId: ticket.id, macroName });
                }}
              />
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Leave a private note for the team..."
            />
            <button
              disabled={!note.trim()}
              onClick={() => {
                addInternalNote(ticket.id, note.trim());
                track('internal_note_submitted', { ticketId: ticket.id });
                setNote('');
              }}
            >
              Add note
            </button>
          </div>
        </section>
      </div>

      <aside className="ticket-side-panel">
        <section className="side-section">
          <h2>Properties</h2>
          <label>
            <span>Status</span>
            <select value={ticket.status} onChange={(event) => changeStatus(event.target.value as TicketStatus)}>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              value={ticket.priority}
              onChange={(event) => changePriority(event.target.value as Priority)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Assignee</span>
            <select value={ticket.assigneeId ?? ''} onChange={(event) => changeAssignee(event.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Team</span>
            <select value={ticket.team} onChange={(event) => changeTeam(event.target.value as Team)}>
              {TEAMS.map((team) => (
                <option key={team}>{team}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="side-section">
          <h2>Customer</h2>
          <dl className="meta-list">
            {customerMeta.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="side-section">
          <h2>SLA</h2>
          <dl className="meta-list">
            <div>
              <dt>First response</dt>
              <dd>{formatDate(ticket.sla.firstResponseDueAt)}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{formatDate(ticket.sla.resolutionDueAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="side-section">
          <h2>Tags</h2>
          <div className="tag-list">
            {ticket.tags.map((tag) => (
              <button key={tag} onClick={() => removeTag(tag)} title="Remove tag">
                {tag}
              </button>
            ))}
          </div>
          <form
            className="inline-form full"
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="New tag" />
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="side-section">
          <h2>Activity</h2>
          <ol className="timeline">
            {ticket.activity.map((item) => (
              <li key={item.id}>
                <strong>{item.action}</strong>
                <span>
                  {item.actorName} · {formatDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </section>
  );
}

function MacroSelector({
  target,
  onApply,
}: {
  target: 'reply' | 'note';
  onApply: (body: string, macroName: string) => void;
}) {
  return (
    <select
      defaultValue=""
      onChange={(event) => {
        const macro = macros.find((item) => item.id === event.target.value);
        if (!macro) return;
        onApply(macro.body, macro.name);
        event.currentTarget.value = '';
      }}
    >
      <option value="">Apply macro</option>
      {macros
        .filter((macro) => macro.target === target)
        .map((macro) => (
          <option key={macro.id} value={macro.id}>
            {macro.name}
          </option>
        ))}
    </select>
  );
}

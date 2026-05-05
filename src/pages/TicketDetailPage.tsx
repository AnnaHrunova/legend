import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { track } from '../analytics/analytics';
import { getProject, getTopic } from '../analytics/topics/domain';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/Badges';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { formatDate } from '../components/format';
import { knownIssues } from '../data/mockKnownIssues';
import { macros } from '../data/mockMacros';
import { agents, currentUser } from '../data/mockUsers';
import {
  PRIORITIES,
  STATUSES,
  TEAMS,
  severityFromRating,
  type KnownIssue,
  type Macro,
  type Priority,
  type ReviewSource,
  type Team,
  type Ticket,
  type TicketStatus,
} from '../domain/types';
import { useTickets } from '../state/ticketStore';

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { tickets, getTicket, updateTicket, assignToCurrentUser, addInternalNote, addPublicReply } = useTickets();
  const ticket = ticketId ? getTicket(ticketId) : undefined;
  const [reply, setReply] = useState('');
  const [appliedMacro, setAppliedMacro] = useState<AppliedMacroState | undefined>();
  const [duplicateActionMessage, setDuplicateActionMessage] = useState('');
  const [knownIssueMessage, setKnownIssueMessage] = useState('');
  const [knownIssueDetails, setKnownIssueDetails] = useState<KnownIssue | undefined>();
  const [reviewReply, setReviewReply] = useState('');
  const [reviewReplyStarted, setReviewReplyStarted] = useState(false);
  const [reviewReplySent, setReviewReplySent] = useState(false);
  const [note, setNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const activeTicketId = ticket?.id;

  const possibleDuplicates = useMemo(
    () => (ticket ? possibleDuplicateTickets(ticket, tickets).slice(0, 4) : []),
    [ticket, tickets],
  );
  const suggestedKnownIssues = useMemo(
    () => (ticket ? matchingKnownIssues(ticket) : []),
    [ticket],
  );
  const primaryKnownIssue = suggestedKnownIssues[0];

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
      if (ticket?.source === 'review') {
        track('review_opened', {
          ticketId: activeTicketId,
          ...(ticket.rating ? { rating: ticket.rating } : {}),
          ...(ticket.reviewSource ? { reviewSource: ticket.reviewSource } : {}),
          ...(ticket.platform ? { platform: ticket.platform } : {}),
        });
      }
    }
  }, [activeTicketId, ticket?.platform, ticket?.rating, ticket?.reviewSource, ticket?.source]);

  useEffect(() => {
    if (!activeTicketId) return;
    track('duplicates_panel_viewed', {
      ticketId: activeTicketId,
      suggestedCount: possibleDuplicates.length,
    });
  }, [activeTicketId, possibleDuplicates.length]);

  useEffect(() => {
    if (!activeTicketId || !primaryKnownIssue) return;
    track('known_issue_suggested_viewed', {
      ticketId: activeTicketId,
      knownIssueId: primaryKnownIssue.id,
      status: primaryKnownIssue.status,
    });
  }, [activeTicketId, primaryKnownIssue]);

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

  function applyMacro(macro: Macro) {
    setReply((current) => `${current}${current ? '\n\n' : ''}${macro.body}`);
    setAppliedMacro({
      macroId: macro.id,
      macroName: macro.name,
      category: macro.category,
      body: macro.body,
    });
    track('macro_applied', {
      ticketId: activeTicket.id,
      macroId: macro.id,
      macroName: macro.name,
      category: macro.category,
      ...(macro.suggestedStatus ? { suggestedStatus: macro.suggestedStatus } : {}),
      ...(macro.suggestedTags?.length ? { suggestedTags: macro.suggestedTags } : {}),
      ...(macro.suggestedProjectIds?.length ? { suggestedProjectIds: macro.suggestedProjectIds } : {}),
    });
  }

  function applyMacroMetadata(macro: Macro) {
    const nextTags = Array.from(new Set([...activeTicket.tags, ...(macro.suggestedTags ?? [])]));
    const nextProjectIds = Array.from(new Set([...activeTicket.projectIds, ...(macro.suggestedProjectIds ?? [])]));
    updateTicket(
      activeTicket.id,
      {
        ...(macro.suggestedTags?.length ? { tags: nextTags } : {}),
        ...(macro.suggestedStatus ? { status: macro.suggestedStatus } : {}),
        ...(macro.suggestedProjectIds?.length ? { projectIds: nextProjectIds } : {}),
      },
      `Applied macro metadata from ${macro.name}`,
    );
    track('macro_metadata_applied', {
      ticketId: activeTicket.id,
      macroId: macro.id,
      ...(macro.suggestedTags?.length ? { appliedTags: macro.suggestedTags } : {}),
      ...(macro.suggestedStatus ? { appliedStatus: macro.suggestedStatus } : {}),
      ...(macro.suggestedProjectIds?.length ? { appliedProjectIds: macro.suggestedProjectIds } : {}),
    });
  }

  function submitPublicReply() {
    const text = reply.trim();
    if (!text) return;
    addPublicReply(activeTicket.id, text);
    track('ticket_reply_submitted', { ticketId: activeTicket.id });
    if (appliedMacro) {
      track('macro_reply_submitted', {
        ticketId: activeTicket.id,
        macroId: appliedMacro.macroId,
        macroName: appliedMacro.macroName,
        wasEdited: text !== appliedMacro.body,
        changedLengthPercent: changedLengthPercent(appliedMacro.body, text),
      });
    }
    setReply('');
    setAppliedMacro(undefined);
  }

  function openRelatedTicket(relatedTicketId: string, reason: DuplicateReason) {
    track('related_ticket_opened', {
      ticketId: activeTicket.id,
      relatedTicketId,
      reason,
    });
    navigate(`/tickets/${relatedTicketId}`);
  }

  function linkRelatedTicket(relatedTicketId: string, reason: DuplicateReason) {
    const relatedTicketIds = Array.from(new Set([...(activeTicket.relatedTicketIds ?? []), relatedTicketId]));
    updateTicket(activeTicket.id, { relatedTicketIds }, `Linked ${relatedTicketId} as related`);
    setDuplicateActionMessage('Linked as related');
    track('ticket_linked_as_related', {
      ticketId: activeTicket.id,
      relatedTicketId,
      reason,
    });
  }

  function mockMergeTicket(mergedTicketId: string, reason: DuplicateReason) {
    const mergedTicketIds = Array.from(new Set([...(activeTicket.mergedTicketIds ?? []), mergedTicketId]));
    updateTicket(activeTicket.id, { mergedTicketIds }, `Merge simulated with ${mergedTicketId}`);
    setDuplicateActionMessage('Merge simulated');
    track('ticket_merge_mocked', {
      ticketId: activeTicket.id,
      mergedTicketId,
      reason,
    });
  }

  function linkKnownIssue(issue: KnownIssue) {
    const knownIssueIds = Array.from(new Set([...(activeTicket.knownIssueIds ?? []), issue.id]));
    updateTicket(activeTicket.id, { knownIssueIds }, `Linked to known issue: ${issue.title}`);
    setKnownIssueMessage('Ticket linked to known issue');
    track('ticket_linked_to_known_issue', {
      ticketId: activeTicket.id,
      knownIssueId: issue.id,
      status: issue.status,
    });
  }

  function applyKnownIssueReply(issue: KnownIssue) {
    setReply((current) => `${current}${current ? '\n\n' : ''}${issue.suggestedReply}`);
    setKnownIssueMessage('Known issue reply applied');
    track('known_issue_reply_applied', {
      ticketId: activeTicket.id,
      knownIssueId: issue.id,
    });
  }

  function openKnownIssueDetails(issue: KnownIssue) {
    setKnownIssueDetails(issue);
    track('known_issue_details_opened', {
      knownIssueId: issue.id,
      source: 'ticket_detail',
    });
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
            <FeedbackButton
              context="ticket_detail"
              variant="icon"
              ticketId={ticket.id}
              componentLabel="Ticket detail header"
            />
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

        {ticket.source === 'review' && (
          <section className="review-context-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Review context</p>
                <h2>{reviewSourceLabel(ticket.reviewSource)} review</h2>
              </div>
              <FeedbackButton
                context="review_ticket"
                variant="icon"
                ticketId={ticket.id}
                source={ticket.source}
                reviewSource={ticket.reviewSource}
                severity={severityFromRating(ticket.rating)}
                componentLabel="Review ticket"
              />
            </div>
            <dl className="review-meta-grid">
              <div>
                <dt>Review source</dt>
                <dd>{reviewSourceLabel(ticket.reviewSource)}</dd>
              </div>
              <div>
                <dt>Rating</dt>
                <dd>★ {ticket.rating}</dd>
              </div>
              <div>
                <dt>Platform</dt>
                <dd>{ticket.platform === 'ios' ? 'iOS' : 'Android'}</dd>
              </div>
              <div>
                <dt>App version</dt>
                <dd>{ticket.appVersion}</dd>
              </div>
              <div>
                <dt>Severity</dt>
                <dd>{severityFromRating(ticket.rating)}</dd>
              </div>
            </dl>
            <blockquote>{ticket.description}</blockquote>
          </section>
        )}

        <section className="conversation-panel">
          <div className="section-header">
            <h2>Conversation</h2>
            <div className="section-title-row">
              <span>{ticket.messages.length} messages</span>
              <FeedbackButton
                context="ticket_conversation"
                variant="icon"
                ticketId={ticket.id}
                componentLabel="Conversation thread"
              />
            </div>
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
          {ticket.source === 'review' && (
            <div className="composer review-reply-composer">
              <div className="section-header">
                <div className="section-title-row">
                  <h2>Reply to review</h2>
                  <FeedbackButton
                    context="review_reply_box"
                    variant="icon"
                    ticketId={ticket.id}
                    source={ticket.source}
                    reviewSource={ticket.reviewSource}
                    severity={severityFromRating(ticket.rating)}
                    componentLabel="Review reply box"
                  />
                </div>
                {reviewReplySent && <span className="mock-sent-state">Reply sent (mock)</span>}
              </div>
              <textarea
                value={reviewReply}
                onFocus={() => {
                  if (reviewReplyStarted) return;
                  setReviewReplyStarted(true);
                  track('review_reply_started', {
                    ticketId: ticket.id,
                    ...(ticket.reviewSource ? { reviewSource: ticket.reviewSource } : {}),
                  });
                }}
                onChange={(event) => setReviewReply(event.target.value)}
                placeholder="Write a public app store reply..."
              />
              <button
                className="primary-button"
                disabled={!reviewReply.trim()}
                onClick={() => {
                  const text = reviewReply.trim();
                  updateTicket(ticket.id, {}, 'Replied to app store review (mock)');
                  track('review_reply_submitted', {
                    ticketId: ticket.id,
                    ...(ticket.reviewSource ? { reviewSource: ticket.reviewSource } : {}),
                    textLength: text.length,
                  });
                  setReviewReply('');
                  setReviewReplySent(true);
                }}
              >
                Send review reply
              </button>
            </div>
          )}
          <div className="composer">
            <div className="section-header">
              <div className="section-title-row">
                <h2>Public reply</h2>
                <FeedbackButton
                  context="ticket_reply_box"
                  variant="icon"
                  ticketId={ticket.id}
                  componentLabel="Public reply box"
                />
              </div>
            </div>
            <MacroPicker
              ticket={ticket}
              onApply={applyMacro}
              onApplyMetadata={applyMacroMetadata}
            />
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write a customer-facing reply..."
            />
            <button
              className="primary-button"
              disabled={!reply.trim()}
              onClick={submitPublicReply}
            >
              Send reply
            </button>
          </div>

          <div className="composer note-composer">
            <div className="section-header">
              <div className="section-title-row">
                <h2>Internal note</h2>
                <FeedbackButton
                  context="ticket_internal_note_box"
                  variant="icon"
                  ticketId={ticket.id}
                  componentLabel="Internal note box"
                />
              </div>
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
          <div className="field-block">
            <div className="field-label-row">
              <span>Status</span>
              <FeedbackButton
                context="ticket_status_selector"
                variant="icon"
                ticketId={ticket.id}
                componentLabel="Status selector"
              />
            </div>
            <select value={ticket.status} onChange={(event) => changeStatus(event.target.value as TicketStatus)}>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="field-block">
            <div className="field-label-row">
              <span>Priority</span>
              <FeedbackButton
                context="ticket_priority_selector"
                variant="icon"
                ticketId={ticket.id}
                componentLabel="Priority selector"
              />
            </div>
            <select
              value={ticket.priority}
              onChange={(event) => changePriority(event.target.value as Priority)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
          <div className="field-block">
            <div className="field-label-row">
              <span>Assignee</span>
              <FeedbackButton
                context="ticket_assignee_selector"
                variant="icon"
                ticketId={ticket.id}
                componentLabel="Assignee selector"
              />
            </div>
            <select value={ticket.assigneeId ?? ''} onChange={(event) => changeAssignee(event.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
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

        <PossibleDuplicatesPanel
          ticket={ticket}
          suggestions={possibleDuplicates}
          message={duplicateActionMessage}
          onOpen={openRelatedTicket}
          onLink={linkRelatedTicket}
          onMerge={mockMergeTicket}
        />

        <KnownIssuePanel
          ticket={ticket}
          issues={suggestedKnownIssues}
          message={knownIssueMessage}
          onLink={linkKnownIssue}
          onApplyReply={applyKnownIssueReply}
          onOpenDetails={openKnownIssueDetails}
        />

        <section className="side-section">
          <div className="section-title-row">
            <h2>SLA</h2>
            <FeedbackButton context="ticket_sla" variant="icon" ticketId={ticket.id} componentLabel="SLA" />
          </div>
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
          <div className="section-title-row">
            <h2>Tags</h2>
            <FeedbackButton context="ticket_tags" variant="icon" ticketId={ticket.id} componentLabel="Tags" />
          </div>
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
          <div className="section-title-row">
            <h2>Activity</h2>
            <FeedbackButton
              context="ticket_activity_timeline"
              variant="icon"
              ticketId={ticket.id}
              componentLabel="Activity timeline"
            />
          </div>
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
      {knownIssueDetails && (
        <KnownIssueDetailsModal
          issue={knownIssueDetails}
          tickets={tickets}
          onClose={() => setKnownIssueDetails(undefined)}
        />
      )}
    </section>
  );
}

type AppliedMacroState = {
  macroId: string;
  macroName: string;
  category: Macro['category'];
  body: string;
};

type DuplicateReason = 'Same topic' | 'Same project' | 'Same release window' | 'Same review source';

type DuplicateSuggestion = {
  ticket: Ticket;
  reasons: DuplicateReason[];
};

function MacroPicker({
  ticket,
  onApply,
  onApplyMetadata,
}: {
  ticket: Ticket;
  onApply: (macro: Macro) => void;
  onApplyMetadata: (macro: Macro) => void;
}) {
  const [query, setQuery] = useState('');
  const [openedTracked, setOpenedTracked] = useState(false);
  const [lastTrackedSearch, setLastTrackedSearch] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [metadataMessage, setMetadataMessage] = useState('');
  const filteredMacros = macros.filter((macro) =>
    `${macro.name} ${macro.description ?? ''} ${macro.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function trackOpen() {
    if (openedTracked) return;
    setOpenedTracked(true);
    track('macro_picker_opened', {
      ticketId: ticket.id,
      topicId: ticket.topicId,
      projectIds: ticket.projectIds,
    });
  }

  function trackSearch() {
    const normalized = query.trim();
    if (!normalized || normalized === lastTrackedSearch) return;
    setLastTrackedSearch(normalized);
    track('macro_searched', { queryLength: normalized.length });
  }

  function insertTemplate(macro: Macro) {
    onApply(macro);
    setTemplateMessage(`Inserted reply template: ${macro.name}`);
  }

  function applyMetadata(macro: Macro) {
    onApplyMetadata(macro);
    setMetadataMessage(`Applied tags/status from ${macro.name}`);
  }

  return (
    <section className="macro-picker">
      <div className="section-title-row">
        <div>
          <strong>Reply templates</strong>
          <span>Insert a reusable reply, then edit it before sending.</span>
        </div>
        <FeedbackButton
          context="macro_picker"
          variant="icon"
          ticketId={ticket.id}
          topicId={ticket.topicId}
          projectIds={ticket.projectIds}
          componentLabel="Macro picker"
        />
      </div>
      <input
        value={query}
        onFocus={trackOpen}
        onBlur={trackSearch}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search reply templates..."
      />
      {(templateMessage || metadataMessage) && (
        <div className="macro-state-stack">
          {templateMessage && <span className="macro-applied-state">{templateMessage}</span>}
          {metadataMessage && <span className="macro-applied-state secondary">{metadataMessage}</span>}
        </div>
      )}
      <div className="macro-list">
        {filteredMacros.map((macro) => (
          <article key={macro.id} className="macro-item">
            <div className="macro-item-header">
              <div>
                <strong>{macro.name}</strong>
                <span>{macro.description}</span>
              </div>
              <span className="macro-category">{macro.category}</span>
            </div>
            <div className="macro-preview">
              <span>Template preview</span>
              <p>{macro.body}</p>
            </div>
            {hasMacroMetadata(macro) && (
              <div className="macro-suggestions">
                <span>{macroSuggestionText(macro)}</span>
              </div>
            )}
            <div className="macro-actions">
              <button type="button" className="macro-insert-button" onClick={() => insertTemplate(macro)}>
                Use template
              </button>
              {hasMacroMetadata(macro) && (
                <button type="button" onClick={() => applyMetadata(macro)}>Apply suggestions</button>
              )}
            </div>
          </article>
        ))}
        {!filteredMacros.length && <span className="panel-empty-text">No reply templates match this search.</span>}
      </div>
    </section>
  );
}

function PossibleDuplicatesPanel({
  ticket,
  suggestions,
  message,
  onOpen,
  onLink,
  onMerge,
}: {
  ticket: Ticket;
  suggestions: DuplicateSuggestion[];
  message: string;
  onOpen: (relatedTicketId: string, reason: DuplicateReason) => void;
  onLink: (relatedTicketId: string, reason: DuplicateReason) => void;
  onMerge: (mergedTicketId: string, reason: DuplicateReason) => void;
}) {
  return (
    <section className="side-section workflow-panel">
      <div className="section-title-row">
        <h2>Possible duplicates</h2>
        <FeedbackButton
          context="possible_duplicates_panel"
          variant="icon"
          ticketId={ticket.id}
          topicId={ticket.topicId}
          projectIds={ticket.projectIds}
          componentLabel="Possible duplicates panel"
        />
      </div>
      {message && <span className="mock-sent-state">{message}</span>}
      <div className="related-ticket-list">
        {suggestions.map((suggestion) => {
          const related = suggestion.ticket;
          const reason = suggestion.reasons[0];
          return (
            <article key={related.id}>
              <div>
                <strong>{related.subject}</strong>
                <span>{related.status} · {sourceLabel(related)} · {formatDate(related.createdAt)}</span>
                <em>{getTopic(related.topicId)?.name ?? related.topicId} · {suggestion.reasons.join(', ')}</em>
              </div>
              <div className="workflow-actions">
                <button type="button" onClick={() => onOpen(related.id, reason)}>Open</button>
                <button type="button" onClick={() => onLink(related.id, reason)}>Link</button>
                <button type="button" onClick={() => onMerge(related.id, reason)}>Merge mock</button>
              </div>
            </article>
          );
        })}
        {!suggestions.length && <span className="panel-empty-text">No likely duplicates found.</span>}
      </div>
    </section>
  );
}

function KnownIssuePanel({
  ticket,
  issues,
  message,
  onLink,
  onApplyReply,
  onOpenDetails,
}: {
  ticket: Ticket;
  issues: KnownIssue[];
  message: string;
  onLink: (issue: KnownIssue) => void;
  onApplyReply: (issue: KnownIssue) => void;
  onOpenDetails: (issue: KnownIssue) => void;
}) {
  const issue = issues[0];
  return (
    <section className="side-section workflow-panel">
      <div className="section-title-row">
        <h2>Known issue</h2>
        <FeedbackButton
          context="known_issue_panel"
          variant="icon"
          ticketId={ticket.id}
          knownIssueId={issue?.id}
          topicId={ticket.topicId}
          projectIds={ticket.projectIds}
          componentLabel="Known issue panel"
        />
      </div>
      {message && <span className="mock-sent-state">{message}</span>}
      {issue ? (
        <article className="known-issue-card">
          <div>
            <strong>{issue.title}</strong>
            <span>{issue.status} · {issue.projectIds.map(projectName).join(', ')}</span>
          </div>
          <p>{issue.description}</p>
          <small>{affectedLabel(issue)} · {issue.linkedTicketIds.length + (ticket.knownIssueIds?.includes(issue.id) ? 1 : 0)} linked tickets</small>
          <blockquote>{issue.suggestedReply}</blockquote>
          <div className="workflow-actions">
            <button type="button" onClick={() => onLink(issue)}>Link ticket</button>
            <button type="button" onClick={() => onApplyReply(issue)}>Apply reply</button>
            <button type="button" onClick={() => onOpenDetails(issue)}>Details</button>
          </div>
        </article>
      ) : (
        <span className="panel-empty-text">No matching known issue.</span>
      )}
    </section>
  );
}

function KnownIssueDetailsModal({
  issue,
  tickets,
  onClose,
}: {
  issue: KnownIssue;
  tickets: Ticket[];
  onClose: () => void;
}) {
  const representative = tickets
    .filter((ticket) => knownIssueMatchesTicket(issue, ticket) || issue.linkedTicketIds.includes(ticket.id))
    .slice(0, 5);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="known-issue-modal">
        <div className="section-header">
          <div>
            <p className="eyebrow">Known issue</p>
            <h2>{issue.title}</h2>
          </div>
          <FeedbackButton
            context="known_issue_details"
            variant="icon"
            knownIssueId={issue.id}
            projectIds={issue.projectIds}
            componentLabel="Known issue details"
          />
        </div>
        <p>{issue.description}</p>
        <dl className="review-meta-grid">
          <div><dt>Status</dt><dd>{issue.status}</dd></div>
          <div><dt>Projects</dt><dd>{issue.projectIds.map(projectName).join(', ')}</dd></div>
          <div><dt>Topics</dt><dd>{issue.topicIds.map(topicName).join(', ')}</dd></div>
          <div><dt>Updated</dt><dd>{formatDate(issue.updatedAt)}</dd></div>
        </dl>
        <section className="known-issue-reply-preview">
          <h3>Suggested reply</h3>
          <p>{issue.suggestedReply}</p>
        </section>
        <section className="representative-tickets compact">
          <h3>Representative tickets/reviews</h3>
          {representative.map((ticket) => (
            <article key={ticket.id}>
              <div>
                <strong>{ticket.subject}</strong>
                <span>{ticket.id} · {sourceLabel(ticket)} · {formatDate(ticket.createdAt)}</span>
              </div>
              <p>{ticket.description}</p>
            </article>
          ))}
        </section>
        <div className="feedback-actions">
          <button type="button" className="primary-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

function reviewSourceLabel(source?: ReviewSource) {
  return source === 'google_play' ? 'Google Play' : 'App Store';
}

function sourceLabel(ticket: Ticket) {
  if (ticket.source === 'support') return 'Support';
  return reviewSourceLabel(ticket.reviewSource);
}

function projectName(projectId: string) {
  return getProject(projectId)?.name ?? projectId;
}

function topicName(topicId: string) {
  return getTopic(topicId)?.name ?? topicId;
}

function hasMacroMetadata(macro: Macro) {
  return Boolean(macro.suggestedTags?.length || macro.suggestedStatus || macro.suggestedProjectIds?.length);
}

function macroSuggestionText(macro: Macro) {
  const suggestions = [
    ...(macro.suggestedTags?.map((tag) => `tag=${tag}`) ?? []),
    ...(macro.suggestedStatus ? [`status=${macro.suggestedStatus}`] : []),
    ...(macro.suggestedProjectIds?.map((projectId) => `project=${projectName(projectId)}`) ?? []),
  ];

  return `This macro suggests: ${suggestions.join(', ')}`;
}

function changedLengthPercent(originalText: string, submittedText: string) {
  if (!originalText.length) return 0;
  return Math.round((Math.abs(submittedText.length - originalText.length) / originalText.length) * 100);
}

function possibleDuplicateTickets(ticket: Ticket, tickets: Ticket[]): DuplicateSuggestion[] {
  const ticketCreatedAt = Date.parse(ticket.createdAt);
  const nearbyWindowMs = 1000 * 60 * 60 * 24 * 10;

  return tickets
    .filter((candidate) => candidate.id !== ticket.id)
    .map((candidate) => {
      const reasons: DuplicateReason[] = [];

      if (candidate.topicId === ticket.topicId) {
        reasons.push('Same topic');
      }

      if (candidate.projectIds.some((projectId) => ticket.projectIds.includes(projectId))) {
        reasons.push('Same project');
      }

      if (Math.abs(Date.parse(candidate.createdAt) - ticketCreatedAt) <= nearbyWindowMs) {
        reasons.push('Same release window');
      }

      if (
        ticket.source === 'review' &&
        candidate.source === 'review' &&
        ticket.reviewSource &&
        candidate.reviewSource === ticket.reviewSource
      ) {
        reasons.push('Same review source');
      }

      return { ticket: candidate, reasons };
    })
    .filter((suggestion) => suggestion.reasons.includes('Same topic') || suggestion.reasons.length >= 2)
    .sort((left, right) => {
      if (right.reasons.length !== left.reasons.length) {
        return right.reasons.length - left.reasons.length;
      }
      return Date.parse(right.ticket.createdAt) - Date.parse(left.ticket.createdAt);
    });
}

function matchingKnownIssues(ticket: Ticket) {
  return knownIssues
    .filter((issue) => knownIssueMatchesTicket(issue, ticket))
    .sort((left, right) => scoreKnownIssue(right, ticket) - scoreKnownIssue(left, ticket));
}

function knownIssueMatchesTicket(issue: KnownIssue, ticket: Ticket) {
  const ticketSource = ticket.source === 'support' ? 'support' : ticket.reviewSource;
  const topicMatches = issue.topicIds.includes(ticket.topicId);
  const projectMatches = ticket.projectIds.some((projectId) => issue.projectIds.includes(projectId));
  const sourceMatches = !issue.affectedSources?.length || Boolean(ticketSource && issue.affectedSources.includes(ticketSource));
  const platformMatches =
    !issue.affectedPlatforms?.length || Boolean(ticket.platform && issue.affectedPlatforms.includes(ticket.platform));

  return (topicMatches || projectMatches) && sourceMatches && platformMatches;
}

function scoreKnownIssue(issue: KnownIssue, ticket: Ticket) {
  const ticketSource = ticket.source === 'support' ? 'support' : ticket.reviewSource;
  let score = 0;

  if (issue.topicIds.includes(ticket.topicId)) score += 4;
  score += ticket.projectIds.filter((projectId) => issue.projectIds.includes(projectId)).length;
  if (ticketSource && issue.affectedSources?.includes(ticketSource)) score += 2;
  if (ticket.platform && issue.affectedPlatforms?.includes(ticket.platform)) score += 2;

  return score;
}

function affectedLabel(issue: KnownIssue) {
  const sources = issue.affectedSources?.map((source) => (source === 'support' ? 'Support' : reviewSourceLabel(source))) ?? [];
  const platforms =
    issue.affectedPlatforms?.map((platform) => (platform === 'ios' ? 'iOS' : 'Android')) ?? [];
  const labels = [...sources, ...platforms];

  return labels.length ? labels.join(', ') : 'All sources';
}

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { track } from '../analytics/analytics';
import { PriorityBadge, SlaBadge, StatusBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { formatDate, formatShortDate } from '../components/format';
import { defaultTicketColumns } from '../data/mockViews';
import { agents, currentUser } from '../data/mockUsers';
import {
  applyTicketView,
  ensureVisibleColumns,
  getViewFilterChips,
  searchTickets,
} from '../domain/ticketViews';
import {
  PRIORITIES,
  REVIEW_PLATFORMS,
  REVIEW_RATING_RANGES,
  REVIEW_SEVERITIES,
  REVIEW_SOURCES,
  SLA_STATES,
  STATUSES,
  TEAMS,
  TICKET_COLUMNS,
  type Priority,
  type ReviewPlatform,
  type ReviewRatingRange,
  type ReviewSeverity,
  type ReviewSource,
  type SlaState,
  type Team,
  type Ticket,
  type TicketAssigneeFilter,
  type TicketColumnKey,
  type TicketSource,
  type TicketSortOption,
  type TicketStatus,
  type TicketView,
  type TicketViewFilters,
} from '../domain/types';
import { useTickets } from '../state/ticketStore';
import { useTicketViews } from '../state/viewStore';

const sortLabels: Record<TicketSortOption, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  priority: 'Priority',
  sla: 'SLA risk',
  'recently-updated': 'Recently updated',
};

const viewColors = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Red', value: '#b42318' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Green', value: '#15803d' },
];

interface ViewFormState {
  name: string;
  description: string;
  color: string;
  statuses: TicketStatus[];
  priorities: Priority[];
  assigneeMode: TicketAssigneeFilter['mode'];
  assigneeId: string;
  teams: Team[];
  tagContains: string;
  companyIs: string;
  slaStates: SlaState[];
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  updatedLast7Days: boolean;
  sort: TicketSortOption;
  visibleColumns: TicketColumnKey[];
}

export function InboxPage() {
  const { viewId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tickets, assignToCurrentUser, bulkUpdatePriority, bulkUpdateStatus, bulkAddTag } =
    useTickets();
  const { getView, createView, updateView, duplicateView, deleteView } = useTicketViews();
  const [query, setQuery] = useState(searchParams.get('search') ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState('');
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | TicketSource>('all');
  const [reviewSourceFilter, setReviewSourceFilter] = useState<'all' | ReviewSource>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | ReviewPlatform>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | ReviewRatingRange>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | ReviewSeverity>('all');

  const view = viewId ? getView(viewId) : undefined;

  useEffect(() => {
    const routeSearch = searchParams.get('search');
    if (routeSearch !== null) {
      setQuery(routeSearch);
      track('search_used', { queryLength: routeSearch.length });
    }
    if (searchParams.get('createView') === '1') {
      setEditorMode('create');
    }
  }, [searchParams]);

  useEffect(() => {
    if (view) {
      setSelected([]);
      track('view_opened', { view: 'inbox' });
    }
  }, [view]);

  const visibleTickets = useMemo(() => {
    if (!view) return [];
    return searchTickets(applyTicketView(tickets, view, currentUser.id), query).filter((ticket) =>
      matchesInboxFilters(ticket, {
        source: sourceFilter,
        reviewSource: reviewSourceFilter,
        platform: platformFilter,
        ratingRange: ratingFilter,
        severity: severityFilter,
      }),
    );
  }, [platformFilter, query, ratingFilter, reviewSourceFilter, severityFilter, sourceFilter, tickets, view]);

  const columns = ensureVisibleColumns(view?.visibleColumns ?? defaultTicketColumns);
  const chips = view ? getViewFilterChips(view) : [];
  const selectedVisibleCount = visibleTickets.filter((ticket) => selected.includes(ticket.id)).length;
  const allVisibleSelected = visibleTickets.length > 0 && selectedVisibleCount === visibleTickets.length;

  if (!view) {
    return <Navigate to="/views/my-tickets" replace />;
  }

  const activeView = view;

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

  function duplicateCurrentView() {
    const duplicated = duplicateView(activeView.id);
    if (!duplicated) return;
    navigate(`/views/${duplicated.id}`);
  }

  function deleteCurrentView() {
    if (activeView.type !== 'custom') return;
    deleteView(activeView.id);
    navigate('/views/my-tickets');
  }

  function updateCustomSort(sort: TicketSortOption) {
    if (activeView.type !== 'custom') return;
    updateView(activeView.id, {
      name: activeView.name,
      description: activeView.description,
      color: activeView.color,
      filters: activeView.filters,
      sort,
      visibleColumns: activeView.visibleColumns,
    });
  }

  function trackSearchUsed() {
    const queryLength = query.trim().length;
    if (queryLength > 0) {
      track('search_used', { queryLength });
    }
  }

  function updateTicketFilter<Key extends keyof InboxFilters>(key: Key, value: InboxFilters[Key]) {
    const next = {
      source: sourceFilter,
      reviewSource: reviewSourceFilter,
      platform: platformFilter,
      ratingRange: ratingFilter,
      severity: severityFilter,
      [key]: value,
    };

    if (key === 'source') setSourceFilter(value as typeof sourceFilter);
    if (key === 'reviewSource') setReviewSourceFilter(value as typeof reviewSourceFilter);
    if (key === 'platform') setPlatformFilter(value as typeof platformFilter);
    if (key === 'ratingRange') setRatingFilter(value as typeof ratingFilter);
    if (key === 'severity') setSeverityFilter(value as typeof severityFilter);

    track('tickets_filter_changed', filterPayload(next));
  }

  return (
    <section className="page-stack">
      <div className="page-header view-page-header">
        <div>
          <p className="eyebrow">Ticket view</p>
          <h1>{view.name}</h1>
          {view.description && <p className="view-description">{view.description}</p>}
        </div>
        <div className="view-actions">
          <FeedbackButton
            context="ticket_filters"
            variant="icon"
            viewId={view.id}
            componentLabel="Saved view filters"
          />
          <button className="primary-button" onClick={() => setEditorMode('create')}>
            Create view
          </button>
          <button onClick={duplicateCurrentView}>Duplicate view</button>
          {view.type === 'custom' && <button onClick={() => setEditorMode('edit')}>Edit view</button>}
          {view.type === 'custom' && (
            <button className="danger-button" onClick={deleteCurrentView}>
              Delete view
            </button>
          )}
        </div>
      </div>

      <div className="view-meta-row">
        <div className="filter-chip-list">
          {chips.length ? chips.map((chip) => <span key={chip}>{chip}</span>) : <span>No saved filters</span>}
        </div>
        <label className="compact-label">
          <span>View sort</span>
          <select
            value={view.sort}
            disabled={view.type !== 'custom'}
            onChange={(event) => updateCustomSort(event.target.value as TicketSortOption)}
          >
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="toolbar view-toolbar">
        <div className="field-block">
          <div className="field-label-row">
            <span>Search within view</span>
            <FeedbackButton
              context="ticket_search"
              variant="icon"
              viewId={view.id}
              componentLabel="Ticket search"
            />
          </div>
          <input
            value={query}
            onBlur={trackSearchUsed}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              setSearchParams(nextQuery ? { search: nextQuery } : {});
            }}
            placeholder="Subject, customer, company, ticket ID"
          />
        </div>
        <div className="header-metrics">
          <span>
            <strong>{visibleTickets.length}</strong> in view
          </span>
          <span>
            <strong>{tickets.length}</strong> total tickets
          </span>
        </div>
      </div>

      <div className="review-filter-row">
        <label className="compact-label">
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(event) => updateTicketFilter('source', event.target.value as InboxFilters['source'])}
          >
            <option value="all">All sources</option>
            <option value="support">Support</option>
            <option value="review">Reviews</option>
          </select>
        </label>
        <label className="compact-label">
          <span>Review source</span>
          <select
            value={reviewSourceFilter}
            onChange={(event) => updateTicketFilter('reviewSource', event.target.value as InboxFilters['reviewSource'])}
          >
            <option value="all">All review sources</option>
            {REVIEW_SOURCES.map((source) => (
              <option key={source} value={source}>
                {reviewSourceLabel(source)}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-label">
          <span>Platform</span>
          <select
            value={platformFilter}
            onChange={(event) => updateTicketFilter('platform', event.target.value as InboxFilters['platform'])}
          >
            <option value="all">All platforms</option>
            {REVIEW_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform === 'ios' ? 'iOS' : 'Android'}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-label">
          <span>Rating</span>
          <select
            value={ratingFilter}
            onChange={(event) => updateTicketFilter('ratingRange', event.target.value as InboxFilters['ratingRange'])}
          >
            <option value="all">All ratings</option>
            {REVIEW_RATING_RANGES.map((range) => (
              <option key={range} value={range}>
                {ratingRangeLabel(range)}
              </option>
            ))}
          </select>
        </label>
        <label className="compact-label">
          <span>Severity</span>
          <select
            value={severityFilter}
            onChange={(event) => updateTicketFilter('severity', event.target.value as InboxFilters['severity'])}
          >
            <option value="all">All severities</option>
            {REVIEW_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {titleCase(severity)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong>{selected.length} selected</strong>
          <FeedbackButton
            context="ticket_bulk_actions"
            variant="icon"
            viewId={view.id}
            componentLabel="Bulk actions"
          />
          <button
            onClick={() => {
              assignToCurrentUser(selected);
              track('bulk_action_completed', { action: 'assign', count: selected.length });
            }}
          >
            Assign to me
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              bulkUpdateStatus(selected, event.target.value as TicketStatus);
              track('bulk_action_completed', { action: 'status_change', count: selected.length });
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
              track('bulk_action_completed', { action: 'priority_change', count: selected.length });
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
              track('bulk_action_completed', { action: 'tag_add', count: selected.length });
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
        <div className="table-card-header">
          <strong>Tickets</strong>
          <FeedbackButton
            context="ticket_list"
            variant="icon"
            viewId={view.id}
            componentLabel="Ticket list"
          />
        </div>
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
              {columns.map((column) => (
                <th key={column}>{TICKET_COLUMNS.find((item) => item.key === column)?.label}</th>
              ))}
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
                {columns.map((column) => (
                  <td key={`${ticket.id}-${column}`} className={column === 'subject' ? 'ticket-subject-cell' : ''}>
                    <TicketCell ticket={ticket} column={column} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleTickets.length === 0 && (
          <EmptyState title="No tickets found" body="Adjust the view or search terms to widen the queue." />
        )}
      </div>

      {editorMode && (
        <ViewEditor
          mode={editorMode}
          baseView={view}
          viewId={view.id}
          onClose={() => {
            setEditorMode(null);
            if (searchParams.get('createView')) setSearchParams({});
          }}
          onCreate={(draft) => {
            const created = createView(draft);
            navigate(`/views/${created.id}`);
          }}
          onUpdate={(draft, changeFlags) => {
            updateView(view.id, draft);
            if (changeFlags.filters) {
              track('filter_applied', { view: draft.name, filters: filtersToAnalytics(draft.filters) });
            }
          }}
        />
      )}
    </section>
  );
}

function TicketCell({ ticket, column }: { ticket: Ticket; column: TicketColumnKey }) {
  if (column === 'id') return <span className="muted-cell">{ticket.id}</span>;
  if (column === 'subject') {
    return (
      <>
        <Link
          to={`/tickets/${ticket.id}`}
          onClick={() => track('ticket_opened', { ticketId: ticket.id, source: 'view' })}
        >
          {ticket.subject}
        </Link>
        <span>{ticket.id}</span>
        {ticket.source === 'review' && <ReviewBadge ticket={ticket} />}
      </>
    );
  }
  if (column === 'customer') return <strong>{ticket.customerName}</strong>;
  if (column === 'company') return <span>{ticket.company}</span>;
  if (column === 'priority') return <PriorityBadge priority={ticket.priority} />;
  if (column === 'status') return <StatusBadge status={ticket.status} />;
  if (column === 'assignee') return <span>{ticket.assigneeName}</span>;
  if (column === 'team') return <span>{ticket.team}</span>;
  if (column === 'createdAt') return <span>{formatShortDate(ticket.createdAt)}</span>;
  if (column === 'updatedAt') return <span>{formatDate(ticket.updatedAt)}</span>;
  if (column === 'sla') return <SlaBadge state={ticket.sla.state} />;
  return (
    <div className="tag-list compact">
      {ticket.tags.slice(0, 2).map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

type InboxFilters = {
  source: 'all' | TicketSource;
  reviewSource: 'all' | ReviewSource;
  platform: 'all' | ReviewPlatform;
  ratingRange: 'all' | ReviewRatingRange;
  severity: 'all' | ReviewSeverity;
};

function matchesInboxFilters(ticket: Ticket, filters: InboxFilters) {
  if (filters.source !== 'all' && ticket.source !== filters.source) return false;
  if (filters.reviewSource !== 'all' && ticket.reviewSource !== filters.reviewSource) return false;
  if (filters.platform !== 'all' && ticket.platform !== filters.platform) return false;
  if (filters.ratingRange !== 'all' && !matchesRating(ticket.rating, filters.ratingRange)) return false;
  if (filters.severity !== 'all' && reviewSeverity(ticket) !== filters.severity) return false;
  return true;
}

function filterPayload(filters: InboxFilters) {
  return {
    ...(filters.source !== 'all' ? { source: filters.source } : {}),
    ...(filters.reviewSource !== 'all' ? { reviewSource: filters.reviewSource } : {}),
    ...(filters.platform !== 'all' ? { platform: filters.platform } : {}),
    ...(filters.ratingRange !== 'all' ? { ratingRange: filters.ratingRange } : {}),
    ...(filters.severity !== 'all' ? { severity: filters.severity } : {}),
  };
}

function matchesRating(rating: number | undefined, range: ReviewRatingRange) {
  if (!rating) return false;
  if (range === '1-2') return rating <= 2;
  if (range === '3') return rating === 3;
  return rating >= 4;
}

function reviewSeverity(ticket: Ticket): ReviewSeverity | undefined {
  if (!ticket.rating) return undefined;
  if (ticket.rating <= 2) return 'critical';
  if (ticket.rating === 3) return 'medium';
  return 'low';
}

function ReviewBadge({ ticket }: { ticket: Ticket }) {
  return (
    <span className="review-badge">
      <strong>★ {ticket.rating}</strong>
      {reviewSourceLabel(ticket.reviewSource)} · {ticket.platform === 'ios' ? 'iOS' : 'Android'}
    </span>
  );
}

function reviewSourceLabel(source?: ReviewSource) {
  return source === 'google_play' ? 'Google Play' : 'App Store';
}

function ratingRangeLabel(range: ReviewRatingRange) {
  if (range === '1-2') return '1-2 stars';
  if (range === '3') return '3 stars';
  return '4-5 stars';
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ViewEditor({
  mode,
  baseView,
  viewId,
  onClose,
  onCreate,
  onUpdate,
}: {
  mode: 'create' | 'edit';
  baseView: TicketView;
  viewId: string;
  onClose: () => void;
  onCreate: (view: Omit<TicketView, 'id' | 'type'>) => void;
  onUpdate: (
    view: Omit<TicketView, 'id' | 'type'>,
    changeFlags: { filters: boolean; sort: boolean; columns: boolean },
  ) => void;
}) {
  const initial = toFormState(baseView, mode);
  const [form, setForm] = useState<ViewFormState>(initial);

  function update<Key extends keyof ViewFormState>(key: Key, value: ViewFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleColumn(column: TicketColumnKey) {
    setForm((current) => {
      const visibleColumns = current.visibleColumns.includes(column)
        ? current.visibleColumns.filter((item) => item !== column)
        : [...current.visibleColumns, column];

      return { ...current, visibleColumns };
    });
  }

  function submit() {
    const draft = toTicketViewDraft(form);
    const changeFlags = {
      filters: JSON.stringify(draft.filters) !== JSON.stringify(baseView.filters),
      sort: draft.sort !== baseView.sort,
      columns: JSON.stringify(draft.visibleColumns) !== JSON.stringify(baseView.visibleColumns),
    };

    if (mode === 'create') {
      onCreate(draft);
    } else {
      onUpdate(draft, changeFlags);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="view-editor">
        <div className="section-header">
          <div>
            <p className="eyebrow">{mode === 'create' ? 'New view' : 'Custom view'}</p>
            <h2>{mode === 'create' ? 'Create view' : 'Edit view'}</h2>
          </div>
          <div className="section-title-row">
            <FeedbackButton
              context="view_builder"
              variant="icon"
              viewId={viewId}
              componentLabel="View builder"
            />
            <button onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="view-editor-grid">
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(event) => update('name', event.target.value)} />
          </label>
          <label>
            <span>Description</span>
            <input
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </label>
          <div className="color-picker-field">
            <span>Color</span>
            <div className="color-swatch-grid" role="radiogroup" aria-label="View color">
              {viewColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={form.color === color.value ? 'selected' : ''}
                  onClick={() => update('color', color.value)}
                  role="radio"
                  aria-checked={form.color === color.value}
                  title={color.name}
                >
                  <span style={{ background: color.value }} />
                  <em>{color.name}</em>
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Sort</span>
            <select
              value={form.sort}
              onChange={(event) => update('sort', event.target.value as TicketSortOption)}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="view-editor-grid">
          <MultiSelect
            label="Statuses"
            values={form.statuses}
            options={STATUSES}
            onChange={(values) => update('statuses', values as TicketStatus[])}
          />
          <MultiSelect
            label="Priorities"
            values={form.priorities}
            options={PRIORITIES}
            onChange={(values) => update('priorities', values as Priority[])}
          />
          <MultiSelect
            label="Teams"
            values={form.teams}
            options={TEAMS}
            onChange={(values) => update('teams', values as Team[])}
          />
          <MultiSelect
            label="SLA status"
            values={form.slaStates}
            options={SLA_STATES}
            onChange={(values) => update('slaStates', values as SlaState[])}
          />
        </div>

        <div className="view-editor-grid">
          <label>
            <span>Assignee</span>
            <select
              value={form.assigneeMode}
              onChange={(event) => update('assigneeMode', event.target.value as TicketAssigneeFilter['mode'])}
            >
              <option value="any">Any</option>
              <option value="currentUser">Current user</option>
              <option value="unassigned">Unassigned</option>
              <option value="is">Specific agent</option>
            </select>
          </label>
          {form.assigneeMode === 'is' && (
            <label>
              <span>Agent</span>
              <select value={form.assigneeId} onChange={(event) => update('assigneeId', event.target.value)}>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Tag contains</span>
            <input value={form.tagContains} onChange={(event) => update('tagContains', event.target.value)} />
          </label>
          <label>
            <span>Company is</span>
            <input value={form.companyIs} onChange={(event) => update('companyIs', event.target.value)} />
          </label>
        </div>

        <div className="view-editor-grid">
          <label>
            <span>Created from</span>
            <input
              type="date"
              value={form.createdFrom}
              onChange={(event) => update('createdFrom', event.target.value)}
            />
          </label>
          <label>
            <span>Created to</span>
            <input
              type="date"
              value={form.createdTo}
              onChange={(event) => update('createdTo', event.target.value)}
            />
          </label>
          <label>
            <span>Updated from</span>
            <input
              type="date"
              value={form.updatedFrom}
              onChange={(event) => update('updatedFrom', event.target.value)}
              disabled={form.updatedLast7Days}
            />
          </label>
          <label>
            <span>Updated to</span>
            <input
              type="date"
              value={form.updatedTo}
              onChange={(event) => update('updatedTo', event.target.value)}
              disabled={form.updatedLast7Days}
            />
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.updatedLast7Days}
            onChange={(event) => update('updatedLast7Days', event.target.checked)}
          />
          <span>Updated during the last 7 days</span>
        </label>

        <div className="column-picker">
          <span>Visible columns</span>
          <div>
            {TICKET_COLUMNS.map((column) => (
              <label key={column.key} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.visibleColumns.includes(column.key)}
                  onChange={() => toggleColumn(column.key)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={submit} disabled={!form.name.trim()}>
            {mode === 'create' ? 'Create view' : 'Save view'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MultiSelect<T extends string>({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: T[];
  options: readonly T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        multiple
        value={values}
        onChange={(event) =>
          onChange(Array.from(event.target.selectedOptions).map((option) => option.value as T))
        }
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function toFormState(view: TicketView, mode: 'create' | 'edit'): ViewFormState {
  const assignee = view.filters.assignee ?? { mode: 'any' };

  return {
    name: mode === 'create' ? `${view.name} custom` : view.name,
    description: view.description ?? '',
    color: view.color ?? viewColors[0].value,
    statuses: view.filters.statuses ?? [],
    priorities: view.filters.priorities ?? [],
    assigneeMode: assignee.mode,
    assigneeId: assignee.mode === 'is' ? assignee.agentId : agents[0].id,
    teams: view.filters.teams ?? [],
    tagContains: view.filters.tagContains ?? '',
    companyIs: view.filters.companyIs ?? '',
    slaStates: view.filters.slaStates ?? [],
    createdFrom: view.filters.createdDateRange?.from ?? '',
    createdTo: view.filters.createdDateRange?.to ?? '',
    updatedFrom: view.filters.updatedDateRange?.from ?? '',
    updatedTo: view.filters.updatedDateRange?.to ?? '',
    updatedLast7Days: view.filters.updatedDateRange?.preset === 'last7days',
    sort: view.sort,
    visibleColumns: ensureVisibleColumns(view.visibleColumns),
  };
}

function toTicketViewDraft(form: ViewFormState): Omit<TicketView, 'id' | 'type'> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    color: form.color,
    filters: toFilters(form),
    sort: form.sort,
    visibleColumns: ensureVisibleColumns(form.visibleColumns),
  };
}

function toFilters(form: ViewFormState): TicketViewFilters {
  const filters: TicketViewFilters = {};

  if (form.statuses.length) filters.statuses = form.statuses;
  if (form.priorities.length) filters.priorities = form.priorities;
  if (form.teams.length) filters.teams = form.teams;
  if (form.slaStates.length) filters.slaStates = form.slaStates;
  if (form.tagContains.trim()) filters.tagContains = form.tagContains.trim();
  if (form.companyIs.trim()) filters.companyIs = form.companyIs.trim();
  if (form.assigneeMode === 'currentUser') filters.assignee = { mode: 'currentUser' };
  if (form.assigneeMode === 'unassigned') filters.assignee = { mode: 'unassigned' };
  if (form.assigneeMode === 'is') filters.assignee = { mode: 'is', agentId: form.assigneeId };

  if (form.createdFrom || form.createdTo) {
    filters.createdDateRange = { from: form.createdFrom || undefined, to: form.createdTo || undefined };
  }

  if (form.updatedLast7Days) {
    filters.updatedDateRange = { preset: 'last7days' };
  } else if (form.updatedFrom || form.updatedTo) {
    filters.updatedDateRange = { from: form.updatedFrom || undefined, to: form.updatedTo || undefined };
  }

  return filters;
}

function filtersToAnalytics(filters: TicketViewFilters): string[] {
  const values: string[] = [];

  filters.statuses?.forEach((status) => values.push(`status=${status.toLowerCase()}`));
  filters.priorities?.forEach((priority) => values.push(`priority=${priority.toLowerCase()}`));
  filters.teams?.forEach((team) => values.push(`team=${team.toLowerCase()}`));
  filters.slaStates?.forEach((state) => values.push(`sla=${state.toLowerCase()}`));

  if (filters.assignee?.mode === 'currentUser') values.push('assignee=current_user');
  if (filters.assignee?.mode === 'unassigned') values.push('assignee=unassigned');
  if (filters.assignee?.mode === 'is') values.push('assignee=specific_agent');
  if (filters.tagContains) values.push('tag_contains=true');
  if (filters.companyIs) values.push('company=true');
  if (filters.createdDateRange) values.push('created_date_range=true');
  if (filters.updatedDateRange) values.push('updated_date_range=true');

  return values;
}

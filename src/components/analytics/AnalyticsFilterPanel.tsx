import { track } from '../../analytics/analytics';
import { FeedbackButton } from '../feedback/FeedbackButton';

export type AnalyticsFilterState = {
  source: 'all' | 'support' | 'google_play' | 'app_store';
  groupBy: 'topic' | 'project';
  severity: 'all' | 'critical' | 'medium' | 'low';
  dateRange: '30d' | '90d' | '6m';
  granularity: 'week' | 'month';
  focusMode: 'all' | 'project' | 'topic';
  focusId?: string;
};

type FilterOption = {
  id: string;
  name: string;
};

type AnalyticsFilterPanelProps = {
  value: AnalyticsFilterState;
  defaultValue: AnalyticsFilterState;
  projectOptions: FilterOption[];
  topicOptions: FilterOption[];
  onChange: (next: AnalyticsFilterState) => void;
};

const sourceLabels: Record<AnalyticsFilterState['source'], string> = {
  all: 'All data',
  support: 'Support tickets',
  google_play: 'Google Play reviews',
  app_store: 'App Store reviews',
};

const sourceHelp: Record<AnalyticsFilterState['source'], string> = {
  all: 'Includes support tickets and app store reviews',
  support: 'Support tickets only. Platform is not required.',
  google_play: 'Android inferred from Google Play',
  app_store: 'iOS inferred from App Store',
};

const groupLabels: Record<AnalyticsFilterState['groupBy'], string> = {
  topic: 'Topics',
  project: 'Projects',
};

const severityLabels: Record<AnalyticsFilterState['severity'], string> = {
  all: 'All severity',
  critical: 'Critical',
  medium: 'Medium',
  low: 'Low',
};

const dateRangeLabels: Record<AnalyticsFilterState['dateRange'], string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '6m': 'Last 6 months',
};

const granularityLabels: Record<AnalyticsFilterState['granularity'], string> = {
  week: 'Week',
  month: 'Month',
};

const focusLabels: Record<AnalyticsFilterState['focusMode'], string> = {
  all: 'All',
  project: 'One project',
  topic: 'One topic',
};

export function AnalyticsFilterPanel({
  value,
  defaultValue,
  projectOptions,
  topicOptions,
  onChange,
}: AnalyticsFilterPanelProps) {
  const focusOptions = value.focusMode === 'project' ? projectOptions : topicOptions;

  function emitChange(nextValue: AnalyticsFilterState) {
    track('topics_filter_changed', {
      source: nextValue.source,
      groupBy: nextValue.groupBy,
      focusMode: nextValue.focusMode,
      ...(nextValue.focusId ? { focusId: nextValue.focusId } : {}),
      severity: nextValue.severity,
      dateRange: nextValue.dateRange,
      granularity: nextValue.granularity,
    });
  }

  function update(next: AnalyticsFilterState) {
    const normalized = normalizeFilterState(next, projectOptions, topicOptions);
    onChange(normalized);
    emitChange(normalized);
  }

  function reset() {
    onChange(defaultValue);
    emitChange(defaultValue);
  }

  function changeFocusMode(nextMode: AnalyticsFilterState['focusMode']) {
    if (nextMode === value.focusMode) return;
    update({
      ...value,
      focusMode: nextMode,
      focusId: nextMode === 'project' ? projectOptions[0]?.id : nextMode === 'topic' ? topicOptions[0]?.id : undefined,
    });
  }

  function changeFocusItem(focusId: string) {
    update({ ...value, focusId });
  }

  const chips = activeChips(value, defaultValue, projectOptions, topicOptions);

  return (
    <section className="analytics-filter-card">
      <div className="analytics-filter-card-header">
        <div>
          <h2>Filters</h2>
          <p>Scope the heatmap by source, severity, grouping, and focus without invalid platform combinations.</p>
        </div>
        <div className="analytics-filter-actions">
          <FeedbackButton
            context="topics_filter_panel"
            variant="icon"
            componentLabel="Topics filter panel"
            source={value.source}
            groupBy={value.groupBy}
            severity={value.severity}
            dateRange={value.dateRange}
            granularity={value.granularity}
            focusMode={value.focusMode}
            focusId={value.focusId}
          />
          <button type="button" onClick={reset}>Reset filters</button>
        </div>
      </div>

      <div className="analytics-filter-primary">
        <label>
          <span>Data source</span>
          <select value={value.source} onChange={(event) => update({ ...value, source: event.target.value as AnalyticsFilterState['source'] })}>
            {Object.entries(sourceLabels).map(([source, label]) => (
              <option key={source} value={source}>{label}</option>
            ))}
          </select>
          <small>{sourceHelp[value.source]}</small>
        </label>
        <label>
          <span>Group by</span>
          <select value={value.groupBy} onChange={(event) => update({ ...value, groupBy: event.target.value as AnalyticsFilterState['groupBy'] })}>
            {Object.entries(groupLabels).map(([groupBy, label]) => (
              <option key={groupBy} value={groupBy}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={value.severity} onChange={(event) => update({ ...value, severity: event.target.value as AnalyticsFilterState['severity'] })}>
            {Object.entries(severityLabels).map(([severity, label]) => (
              <option key={severity} value={severity}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Time range</span>
          <select value={value.dateRange} onChange={(event) => update({ ...value, dateRange: event.target.value as AnalyticsFilterState['dateRange'] })}>
            {Object.entries(dateRangeLabels).map(([range, label]) => (
              <option key={range} value={range}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Granularity</span>
          <select value={value.granularity} onChange={(event) => update({ ...value, granularity: event.target.value as AnalyticsFilterState['granularity'] })}>
            {Object.entries(granularityLabels).map(([granularity, label]) => (
              <option key={granularity} value={granularity}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="analytics-filter-secondary">
        <label>
          <span>Focus</span>
          <select value={value.focusMode} onChange={(event) => changeFocusMode(event.target.value as AnalyticsFilterState['focusMode'])}>
            {Object.entries(focusLabels).map(([mode, label]) => (
              <option key={mode} value={mode}>{label}</option>
            ))}
          </select>
          <small>{focusHelp(value.focusMode)}</small>
        </label>
        {value.focusMode !== 'all' && (
          <label>
            <span>{value.focusMode === 'project' ? 'Project' : 'Topic'}</span>
            <select value={value.focusId} onChange={(event) => changeFocusItem(event.target.value)}>
              {focusOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="analytics-filter-summary" aria-label="Active filters">
        {chips.map((chip) => (
          <span key={chip.key}>
            {chip.label}
            {chip.reset && (
              <button type="button" aria-label={`Reset ${chip.label}`} onClick={() => update(chip.reset!(value))}>
                x
              </button>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}

function normalizeFilterState(
  state: AnalyticsFilterState,
  projectOptions: FilterOption[],
  topicOptions: FilterOption[],
): AnalyticsFilterState {
  if (state.focusMode === 'all') {
    return { ...state, focusId: undefined };
  }
  if (state.focusMode === 'project') {
    return { ...state, focusId: state.focusId ?? projectOptions[0]?.id };
  }
  return { ...state, focusId: state.focusId ?? topicOptions[0]?.id };
}

function activeChips(
  value: AnalyticsFilterState,
  defaultValue: AnalyticsFilterState,
  projectOptions: FilterOption[],
  topicOptions: FilterOption[],
) {
  const chips: Array<{
    key: string;
    label: string;
    reset?: (current: AnalyticsFilterState) => AnalyticsFilterState;
  }> = [
    { key: 'source', label: `Source: ${sourceLabels[value.source]}`, reset: value.source !== defaultValue.source ? (current) => ({ ...current, source: defaultValue.source }) : undefined },
    { key: 'groupBy', label: `Group: ${groupLabels[value.groupBy]}`, reset: value.groupBy !== defaultValue.groupBy ? (current) => ({ ...current, groupBy: defaultValue.groupBy }) : undefined },
    { key: 'range', label: `Range: ${dateRangeLabels[value.dateRange]}`, reset: value.dateRange !== defaultValue.dateRange ? (current) => ({ ...current, dateRange: defaultValue.dateRange }) : undefined },
    { key: 'granularity', label: `Granularity: ${granularityLabels[value.granularity]}`, reset: value.granularity !== defaultValue.granularity ? (current) => ({ ...current, granularity: defaultValue.granularity }) : undefined },
  ];

  if (value.severity !== defaultValue.severity) {
    chips.push({ key: 'severity', label: `Severity: ${severityLabels[value.severity]}`, reset: (current) => ({ ...current, severity: defaultValue.severity }) });
  }

  if (value.focusMode !== 'all') {
    const item = value.focusMode === 'project'
      ? projectOptions.find((option) => option.id === value.focusId)
      : topicOptions.find((option) => option.id === value.focusId);
    chips.push({
      key: 'focus',
      label: `Focus: ${item?.name ?? focusLabels[value.focusMode]}`,
      reset: (current) => ({ ...current, focusMode: 'all', focusId: undefined }),
    });
  }

  return chips;
}

function focusHelp(mode: AnalyticsFilterState['focusMode']) {
  if (mode === 'project') return 'Heatmap is scoped to one project. Related projects are shown in details.';
  if (mode === 'topic') return 'Heatmap is scoped to one topic. Related projects are shown in details.';
  return 'Showing all topics and projects.';
}

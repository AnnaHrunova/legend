import { useState } from 'react';
import { track } from '../../analytics/analytics';
import { FeedbackButton } from '../feedback/FeedbackButton';

export type AnalyticsFilterState = {
  source: 'all' | 'support' | 'reviews' | 'google_play' | 'app_store';
  severity: 'all' | 'critical' | 'medium' | 'low';
  dateRange: '30d' | '90d' | '6m';
  granularity: 'week' | 'month';
  focusMode: 'all' | 'project' | 'topic';
  focusId?: string;
  sortBy: 'total_volume' | 'growth_rate' | 'critical_count' | 'alphabetical';
};

type FilterOption = {
  id: string;
  name: string;
};

type AnalyticsFilterPanelProps = {
  value: AnalyticsFilterState;
  defaultValue: AnalyticsFilterState;
  helperText?: string;
  projectOptions: FilterOption[];
  topicOptions: FilterOption[];
  onChange: (next: AnalyticsFilterState) => void;
};

const sourceLabels: Record<AnalyticsFilterState['source'], string> = {
  all: 'All data',
  support: 'Support tickets',
  reviews: 'Reviews',
  google_play: 'Google Play reviews',
  app_store: 'App Store reviews',
};

const sourceHelp: Record<AnalyticsFilterState['source'], string> = {
  all: 'Includes support tickets and reviews',
  support: 'Review-specific filters are hidden',
  reviews: 'Includes Google Play and App Store',
  google_play: 'Android inferred from Google Play',
  app_store: 'iOS inferred from App Store',
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
  all: 'All topics and projects',
  project: 'One project',
  topic: 'One topic',
};

const sortLabels: Record<AnalyticsFilterState['sortBy'], string> = {
  total_volume: 'Total volume',
  growth_rate: 'Growth rate',
  critical_count: 'Critical count',
  alphabetical: 'Alphabetical',
};

export function AnalyticsFilterPanel({
  value,
  defaultValue,
  helperText = 'Use filters to narrow the analytics view without creating invalid source/platform combinations.',
  projectOptions,
  topicOptions,
  onChange,
}: AnalyticsFilterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const focusOptions = value.focusMode === 'project' ? projectOptions : topicOptions;

  function update(next: AnalyticsFilterState) {
    onChange(normalizeFilterState(next, projectOptions, topicOptions));
    track('analytics_filters_changed', normalizeFilterState(next, projectOptions, topicOptions));
  }

  function reset() {
    track('analytics_filter_reset_clicked', { previousState: value });
    onChange(defaultValue);
  }

  function changeFocusMode(nextMode: AnalyticsFilterState['focusMode']) {
    if (nextMode === value.focusMode) return;
    const next = normalizeFilterState(
      {
        ...value,
        focusMode: nextMode,
        focusId: nextMode === 'project' ? projectOptions[0]?.id : nextMode === 'topic' ? topicOptions[0]?.id : undefined,
      },
      projectOptions,
      topicOptions,
    );
    onChange(next);
    track('analytics_focus_mode_changed', { from: value.focusMode, to: nextMode });
    track('analytics_filters_changed', next);
  }

  function changeFocusItem(focusId: string) {
    const next = normalizeFilterState({ ...value, focusId }, projectOptions, topicOptions);
    onChange(next);
    track('analytics_focus_item_selected', { focusMode: value.focusMode, focusId });
    track('analytics_filters_changed', next);
  }

  const chips = activeChips(value, defaultValue, projectOptions, topicOptions);

  return (
    <section className="analytics-filter-card">
      <div className="analytics-filter-card-header">
        <div>
          <h2>Filters</h2>
          <p>{helperText}</p>
        </div>
        <div className="analytics-filter-actions">
          <FeedbackButton
            context="analytics_filter_panel"
            variant="icon"
            componentLabel="Analytics filter panel"
            source={value.source}
            severity={value.severity}
            dateRange={value.dateRange}
            granularity={value.granularity}
            focusMode={value.focusMode}
            focusId={value.focusId}
          />
          <button type="button" onClick={reset}>Reset filters</button>
          <button type="button" onClick={() => setAdvancedOpen((current) => !current)}>
            {advancedOpen ? 'Hide advanced' : 'Advanced'}
          </button>
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
          <span>Severity</span>
          <select value={value.severity} onChange={(event) => update({ ...value, severity: event.target.value as AnalyticsFilterState['severity'] })}>
            {Object.entries(severityLabels).map(([severity, label]) => (
              <option key={severity} value={severity}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Date range</span>
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

      {advancedOpen && (
        <div className="analytics-filter-advanced">
          <label>
            <span>Sort by</span>
            <select value={value.sortBy} onChange={(event) => update({ ...value, sortBy: event.target.value as AnalyticsFilterState['sortBy'] })}>
              {Object.entries(sortLabels).map(([sort, label]) => (
                <option key={sort} value={sort}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="analytics-filter-summary">
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
    { key: 'range', label: `Range: ${dateRangeLabels[value.dateRange]}` },
    { key: 'granularity', label: `Granularity: ${granularityLabels[value.granularity]}` },
  ];
  if (value.source !== defaultValue.source) {
    chips.unshift({ key: 'source', label: `Source: ${sourceLabels[value.source]}`, reset: (current) => ({ ...current, source: defaultValue.source }) });
  }
  if (value.severity !== defaultValue.severity) {
    chips.push({ key: 'severity', label: `Severity: ${severityLabels[value.severity]}`, reset: (current) => ({ ...current, severity: defaultValue.severity }) });
  }
  if (value.focusMode !== 'all') {
    const option = value.focusMode === 'project'
      ? projectOptions.find((item) => item.id === value.focusId)
      : topicOptions.find((item) => item.id === value.focusId);
    chips.push({
      key: 'focus',
      label: `Focus: ${option?.name ?? focusLabels[value.focusMode]}`,
      reset: (current) => ({ ...current, focusMode: 'all', focusId: undefined }),
    });
  }
  if (value.sortBy !== defaultValue.sortBy) {
    chips.push({ key: 'sort', label: `Sort: ${sortLabels[value.sortBy]}`, reset: (current) => ({ ...current, sortBy: defaultValue.sortBy }) });
  }
  return chips;
}

function focusHelp(mode: AnalyticsFilterState['focusMode']) {
  if (mode === 'project') return 'Heatmap and playback are scoped to one project.';
  if (mode === 'topic') return 'Heatmap and playback are scoped to one topic.';
  return 'Showing all topics and projects.';
}

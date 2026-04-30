import { macros } from '../data/mockMacros';
import { agents } from '../data/mockUsers';
import { PRIORITIES, STATUSES, TEAMS } from '../domain/types';

const slaPolicies = [
  { name: 'Urgent production impact', firstResponse: '15 min', resolution: '4 hours' },
  { name: 'Enterprise standard', firstResponse: '1 hour', resolution: '1 business day' },
  { name: 'Default support', firstResponse: '4 hours', resolution: '3 business days' },
];

export function AdminPage() {
  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Admin</h1>
        </div>
      </div>

      <div className="admin-grid">
        <ConfigPanel title="Teams" rows={TEAMS.map((team) => [team, `${agents.filter((agent) => agent.team === team).length} agents`])} />
        <ConfigPanel title="Agents" rows={agents.map((agent) => [agent.name, `${agent.role} · ${agent.team}`])} />
        <ConfigPanel title="Ticket statuses" rows={STATUSES.map((status) => [status, 'Visible in workflow'])} />
        <ConfigPanel title="Priorities" rows={PRIORITIES.map((priority) => [priority, 'Queue sorting and SLA input'])} />
        <ConfigPanel
          title="SLA policies"
          rows={slaPolicies.map((policy) => [
            policy.name,
            `${policy.firstResponse} first response · ${policy.resolution} resolution`,
          ])}
        />
        <ConfigPanel title="Macros" rows={macros.map((macro) => [macro.name, macro.target === 'reply' ? 'Public reply' : 'Internal note'])} />
      </div>
    </section>
  );
}

function ConfigPanel({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="config-panel">
      <div className="section-header">
        <h2>{title}</h2>
        <button disabled>Configure</button>
      </div>
      <div className="config-list">
        {rows.map(([name, detail]) => (
          <div key={`${title}-${name}`}>
            <strong>{name}</strong>
            <span>{detail}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

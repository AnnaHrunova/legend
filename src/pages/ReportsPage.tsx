import { useEffect, useMemo } from 'react';
import { track } from '../analytics/analytics';
import { PriorityBadge } from '../components/Badges';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { PRIORITIES, TEAMS } from '../domain/types';
import { useTickets } from '../state/ticketStore';

export function ReportsPage() {
  const { tickets } = useTickets();
  const solvedThisWeek = tickets.filter((ticket) => ticket.status === 'Solved' || ticket.status === 'Closed').length;
  const openTickets = tickets.filter((ticket) => !['Solved', 'Closed'].includes(ticket.status)).length;
  const slaBreaches = tickets.filter((ticket) => ticket.sla.state === 'Breached').length;

  useEffect(() => {
    track('view_opened', { view: 'reports' });
  }, []);

  const priorityRows = useMemo(
    () =>
      PRIORITIES.map((priority) => ({
        priority,
        count: tickets.filter((ticket) => ticket.priority === priority).length,
      })),
    [tickets],
  );

  const teamRows = useMemo(
    () =>
      TEAMS.map((team) => ({
        team,
        count: tickets.filter((ticket) => ticket.team === team).length,
      })),
    [tickets],
  );

  const maxTeam = Math.max(...teamRows.map((row) => row.count), 1);

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Reports</h1>
        </div>
        <FeedbackButton
          context="reports_dashboard"
          variant="inline"
          componentLabel="Reports dashboard"
        />
      </div>

      <div className="metric-grid">
        <Metric label="Open tickets" value={openTickets} detail="Active workload" />
        <Metric label="Solved this week" value={solvedThisWeek} detail="Mock rolling week" />
        <Metric label="Avg. first response" value="1h 42m" detail="Across all queues" />
        <Metric label="SLA breaches" value={slaBreaches} detail="Needs review" tone="danger" />
      </div>

      <div className="report-grid">
        <section className="report-panel">
          <div className="section-header">
            <h2>Tickets by priority</h2>
          </div>
          <table className="simple-table">
            <tbody>
              {priorityRows.map((row) => (
                <tr key={row.priority}>
                  <td>
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="report-panel">
          <div className="section-header">
            <h2>Tickets by team</h2>
          </div>
          <div className="bar-list">
            {teamRows.map((row) => (
              <div key={row.team}>
                <span>{row.team}</span>
                <div className="bar-track">
                  <i style={{ width: `${(row.count / maxTeam) * 100}%` }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: 'danger';
}) {
  return (
    <article className={`metric-card ${tone === 'danger' ? 'danger' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

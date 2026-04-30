import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { formatShortDate } from '../components/format';
import { customers } from '../data/mockCustomers';
import { useTickets } from '../state/ticketStore';

export function CustomersPage() {
  const { tickets } = useTickets();
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const selectedCustomer = customers.find((customer) => customer.id === selectedId) ?? customers[0];
  const selectedTickets = tickets.filter((ticket) => ticket.customerId === selectedCustomer.id);

  const rows = useMemo(
    () =>
      customers.map((customer) => {
        const customerTickets = tickets.filter((ticket) => ticket.customerId === customer.id);
        const lastContact = customerTickets
          .map((ticket) => ticket.updatedAt)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

        return {
          ...customer,
          ticketCount: customerTickets.length,
          lastContact: lastContact ?? customer.lastContactAt,
        };
      }),
    [tickets],
  );

  return (
    <section className="split-page">
      <div className="page-stack">
        <div className="page-header">
          <div>
            <p className="eyebrow">Directory</p>
            <h1>Customers</h1>
          </div>
        </div>

        <div className="table-card">
          <table className="ticket-table customer-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Tickets</th>
                <th>Last contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr
                  key={customer.id}
                  className={customer.id === selectedId ? 'selected-row' : ''}
                  onClick={() => setSelectedId(customer.id)}
                >
                  <td>
                    <strong>{customer.name}</strong>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.company}</td>
                  <td>{customer.ticketCount}</td>
                  <td>{formatShortDate(customer.lastContact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="profile-panel">
        <div className="profile-heading">
          <span className="avatar large">{selectedCustomer.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <h2>{selectedCustomer.name}</h2>
            <p>{selectedCustomer.company}</p>
          </div>
        </div>
        <dl className="meta-list">
          <div>
            <dt>Email</dt>
            <dd>{selectedCustomer.email}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{selectedCustomer.plan}</dd>
          </div>
          <div>
            <dt>Tickets</dt>
            <dd>{selectedTickets.length}</dd>
          </div>
        </dl>

        <section className="side-section">
          <h2>Recent tickets</h2>
          <div className="mini-ticket-list">
            {selectedTickets.slice(0, 6).map((ticket) => (
              <Link key={ticket.id} to={`/tickets/${ticket.id}`}>
                <strong>{ticket.subject}</strong>
                <span>
                  {ticket.id} · <StatusBadge status={ticket.status} /> <PriorityBadge priority={ticket.priority} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}

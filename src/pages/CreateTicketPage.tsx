import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../analytics/analytics';
import { FeedbackButton } from '../components/feedback/FeedbackButton';
import { customers } from '../data/mockCustomers';
import { PRIORITIES, TEAMS, type Priority, type Team } from '../domain/types';
import { useTickets } from '../state/ticketStore';

export function CreateTicketPage() {
  const navigate = useNavigate();
  const { createTicket } = useTickets();
  const [customerId, setCustomerId] = useState(customers[0].id);
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? customers[0];
  const [company, setCompany] = useState(selectedCustomer.company);
  const [priority, setPriority] = useState<Priority>('Normal');
  const [team, setTeam] = useState<Team>('Technical Support');
  const [tags, setTags] = useState('triage');

  return (
    <section className="form-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">New request</p>
          <h1>Create ticket</h1>
        </div>
        <FeedbackButton
          context="create_ticket_form"
          variant="inline"
          componentLabel="Create ticket form"
        />
      </div>

      <form
        className="ticket-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const ticket = createTicket({
            subject: String(form.get('subject') ?? '').trim(),
            customerId,
            company,
            description: String(form.get('description') ?? '').trim(),
            priority,
            team,
            tags: tags
              .split(',')
              .map((tag) => tag.trim().toLowerCase())
              .filter(Boolean),
          });
          track('ticket_created', { ticketId: ticket.id, priority, team });
          navigate(`/tickets/${ticket.id}`);
        }}
      >
        <label>
          <span>Subject</span>
          <input name="subject" required placeholder="Short customer-facing problem summary" />
        </label>

        <div className="form-grid">
          <label>
            <span>Customer</span>
            <select
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                const customer = customers.find((item) => item.id === event.target.value);
                if (customer) setCompany(customer.company);
              }}
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Company</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} required />
          </label>

          <label>
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {PRIORITIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Team</span>
            <select value={team} onChange={(event) => setTeam(event.target.value as Team)}>
              {TEAMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Description</span>
          <textarea
            name="description"
            required
            placeholder="Capture the customer's issue, impact, and any reproduction details."
          />
        </label>

        <label>
          <span>Tags</span>
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="triage, api" />
        </label>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/inbox')}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Create ticket
          </button>
        </div>
      </form>
    </section>
  );
}

import {
  BarChart3,
  CircleAlert,
  Clock3,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Plus,
  Search,
  Settings,
  TicketCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { currentUser } from '../data/mockUsers';
import { useTickets } from '../state/ticketStore';

const navItems = [
  { label: 'Inbox', to: '/inbox', icon: Inbox },
  { label: 'My tickets', to: '/my-tickets', icon: UserRound },
  { label: 'Unassigned', to: '/unassigned', icon: LifeBuoy },
  { label: 'Urgent', to: '/urgent', icon: CircleAlert },
  { label: 'Waiting on customer', to: '/waiting-on-customer', icon: Clock3 },
  { label: 'All tickets', to: '/all-tickets', icon: TicketCheck },
  { label: 'Customers', to: '/customers', icon: UsersRound },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Admin', to: '/admin', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { tickets } = useTickets();
  const urgentCount = tickets.filter((ticket) => ticket.priority === 'Urgent').length;
  const waitingCount = tickets.filter((ticket) => ticket.status === 'Waiting on customer').length;
  const myCount = tickets.filter((ticket) => ticket.assigneeId === currentUser.id).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <strong>Legend Desk</strong>
            <span>Internal support</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-link">
              <Icon size={18} />
              <span>{label}</span>
              {label === 'My tickets' && <em>{myCount}</em>}
              {label === 'Urgent' && <em>{urgentCount}</em>}
              {label === 'Waiting on customer' && <em>{waitingCount}</em>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              const query = new FormData(event.currentTarget).get('q')?.toString().trim();
              navigate(query ? `/inbox?search=${encodeURIComponent(query)}` : '/inbox');
            }}
          >
            <Search size={17} />
            <input name="q" placeholder="Search tickets, customers, companies..." />
          </form>
          <button className="primary-button" onClick={() => navigate('/tickets/new')}>
            <Plus size={17} />
            Create ticket
          </button>
          <div className="current-user" title={currentUser.email}>
            <span className="avatar">{currentUser.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{currentUser.name}</strong>
              <span>{currentUser.team}</span>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

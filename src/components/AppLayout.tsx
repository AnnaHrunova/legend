import {
  BarChart3,
  Flame,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  UsersRound,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FeedbackButton } from './feedback/FeedbackButton';
import { currentUser } from '../data/mockUsers';
import { applyTicketView } from '../domain/ticketViews';
import { useTickets } from '../state/ticketStore';
import { useTicketViews } from '../state/viewStore';

const navItems = [
  { label: 'Inbox', to: '/views/my-tickets', icon: Inbox },
  { label: 'Customers', to: '/customers', icon: UsersRound },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Topics', to: '/analytics/topics', icon: Flame },
  { label: 'Platform Health', to: '/analytics/platform-health', icon: HeartPulse },
  { label: 'Admin', to: '/admin', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { tickets } = useTickets();
  const { systemViews, customViews } = useTicketViews();

  function viewCount(viewId: string) {
    const view = [...systemViews, ...customViews].find((item) => item.id === viewId);
    return view ? applyTicketView(tickets, view, currentUser.id).length : 0;
  }

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
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-feedback-row">
          <FeedbackButton
            context="sidebar_navigation"
            variant="icon"
            label="Give feedback on navigation"
            componentLabel="Sidebar navigation"
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>System views</span>
            <FeedbackButton
              context="views_list"
              variant="icon"
              label="Give feedback on views list"
              componentLabel="System views list"
            />
          </div>
          <nav className="nav-list view-nav" aria-label="System ticket views">
            {systemViews.map((view) => (
              <NavLink key={view.id} to={`/views/${view.id}`} className="nav-link view-link">
                <i style={{ background: view.color }} />
                <span>{view.name}</span>
                <em>{viewCount(view.id)}</em>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>My views</span>
            <div className="sidebar-title-actions">
              <FeedbackButton
                context="views_list"
                variant="icon"
                label="Give feedback on my views"
                componentLabel="My views list"
              />
              <button onClick={() => navigate('/views/my-tickets?createView=1')}>New</button>
            </div>
          </div>
          <nav className="nav-list view-nav" aria-label="My ticket views">
            {customViews.map((view) => (
              <NavLink key={view.id} to={`/views/${view.id}`} className="nav-link view-link">
                <i style={{ background: view.color ?? '#64748b' }} />
                <span>{view.name}</span>
                <em>{viewCount(view.id)}</em>
              </NavLink>
            ))}
            {customViews.length === 0 && (
              <button
                className="empty-view-link"
                type="button"
                onClick={() => navigate('/views/my-tickets?createView=1')}
              >
                Create your first view
              </button>
            )}
          </nav>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              const query = new FormData(event.currentTarget).get('q')?.toString().trim();
              navigate(query ? `/views/my-tickets?search=${encodeURIComponent(query)}` : '/views/my-tickets');
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
      <FeedbackButton context="global" variant="floating" label="Feedback" />
    </div>
  );
}

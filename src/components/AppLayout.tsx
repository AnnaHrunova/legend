import {
  BarChart3,
  Bot,
  Flame,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  Plus,
  Search,
  Settings,
  UsersRound,
  VenetianMask,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FeedbackButton } from './feedback/FeedbackButton';
import { track } from '../analytics/analytics';
import { TesterProfileControl } from './tester/TesterProfileControl';
import { getTesterProfile, type TesterProfile } from '../analytics/testerProfile';
import { demoVoiceAppContext } from '../data/mockVoiceSupport';
import { applyTicketView } from '../domain/ticketViews';
import { useActiveAgent } from '../state/activeAgent';
import { useTickets } from '../state/ticketStore';
import { useTicketViews } from '../state/viewStore';
import { listMobileVoiceTickets, startVoiceSession } from '../voice/voiceSessionApi';

const navItems = [
  { label: 'Inbox', to: '/views/my-tickets', icon: Inbox },
  { label: 'Customers', to: '/customers', icon: UsersRound },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Topics Heatmap', to: '/analytics/topics', icon: Flame },
  { label: 'Admin', to: '/admin', icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { tickets, createVoiceTicket, updateTicket, upsertTicketsSilently } = useTickets();
  const { systemViews, customViews } = useTicketViews();
  const [voiceStarting, setVoiceStarting] = useState(false);
  const activeAgent = useActiveAgent();

  function viewCount(viewId: string) {
    const view = [...systemViews, ...customViews].find((item) => item.id === viewId);
    return view ? applyTicketView(tickets, view, activeAgent.id).length : 0;
  }

  useEffect(() => {
    let cancelled = false;

    async function syncMobileVoiceTickets() {
      try {
        const mobileVoiceTickets = await listMobileVoiceTickets();
        if (!cancelled) {
          upsertTicketsSilently(mobileVoiceTickets);
        }
      } catch {
        // The voice API is optional for local prototype runs.
      }
    }

    void syncMobileVoiceTickets();
    const timer = window.setInterval(syncMobileVoiceTickets, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [upsertTicketsSilently]);

  async function startDemoVoiceTicket() {
    if (voiceStarting) return;
    setVoiceStarting(true);
    const ticket = createVoiceTicket(demoVoiceAppContext);
    const voiceSession = ticket.voiceSession;
    navigate(`/tickets/${ticket.id}`);
    track('ticket_opened', {
      ticketId: ticket.id,
      channel: 'voice',
      source: 'in_app_call',
      voiceSessionId: voiceSession?.id,
      hasAppContext: true,
      currentScreen: demoVoiceAppContext.currentScreen,
      platform: demoVoiceAppContext.platform,
    });

    if (!voiceSession) {
      setVoiceStarting(false);
      return;
    }

    try {
      const started = await startVoiceSession({
        ticketId: ticket.id,
        voiceSessionId: voiceSession.id,
        roomName: voiceSession.roomName,
        appContext: demoVoiceAppContext,
      });
      updateTicket(
        ticket.id,
        {
          voiceSession: {
            ...voiceSession,
            status: 'ai_active',
            callStatus: 'connecting',
            roomName: started.roomName,
            livekitUrl: started.livekitUrl,
            supportToken: started.supportToken,
            customerToken: started.customerToken,
            agentDispatchId: started.agentDispatchId,
            mode: started.mode,
            setupWarnings: started.setupWarnings,
          },
        },
        started.mode === 'livekit' ? 'Connected LiveKit voice room' : 'Started voice session in mock mode',
        'Legend Voice',
      );
      track('ticket_status_changed', {
        ticketId: ticket.id,
        channel: 'voice',
        voiceSessionId: voiceSession.id,
        fromStatus: 'connecting',
        toStatus: 'ai_active',
        mode: started.mode,
      });
    } catch (error) {
      updateTicket(
        ticket.id,
        {
          voiceSession: {
            ...voiceSession,
            status: 'failed',
            callStatus: 'failed',
            outcome: 'failed',
            lastError: error instanceof Error ? error.message : String(error),
            setupWarnings: [error instanceof Error ? error.message : String(error)],
          },
          status: 'Escalated',
        },
        'Voice session failed to start',
        'Legend Voice',
      );
      track('ticket_status_changed', {
        ticketId: ticket.id,
        channel: 'voice',
        voiceSessionId: voiceSession.id,
        fromStatus: 'connecting',
        toStatus: 'failed',
      });
    } finally {
      setVoiceStarting(false);
    }
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
          <button
            className="voice-start-button"
            disabled={voiceStarting}
            onClick={startDemoVoiceTicket}
            title="Start a contextual in-app voice support ticket"
          >
            <PhoneCall size={17} />
            {voiceStarting ? 'Starting voice' : 'Voice ticket'}
          </button>
          <TesterProfileControl />
          <SupportAgentIdentity />
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <FeedbackButton context="global" variant="floating" label="Feedback" />
    </div>
  );
}

function SupportAgentIdentity() {
  const [profile, setProfile] = useState<TesterProfile | undefined>(() => getTesterProfile());

  useEffect(() => {
    const onProfileChanged = () => setProfile(getTesterProfile());
    window.addEventListener('legend-desk-tester-profile-changed', onProfileChanged);
    return () => window.removeEventListener('legend-desk-tester-profile-changed', onProfileChanged);
  }, []);

  if (!profile) {
    return (
      <div className="current-user current-user-anonymous" title="Anonymous prototype tester">
        <span className="agent-avatar agent-avatar-anonymous" aria-hidden="true">
          <VenetianMask size={18} />
        </span>
        <div>
          <strong>Anonymous</strong>
          <span>Support agent</span>
        </div>
      </div>
    );
  }

  return (
    <div className="current-user current-user-identified" title={profile.email}>
      <span className="agent-avatar agent-avatar-identified" aria-hidden="true">
        <Bot size={18} />
      </span>
      <div>
        <strong>{profile.fullName}</strong>
        <span>{profile.role}</span>
      </div>
    </div>
  );
}

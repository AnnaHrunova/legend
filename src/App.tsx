import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AdminPage } from './pages/AdminPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { CustomersPage } from './pages/CustomersPage';
import { InboxPage, type InboxView } from './pages/InboxPage';
import { ReportsPage } from './pages/ReportsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

function inbox(view: InboxView) {
  return <InboxPage initialView={view} />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={inbox('all')} />
        <Route path="my-tickets" element={inbox('my')} />
        <Route path="unassigned" element={inbox('unassigned')} />
        <Route path="urgent" element={inbox('urgent')} />
        <Route path="waiting-on-customer" element={inbox('waiting')} />
        <Route path="all-tickets" element={inbox('all')} />
        <Route path="tickets/new" element={<CreateTicketPage />} />
        <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

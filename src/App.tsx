import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AdminPage } from './pages/AdminPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { CustomersPage } from './pages/CustomersPage';
import { InboxPage } from './pages/InboxPage';
import { ReportsPage } from './pages/ReportsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/views/my-tickets" replace />} />
        <Route path="inbox" element={<Navigate to="/views/my-tickets" replace />} />
        <Route path="views/:viewId" element={<InboxPage />} />
        <Route path="my-tickets" element={<Navigate to="/views/my-tickets" replace />} />
        <Route path="unassigned" element={<Navigate to="/views/unassigned" replace />} />
        <Route path="urgent" element={<Navigate to="/views/urgent" replace />} />
        <Route
          path="waiting-on-customer"
          element={<Navigate to="/views/waiting-on-customer" replace />}
        />
        <Route path="all-tickets" element={<Navigate to="/views/recently-updated" replace />} />
        <Route path="tickets/new" element={<CreateTicketPage />} />
        <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

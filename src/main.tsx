import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './analytics/posthogClient';
import { TicketProvider } from './state/ticketStore';
import { ViewProvider } from './state/viewStore';
import './styles/global.css';

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <TicketProvider>
        <ViewProvider>
          <App />
        </ViewProvider>
      </TicketProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

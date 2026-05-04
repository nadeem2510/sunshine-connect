import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Groups from './pages/Groups';
import Templates from './pages/Templates';
import Campaigns from './pages/Campaigns';
import MessageLogs from './pages/MessageLogs';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="groups" element={<Groups />} />
        <Route path="templates" element={<Templates />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="messages" element={<MessageLogs />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

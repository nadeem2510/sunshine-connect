import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
import StatCard from '../components/StatCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [chart, setChart] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.stats(),
      dashboardApi.queue(),
      dashboardApi.chart({ days: 14 }),
      dashboardApi.health(),
    ]).then(([s, q, c, h]) => {
      setStats(s.data);
      setQueue(q.data);
      setChart(c.data);
      setHealth(h.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading dashboard…</div>
    </div>
  );

  const msgs = stats?.messages_30d || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Sunshine Hospital WhatsApp Marketing Overview</p>
      </div>

      {/* API Health Bar */}
      <div className={`card p-4 flex items-center justify-between ${health?.api_connected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${health?.api_connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <div>
            <span className="text-sm font-semibold text-gray-800">
              {health?.api_connected ? 'WhatsApp API Connected' : 'WhatsApp API Not Connected'}
            </span>
            {health?.phone_number && (
              <span className="text-xs text-gray-500 ml-2">· {health.phone_number}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          {health?.quality_rating && (
            <span>Quality: <strong className={health.quality_rating === 'GREEN' ? 'text-green-700' : health.quality_rating === 'YELLOW' ? 'text-yellow-700' : 'text-red-700'}>{health.quality_rating}</strong></span>
          )}
          {health?.api_version && <span>API: {health.api_version}</span>}
          {!health?.api_connected && (
            <a href="/settings" className="text-primary-600 font-medium hover:underline">Configure API →</a>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Contacts" value={stats?.contacts?.active} sub={`${stats?.contacts?.opted_out || 0} opted out`} icon="👥" color="blue" />
        <StatCard label="Groups" value={stats?.groups?.total} icon="🗂️" color="purple" />
        <StatCard label="Approved Templates" value={stats?.templates?.approved} sub={`${stats?.templates?.pending || 0} pending`} icon="📝" color="green" />
        <StatCard label="Active Campaigns" value={stats?.campaigns?.active} sub={`${stats?.campaigns?.total || 0} total`} icon="🚀" color="yellow" />
      </div>

      {/* Message stats (30 days) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sent (30d)" value={msgs.sent} icon="📤" color="blue" />
        <StatCard label="Delivered (30d)" value={msgs.delivered} icon="✅" color="green" />
        <StatCard label="Read (30d)" value={msgs.read} icon="👁️" color="purple" />
        <StatCard label="Failed (30d)" value={msgs.failed} icon="❌" color="red" />
      </div>

      {/* Chart + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Message Delivery (14 Days)</h2>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sent" fill="#0ea5e9" name="Sent" radius={[2,2,0,0]} />
                <Bar dataKey="delivered" fill="#22c55e" name="Delivered" radius={[2,2,0,0]} />
                <Bar dataKey="read" fill="#a855f7" name="Read" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Upcoming Queue */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Upcoming Messages (7 Days)</h2>
          {queue.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-10">No scheduled messages</div>
          ) : (
            <div className="overflow-y-auto max-h-56 space-y-2">
              {queue.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.contact_name}</div>
                    <div className="text-xs text-gray-400">{item.campaign_name} · {item.template_name}</div>
                  </div>
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(item.next_send_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {queue.length > 20 && (
                <div className="text-xs text-center text-gray-400 pt-1">+{queue.length - 20} more</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {(stats?.recent_activity || []).length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-6">No messages sent yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <th className="pb-2">Contact</th>
                <th className="pb-2">Template</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent_activity || []).map(msg => (
                <tr key={msg.id} className="table-row">
                  <td className="py-2 font-medium text-gray-800">{msg.contact_name || msg.phone}</td>
                  <td className="py-2 text-gray-500">{msg.template_name || '—'}</td>
                  <td className="py-2"><StatusBadge status={msg.status} /></td>
                  <td className="py-2 text-gray-400 text-xs">{new Date(msg.queued_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    sent: 'badge-blue', delivered: 'badge-green', read: 'badge-purple',
    failed: 'badge-red', queued: 'badge-gray', inbound: 'badge-yellow',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

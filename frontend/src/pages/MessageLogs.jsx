import { useEffect, useState } from 'react';
import { messagesApi } from '../services/api';

const STATUS_BADGE = {
  sent:      'badge-blue',
  delivered: 'badge-green',
  read:      'badge-purple',
  failed:    'badge-red',
  queued:    'badge-gray',
  inbound:   'badge-yellow',
};

export default function MessageLogs() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = () => {
    setLoading(true);
    Promise.all([
      messagesApi.logs({ status, page, limit }),
      messagesApi.stats({ days: 30 }),
    ]).then(([logs, s]) => {
      setMessages(logs.data.messages);
      setTotal(logs.data.total);
      setStats(s.data.summary);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, page]);

  const deliveryRate = stats && parseInt(stats.sent) > 0
    ? Math.round((parseInt(stats.delivered) / parseInt(stats.sent)) * 100)
    : 0;

  const readRate = stats && parseInt(stats.delivered) > 0
    ? Math.round((parseInt(stats.read) / parseInt(stats.delivered)) * 100)
    : 0;

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Message Logs</h1>
        <p className="text-sm text-gray-500">Track delivery, read rates and failures</p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total (30d)', value: stats.total, cls: 'text-gray-900' },
            { label: 'Sent',       value: stats.sent,  cls: 'text-blue-600' },
            { label: 'Delivered',  value: stats.delivered, cls: 'text-green-600' },
            { label: 'Read',       value: stats.read,  cls: 'text-purple-600' },
            { label: 'Failed',     value: stats.failed, cls: 'text-red-600' },
            { label: 'Read Rate',  value: `${readRate}%`, cls: 'text-purple-600' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className={`text-2xl font-bold ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select className="input max-w-xs" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="failed">Failed</option>
          <option value="inbound">Inbound (Replies)</option>
        </select>
        <span className="text-sm text-gray-400">{total} messages</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3">Delivered</th>
              <th className="px-4 py-3">Read</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No messages found</td></tr>
            ) : messages.map(m => (
              <tr key={m.id} className="table-row">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{m.contact_name || '—'}</div>
                  <div className="text-xs text-gray-400 font-mono">+{m.phone}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.template_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{m.campaign_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[m.status] || 'badge-gray'}>{m.status}</span>
                  {m.error_message && (
                    <div className="text-xs text-red-500 mt-0.5 max-w-xs truncate" title={m.error_message}>
                      {m.error_message}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {m.sent_at ? new Date(m.sent_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {m.delivered_at ? new Date(m.delivered_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {m.read_at ? new Date(m.read_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-3">Prev</button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-3">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

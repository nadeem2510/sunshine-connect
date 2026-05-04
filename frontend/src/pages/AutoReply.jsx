import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact Match' },
  { value: 'starts_with', label: 'Starts With' },
];

export default function AutoReply() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ keyword: '', response_text: '', match_type: 'contains' });
  const [error, setError] = useState('');

  async function fetchRules() {
    try {
      const res = await fetch(`${API}/api/auto-replies`);
      const data = await res.json();
      setRules(data);
    } catch {
      setError('Failed to load auto-reply rules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRules(); }, []);

  function openAdd() {
    setEditingId(null);
    setForm({ keyword: '', response_text: '', match_type: 'contains' });
    setError('');
    setShowForm(true);
  }

  function openEdit(rule) {
    setEditingId(rule.id);
    setForm({ keyword: rule.keyword, response_text: rule.response_text, match_type: rule.match_type });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.keyword.trim() || !form.response_text.trim()) {
      setError('Keyword and response are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `${API}/api/auto-replies/${editingId}` : `${API}/api/auto-replies`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setShowForm(false);
      fetchRules();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule) {
    try {
      await fetch(`${API}/api/auto-replies/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      fetchRules();
    } catch {
      setError('Failed to update rule');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this auto-reply rule?')) return;
    try {
      await fetch(`${API}/api/auto-replies/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch {
      setError('Failed to delete rule');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auto-Reply Keywords</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatically reply when a patient sends a matching keyword on WhatsApp
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Rule' : 'New Auto-Reply Rule'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Keyword *</label>
              <input
                type="text"
                value={form.keyword}
                onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                placeholder="e.g. timings"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Match Type</label>
              <select
                value={form.match_type}
                onChange={e => setForm(f => ({ ...f, match_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {MATCH_TYPES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1 flex items-end gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Rule'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Auto-Reply Message *</label>
            <textarea
              rows={3}
              value={form.response_text}
              onChange={e => setForm(f => ({ ...f, response_text: e.target.value }))}
              placeholder="e.g. Our OPD timings are Mon–Sat, 9 AM to 5 PM. For emergencies, please call 108."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Rules Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-gray-500 font-medium">No auto-reply rules yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add a rule so patients get instant replies when they message you
          </p>
          <button
            onClick={openAdd}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            + Add First Rule
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Keyword</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Match</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Response</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Triggered</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => (
                <tr key={rule.id} className={`hover:bg-gray-50 transition-colors ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-primary-700">
                    "{rule.keyword}"
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {MATCH_TYPES.find(m => m.value === rule.match_type)?.label || rule.match_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <span className="line-clamp-2">{rule.response_text}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 font-medium">
                    {rule.trigger_count}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        rule.is_active ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          rule.is_active ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-primary-600 hover:text-primary-800 font-medium mr-3 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* How it works */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-2">HOW IT WORKS</p>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li><strong>Contains</strong> — triggers if the patient's message includes the keyword anywhere</li>
          <li><strong>Exact Match</strong> — only triggers if the entire message equals the keyword</li>
          <li><strong>Starts With</strong> — triggers if the message begins with the keyword</li>
          <li>Only the <strong>first matching rule</strong> fires (rules are checked top-to-bottom by creation date)</li>
          <li>Opt-out messages (STOP, UNSUBSCRIBE, etc.) are handled separately and won't trigger auto-replies</li>
        </ul>
      </div>
    </div>
  );
}

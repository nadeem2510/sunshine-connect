import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const API = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ScheduledCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [runningId, setRunningId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sc, tmpl, grps] = await Promise.all([
        apiFetch('/scheduled-campaigns'),
        apiFetch('/templates'),
        apiFetch('/groups'),
      ]);
      setCampaigns(sc);
      setTemplates(tmpl);
      setGroups(grps);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const syncMeta = async () => {
    setSyncing(true);
    try {
      const r = await apiFetch('/templates/sync-meta', { method: 'POST' });
      toast.success(`Meta sync done — ${r.updated} template(s) updated`);
      load();
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleActive = async (sc) => {
    try {
      await apiFetch(`/scheduled-campaigns/${sc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !sc.is_active }),
      });
      toast.success(sc.is_active ? 'Campaign paused' : 'Campaign activated!');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runNow = async (sc) => {
    if (!confirm(`Send "${sc.name}" to all ${sc.contact_count} contacts NOW?`)) return;
    setRunningId(sc.id);
    try {
      const r = await apiFetch(`/scheduled-campaigns/${sc.id}/run-now`, { method: 'POST' });
      toast.success(`✅ Sent: ${r.sent} | ❌ Failed: ${r.failed}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (sc) => {
    if (!confirm(`Delete "${sc.name}"?`)) return;
    try {
      await apiFetch(`/scheduled-campaigns/${sc.id}`, { method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const approvedTemplates = templates.filter(t => t.status === 'approved');
  const pendingTemplates = templates.filter(t => t.status === 'pending');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Campaigns</h1>
          <p className="text-sm text-gray-500">Auto-send daily WhatsApp messages at scheduled time</p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncMeta} disabled={syncing} className="btn-secondary">
            {syncing ? '🔄 Syncing…' : '🔄 Sync Meta Approval'}
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
            + New Schedule
          </button>
        </div>
      </div>

      {/* Template status banner */}
      <div className={`rounded-lg p-4 text-sm border ${approvedTemplates.length > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
        {approvedTemplates.length > 0 ? (
          <>✅ <strong>{approvedTemplates.length} template(s) approved</strong> — ready to schedule campaigns!</>
        ) : (
          <>⏳ <strong>{pendingTemplates.length} template(s) pending</strong> Meta approval (24–48 hrs). Click "Sync Meta Approval" to check latest status.</>
        )}
      </div>

      {/* Campaign cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <div className="text-4xl mb-3">⏰</div>
          <div>No scheduled campaigns yet. Create one to auto-send daily WhatsApp messages!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(sc => (
            <div key={sc.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{sc.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {sc.is_active ? '🟢 Active' : '⏸ Paused'}
                    </span>
                    {sc.template_status && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.template_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        Template: {sc.template_status}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                    <div>
                      <span className="text-gray-400 text-xs block">Template</span>
                      <span className="font-medium">{sc.template_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Group</span>
                      <span className="font-medium">{sc.group_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Send Time (IST)</span>
                      <span className="font-medium text-primary-700">🕘 {sc.schedule_time?.slice(0, 5)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Contacts</span>
                      <span className="font-medium">{sc.contact_count || 0} people</span>
                    </div>
                  </div>
                  {sc.last_run_at && (
                    <div className="mt-2 text-xs text-gray-400">
                      Last sent: {new Date(sc.last_run_at).toLocaleString('en-IN')} | Total runs: {sc.run_count}
                    </div>
                  )}
                </div>

                {/* Toggle switch */}
                <div className="ml-4">
                  <button
                    onClick={() => toggleActive(sc)}
                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${sc.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                    title={sc.is_active ? 'Pause campaign' : 'Activate campaign'}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${sc.is_active ? 'translate-x-8' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                <button onClick={() => runNow(sc)} disabled={runningId === sc.id || sc.template_status !== 'approved'}
                  className="btn-primary text-xs py-1.5 px-3" title={sc.template_status !== 'approved' ? 'Template not approved yet' : ''}>
                  {runningId === sc.id ? '📤 Sending…' : '📤 Send Now'}
                </button>
                <button onClick={() => { setEditing(sc); setShowForm(true); }} className="btn-secondary text-xs py-1.5 px-3">✏️ Edit</button>
                <button onClick={() => handleDelete(sc)} className="btn-danger text-xs py-1.5 px-3">🗑 Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ScheduleForm
          campaign={editing}
          templates={approvedTemplates.length > 0 ? approvedTemplates : templates}
          groups={groups}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ScheduleForm({ campaign, templates, groups, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: campaign?.name || '',
    template_id: campaign?.template_id || '',
    group_id: campaign?.group_id || '',
    schedule_time: campaign?.schedule_time?.slice(0, 5) || '21:00',
    is_daily: campaign?.is_daily ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, schedule_time: form.schedule_time + ':00' };
      if (campaign) {
        await apiFetch(`/scheduled-campaigns/${campaign.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast.success('Schedule updated');
      } else {
        await apiFetch('/scheduled-campaigns', { method: 'POST', body: JSON.stringify(body) });
        toast.success('Schedule created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const approvedOnes = templates.filter(t => t.status === 'approved');
  const pendingOnes = templates.filter(t => t.status === 'pending');

  return (
    <Modal title={campaign ? 'Edit Schedule' : 'New Scheduled Campaign'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Campaign Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required
            placeholder="e.g. Daily Contractor Health Message" />
        </div>

        <div>
          <label className="label">Template *</label>
          <select className="input" value={form.template_id} onChange={e => set('template_id', e.target.value)} required>
            <option value="">Select template…</option>
            {approvedOnes.length > 0 && (
              <optgroup label="✅ Approved">
                {approvedOnes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )}
            {pendingOnes.length > 0 && (
              <optgroup label="⏳ Pending Approval">
                {pendingOnes.map(t => <option key={t.id} value={t.id}>{t.name} (pending)</option>)}
              </optgroup>
            )}
          </select>
          {approvedOnes.length === 0 && (
            <p className="text-xs text-yellow-600 mt-1">⚠️ No approved templates yet. Click "Sync Meta Approval" first.</p>
          )}
        </div>

        <div>
          <label className="label">Contact Group *</label>
          <select className="input" value={form.group_id} onChange={e => set('group_id', e.target.value)} required>
            <option value="">Select group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Send Time (IST) *</label>
          <input type="time" className="input" value={form.schedule_time} onChange={e => set('schedule_time', e.target.value)} required />
          <p className="text-xs text-gray-400 mt-1">Set to 21:00 for 9:00 PM IST daily</p>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_daily" checked={form.is_daily} onChange={e => set('is_daily', e.target.checked)} />
          <label htmlFor="is_daily" className="text-sm text-gray-700">Repeat daily</label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Schedule'}</button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { groupsApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const GROUP_TYPES = [
  { value: 'referral_doctors', label: 'Referral Doctors', icon: '🩺', defaultInterval: 10 },
  { value: 'social_workers',   label: 'Social Workers',   icon: '🤝', defaultInterval: 5  },
  { value: 'chronic_patients', label: 'Chronic Patients', icon: '💊', defaultInterval: 15 },
  { value: 'contractors',      label: 'Contractors',      icon: '🏗️', defaultInterval: 3  },
  { value: 'custom',           label: 'Custom',           icon: '📁', defaultInterval: 7  },
];

const INTERVAL_PRESETS = [3, 5, 7, 10, 15, 30];

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = () => {
    setLoading(true);
    groupsApi.list().then(r => setGroups(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (g) => {
    if (!confirm(`Delete group "${g.name}"?`)) return;
    await groupsApi.delete(g.id);
    toast.success('Group deleted');
    load();
  };

  const handleViewDetail = async (g) => {
    const r = await groupsApi.get(g.id);
    setDetail(r.data);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-sm text-gray-500">Segment contacts by role or condition</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ New Group</button>
      </div>

      {/* Pathway Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Automation Pathways</h2>
          <p className="text-xs text-gray-400 mt-0.5">Each group has its own message frequency and content strategy</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="px-5 py-3">Group</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Interval</th>
              <th className="px-5 py-3">Active Contacts</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No groups yet</td></tr>
            ) : groups.map(g => {
              const typeInfo = GROUP_TYPES.find(t => t.value === g.group_type) || GROUP_TYPES[4];
              return (
                <tr key={g.id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeInfo.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{g.name}</div>
                        {g.description && <div className="text-xs text-gray-400">{g.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge-blue">{typeInfo.label}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-800">Every {g.interval_days} days</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-green-700">{g.active_contacts || 0}</td>
                  <td className="px-5 py-3 text-gray-500">{g.total_contacts || 0}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleViewDetail(g)} className="text-primary-600 hover:underline text-xs">View</button>
                      <button onClick={() => { setEditing(g); setShowForm(true); }} className="text-gray-500 hover:underline text-xs">Edit</button>
                      <button onClick={() => handleDelete(g)} className="text-red-500 hover:underline text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Strategy Guide */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Recommended Strategy by Group</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '🩺', name: 'Referral Doctors', interval: '10 Days', strategy: 'Medical updates, new equipment (Trach/ICU), CME invites' },
            { icon: '🤝', name: 'Social Workers',   interval: '5 Days',  strategy: 'MJPJY/ESIC availability updates, patient success stories' },
            { icon: '💊', name: 'Chronic Patients', interval: '15 Days', strategy: 'Disease-specific health tips and follow-up reminders' },
            { icon: '🏗️', name: 'Contractors',      interval: '3 Days',  strategy: 'High-frequency during active campaigns & health checkup drives' },
          ].map(s => (
            <div key={s.name} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span>{s.icon}</span>
                <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                <span className="badge-yellow ml-auto">{s.interval}</span>
              </div>
              <p className="text-xs text-gray-500">{s.strategy}</p>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <GroupForm
          group={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {detail && (
        <GroupDetailModal
          group={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function GroupForm({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    group_type: group?.group_type || 'custom',
    interval_days: group?.interval_days || 10,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTypeChange = (type) => {
    const preset = GROUP_TYPES.find(t => t.value === type);
    set('group_type', type);
    if (preset) set('interval_days', preset.defaultInterval);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (group) {
        await groupsApi.update(group.id, form);
        toast.success('Group updated');
      } else {
        await groupsApi.create(form);
        toast.success('Group created');
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={group ? 'Edit Group' : 'New Group'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Group Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Group Type</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {GROUP_TYPES.map(t => (
              <button type="button" key={t.value}
                onClick={() => handleTypeChange(t.value)}
                className={`p-2 rounded-lg border text-xs font-medium transition-colors text-left ${
                  form.group_type === t.value
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <div className="text-base mb-0.5">{t.icon}</div>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Message Interval (days)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {INTERVAL_PRESETS.map(n => (
              <button type="button" key={n}
                onClick={() => set('interval_days', n)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.interval_days === n
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-primary-400'
                }`}>
                {n}d
              </button>
            ))}
            <input
              type="number" min={1} max={365} value={form.interval_days}
              onChange={e => set('interval_days', parseInt(e.target.value))}
              className="input w-20 text-center text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Group'}</button>
        </div>
      </form>
    </Modal>
  );
}

function GroupDetailModal({ group, onClose }) {
  return (
    <Modal title={group.name} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex gap-4 text-sm">
          <span>Interval: <strong>{group.interval_days} days</strong></span>
          <span>Active Contacts: <strong className="text-green-600">{group.active_contacts || 0}</strong></span>
        </div>
        <div>
          <h3 className="font-medium text-gray-700 mb-2">Contacts ({group.contacts?.length || 0})</h3>
          <div className="max-h-64 overflow-y-auto">
            {(group.contacts || []).length === 0 ? (
              <div className="text-gray-400 text-sm">No contacts in this group</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {group.contacts.map(c => (
                    <tr key={c.id} className="table-row">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2 text-gray-500 font-mono text-xs">+{c.phone}</td>
                      <td className="py-2">{c.opted_out ? <span className="badge-red">Opted Out</span> : <span className="badge-green">Active</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

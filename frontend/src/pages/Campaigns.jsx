import { useEffect, useState } from 'react';
import { campaignsApi, groupsApi, templatesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  active:  'badge-green',
  paused:  'badge-yellow',
  draft:   'badge-gray',
  stopped: 'badge-red',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showSendNow, setShowSendNow] = useState(false);
  const [queueView, setQueueView] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      campaignsApi.list(),
      groupsApi.list(),
      templatesApi.list({ status: 'approved' }),
    ]).then(([c, g, t]) => {
      setCampaigns(c.data);
      setGroups(g.data);
      setTemplates(t.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleActivate = async (c) => {
    const r = await campaignsApi.activate(c.id);
    toast.success(r.data.message);
    load();
  };

  const handlePause = async (c) => {
    await campaignsApi.pause(c.id);
    toast.success('Campaign paused');
    load();
  };

  const handleResume = async (c) => {
    await campaignsApi.resume(c.id);
    toast.success('Campaign resumed');
    load();
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    await campaignsApi.delete(c.id);
    toast.success('Campaign deleted');
    load();
  };

  const handleViewQueue = async (c) => {
    const r = await campaignsApi.queue(c.id);
    setQueueView({ campaign: c, items: r.data });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500">Drip campaigns and bulk sends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSendNow(true)} className="btn-secondary">⚡ Send Now</button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ New Campaign</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <div className="text-4xl mb-3">🚀</div>
          <div>No campaigns yet. Create a drip campaign to get started!</div>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(c => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{c.name}</h3>
                    <span className={STATUS_BADGE[c.status] || 'badge-gray'}>{c.status}</span>
                  </div>
                  {c.description && <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {c.group_name && <span>👥 {c.group_name}</span>}
                    <span>📋 {c.step_count} steps</span>
                    <span>👤 {c.enrolled_count} enrolled</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {c.status === 'draft' && (
                    <button onClick={() => handleActivate(c)} className="btn-success text-xs py-1.5 px-3">▶ Activate</button>
                  )}
                  {c.status === 'active' && (
                    <>
                      <button onClick={() => handleViewQueue(c)} className="btn-secondary text-xs py-1.5 px-3">📅 Queue</button>
                      <button onClick={() => handlePause(c)} className="btn-secondary text-xs py-1.5 px-3">⏸ Pause</button>
                    </>
                  )}
                  {c.status === 'paused' && (
                    <button onClick={() => handleResume(c)} className="btn-success text-xs py-1.5 px-3">▶ Resume</button>
                  )}
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                  <button onClick={() => handleDelete(c)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CampaignForm
          campaign={editing}
          groups={groups}
          templates={templates}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {showSendNow && (
        <SendNowModal
          groups={groups}
          templates={templates}
          onClose={() => setShowSendNow(false)}
        />
      )}

      {queueView && (
        <QueueModal
          campaign={queueView.campaign}
          items={queueView.items}
          onClose={() => setQueueView(null)}
        />
      )}
    </div>
  );
}

function CampaignForm({ campaign, groups, templates, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: campaign?.name || '',
    description: campaign?.description || '',
    group_id: campaign?.group_id || '',
    steps: [],
  });
  const [loading, setLoading] = useState(!!campaign);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (campaign) {
      campaignsApi.get(campaign.id).then(r => {
        setForm(f => ({ ...f, steps: r.data.steps || [] }));
        setLoading(false);
      });
    }
  }, [campaign]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addStep = () => {
    const lastDayOffset = form.steps[form.steps.length - 1]?.day_offset || 0;
    set('steps', [...form.steps, { template_id: '', day_offset: lastDayOffset + 5 }]);
  };

  const removeStep = (i) => set('steps', form.steps.filter((_, idx) => idx !== i));

  const updateStep = (i, k, v) => {
    const steps = [...form.steps];
    steps[i] = { ...steps[i], [k]: v };
    set('steps', steps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        group_id: form.group_id ? parseInt(form.group_id) : null,
        steps: form.steps.map(s => ({ ...s, template_id: parseInt(s.template_id), day_offset: parseInt(s.day_offset) })),
      };
      if (campaign) {
        await campaignsApi.update(campaign.id, payload);
        toast.success('Campaign updated');
      } else {
        await campaignsApi.create(payload);
        toast.success('Campaign created');
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={campaign ? 'Edit Campaign' : 'New Drip Campaign'} onClose={onClose} size="xl">
      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Campaign Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Cardiac Patient Follow-up" />
            </div>
            <div>
              <label className="label">Target Group</label>
              <select className="input" value={form.group_id} onChange={e => set('group_id', e.target.value)}>
                <option value="">Select a group…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>

          {/* Drip Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Drip Steps</label>
              <button type="button" onClick={addStep} className="btn-secondary text-xs py-1.5 px-3">+ Add Step</button>
            </div>
            {form.steps.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                No steps yet. Add steps to create your drip sequence.
              </div>
            ) : (
              <div className="space-y-3">
                {form.steps.map((step, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <select className="input text-sm" value={step.template_id} onChange={e => updateStep(i, 'template_id', e.target.value)} required>
                            <option value="">Select approved template…</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="relative">
                            <input type="number" min={0} className="input text-sm pr-10" value={step.day_offset}
                              onChange={e => updateStep(i, 'day_offset', e.target.value)} placeholder="Day offset" />
                            <span className="absolute right-3 top-2 text-xs text-gray-400">days</span>
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeStep(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    </div>
                    {step.day_offset > 0 && (
                      <div className="text-xs text-gray-400 mt-2 ml-10">Sends {step.day_offset} day{step.day_offset !== 1 ? 's' : ''} after enrollment</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Campaign'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function SendNowModal({ groups, templates, onClose }) {
  const [form, setForm] = useState({ template_id: '', group_id: '' });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSend = async (e) => {
    e.preventDefault();
    if (!confirm('This will immediately queue messages to ALL active contacts in this group. Proceed?')) return;
    setSending(true);
    try {
      const r = await campaignsApi.sendNow(form);
      toast.success(`Queued ${r.data.queued} messages!`);
      onClose();
    } finally {
      setSending(false);
    }
  };

  const approvedTemplates = templates.filter(t => t.status === 'approved');

  return (
    <Modal title="⚡ Send Now (Bulk Blast)" onClose={onClose}>
      <form onSubmit={handleSend} className="space-y-4">
        <div className="bg-sunshine-50 border border-sunshine-200 rounded-lg p-3 text-xs text-sunshine-700">
          Messages will be queued with random delays (1–5 seconds) between sends to avoid WhatsApp rate limits.
        </div>
        <div>
          <label className="label">Approved Template *</label>
          <select className="input" value={form.template_id} onChange={e => set('template_id', e.target.value)} required>
            <option value="">Select template…</option>
            {approvedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {approvedTemplates.length === 0 && (
            <p className="text-xs text-red-500 mt-1">No approved templates. Submit a template for Meta approval first.</p>
          )}
        </div>
        <div>
          <label className="label">Target Group *</label>
          <select className="input" value={form.group_id} onChange={e => set('group_id', e.target.value)} required>
            <option value="">Select group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.active_contacts} active)</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={sending || approvedTemplates.length === 0} className="btn-primary">
            {sending ? 'Queuing…' : '⚡ Send Now'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function QueueModal({ campaign, items, onClose }) {
  return (
    <Modal title={`Queue: ${campaign.name}`} onClose={onClose} size="lg">
      <div className="space-y-2">
        <p className="text-sm text-gray-500">{items.length} messages scheduled in next 7 days</p>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No upcoming messages in the next 7 days</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-xs font-medium text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Template</th>
                  <th className="px-3 py-2 text-left">Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="table-row">
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.contact_name}</div>
                      <div className="text-xs text-gray-400">+{item.phone}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{item.template_name || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.next_send_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}

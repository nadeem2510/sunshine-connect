import { useEffect, useState, useRef } from 'react';
import { contactsApi, groupsApi, templatesApi, messagesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sendTarget, setSendTarget] = useState(null); // contact to send message to
  const fileRef = useRef();
  const limit = 50;

  const load = () => {
    setLoading(true);
    contactsApi.list({ search, page, limit })
      .then(r => { setContacts(r.data.contacts); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);
  useEffect(() => { groupsApi.list().then(r => setGroups(r.data)); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete contact "${name}"?`)) return;
    await contactsApi.delete(id);
    toast.success('Contact deleted');
    load();
  };

  const handleOptToggle = async (c) => {
    if (c.opted_out) {
      await contactsApi.optIn(c.id);
      toast.success(`${c.name} opted back in`);
    } else {
      await contactsApi.optOut(c.id);
      toast.success(`${c.name} opted out`);
    }
    load();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await contactsApi.upload(fd);
      toast.success(`Imported: ${r.data.imported}, Skipped: ${r.data.skipped}`);
      load();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{total} total contacts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary">
            {uploading ? 'Uploading…' : '📁 Import CSV/Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} />
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ Add Contact</button>
        </div>
      </div>

      {/* Search */}
      <input
        className="input max-w-sm"
        placeholder="Search by name, phone, or email…"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
      />

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Groups</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No contacts found</td></tr>
            ) : contacts.map(c => (
              <tr key={c.id} className="table-row">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{c.name}</div>
                  {c.specialty && <div className="text-xs text-gray-400">{c.specialty}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">+{c.phone}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.group_names || []).map(g => g && (
                      <span key={g} className="badge-blue text-xs">{g}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.opted_out
                    ? <span className="badge-red">Opted Out</span>
                    : <span className="badge-green">Active</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSendTarget(c)}
                      disabled={c.opted_out}
                      title="Send WhatsApp message"
                      className="text-green-600 hover:underline text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      📤 Send
                    </button>
                    <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-primary-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleOptToggle(c)} className="text-gray-500 hover:underline text-xs">
                      {c.opted_out ? 'Opt In' : 'Opt Out'}
                    </button>
                    <button onClick={() => handleDelete(c.id, c.name)} className="text-red-500 hover:underline text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
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

      {showForm && (
        <ContactForm
          groups={groups}
          contact={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {sendTarget && (
        <SendMessageModal
          contact={sendTarget}
          onClose={() => setSendTarget(null)}
        />
      )}
    </div>
  );
}

function ContactForm({ contact, groups, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    specialty: contact?.specialty || '',
    organization: contact?.organization || '',
    notes: contact?.notes || '',
    group_ids: contact?.group_ids?.filter(Boolean) || [],
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleGroup = (id) => {
    set('group_ids', form.group_ids.includes(id)
      ? form.group_ids.filter(g => g !== id)
      : [...form.group_ids, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (contact) {
        await contactsApi.update(contact.id, form);
        toast.success('Contact updated');
      } else {
        await contactsApi.create(form);
        toast.success('Contact added');
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={contact ? 'Edit Contact' : 'Add Contact'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className="label">Phone (with country code) *</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="919876543210" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Specialty / Role</label>
            <input className="input" value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="Cardiologist, Social Worker…" />
          </div>
          <div className="col-span-2">
            <label className="label">Organization / Hospital</label>
            <input className="input" value={form.organization} onChange={e => set('organization', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none h-16" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Groups</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {groups.map(g => (
              <button type="button" key={g.id}
                onClick={() => toggleGroup(g.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.group_ids.includes(g.id)
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                }`}>
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Contact'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SendMessageModal({ contact, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    templatesApi.list({ status: 'approved', limit: 200 })
      .then(r => {
        const list = r.data.templates || r.data || [];
        setTemplates(list.filter(t => t.status === 'approved'));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.body_text || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      await messagesApi.send({ contact_id: contact.id, template_id: selectedTemplate.id });
      toast.success(`✅ Message sent to ${contact.name}!`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Send Message — ${contact.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-gray-500">
          📱 Sending to: <span className="font-mono font-medium text-gray-700">+{contact.phone}</span>
        </div>

        {/* Template search */}
        <input
          className="input"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Template list */}
        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">Loading templates…</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">No approved templates found</div>
          ) : filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTemplate(t)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                selectedTemplate?.id === t.id
                  ? 'bg-primary-50 border-l-4 border-l-primary-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-900">{t.name}</span>
                <span className="text-xs text-gray-400 uppercase">{t.language}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.body_text}</p>
            </button>
          ))}
        </div>

        {/* Preview selected */}
        {selectedTemplate && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs font-medium text-green-700 mb-1">📋 Selected: {selectedTemplate.name}</p>
            <p className="text-xs text-green-800 leading-snug whitespace-pre-wrap line-clamp-3">
              {selectedTemplate.body_text?.replace('{{1}}', contact.name)}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedTemplate || sending}
            className="btn-primary"
          >
            {sending ? 'Sending…' : '📤 Send Now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

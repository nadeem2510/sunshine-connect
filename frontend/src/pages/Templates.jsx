import { useEffect, useState } from 'react';
import { templatesApi } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  approved: 'badge-green',
  pending:  'badge-yellow',
  draft:    'badge-gray',
  rejected: 'badge-red',
};

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  const load = () => {
    setLoading(true);
    templatesApi.list().then(r => setTemplates(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await templatesApi.delete(t.id);
    toast.success('Template deleted');
    load();
  };

  const handleSubmitApproval = async (t) => {
    if (!confirm(`Submit "${t.name}" to Meta for approval? This is required before sending.`)) return;
    const r = await templatesApi.submitApproval(t.id);
    toast.success('Submitted to Meta for approval');
    load();
  };

  const handleClone = async (t) => {
    await templatesApi.clone(t.id);
    toast.success('Template cloned');
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500">Create and manage Meta-approved message templates</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ New Template</button>
      </div>

      {/* Info Banner */}
      <div className="bg-sunshine-50 border border-sunshine-200 rounded-lg p-4 text-sm text-sunshine-700">
        <strong>Important:</strong> WhatsApp requires all marketing messages to use pre-approved templates.
        Create your template, then click "Submit for Approval" to send it to Meta. Approval usually takes 24–48 hours.
        Only <strong>Approved</strong> templates can be sent in bulk.
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <div className="text-4xl mb-3">📝</div>
          <div>No templates yet. Create your first one!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={STATUS_BADGE[t.status] || 'badge-gray'}>{t.status}</span>
                    <span className="badge-gray">{t.category}</span>
                    <span className="text-xs text-gray-400">{t.language}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 font-mono leading-relaxed mb-3 min-h-16">
                {t.body_text}
              </div>

              {t.variables?.length > 0 && (
                <div className="text-xs text-gray-500 mb-3">
                  Variables: {t.variables.join(', ')}
                </div>
              )}

              {t.status === 'rejected' && t.rejection_reason && (
                <div className="bg-red-50 border border-red-100 rounded p-2 text-xs text-red-700 mb-3">
                  Rejected: {t.rejection_reason}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPreviewing(t)} className="btn-secondary text-xs py-1.5 px-3">Preview</button>
                {t.status !== 'approved' && (
                  <button onClick={() => { setEditing(t); setShowForm(true); }} className="btn-secondary text-xs py-1.5 px-3">Edit</button>
                )}
                {(t.status === 'draft' || t.status === 'rejected') && (
                  <button onClick={() => handleSubmitApproval(t)} className="btn-primary text-xs py-1.5 px-3">Submit for Approval</button>
                )}
                <button onClick={() => handleClone(t)} className="btn-secondary text-xs py-1.5 px-3">Clone</button>
                <button onClick={() => handleDelete(t)} className="btn-danger text-xs py-1.5 px-3">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TemplateForm
          template={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {previewing && (
        <TemplatePreview
          template={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

function TemplateForm({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: template?.name || '',
    category: template?.category || 'MARKETING',
    language: template?.language || 'en',
    body_text: template?.body_text || '',
    header_text: template?.header_text || '',
    footer_text: template?.footer_text || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const variables = [...new Set((form.body_text.match(/\{\{(\d+)\}\}/g) || []))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (template) {
        await templatesApi.update(template.id, form);
        toast.success('Template saved');
      } else {
        await templatesApi.create(form);
        toast.success('Template created');
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={template ? 'Edit Template' : 'New Template'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Template Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder="e.g. bed_availability_update" />
            <p className="text-xs text-gray-400 mt-1">Will be converted to lowercase with underscores for Meta</p>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Header (optional)</label>
          <input className="input" value={form.header_text} onChange={e => set('header_text', e.target.value)}
            placeholder="e.g. Sunshine Hospital Update" />
        </div>

        <div>
          <label className="label">Message Body *</label>
          <textarea
            className="input resize-none h-32 font-mono text-sm"
            value={form.body_text}
            onChange={e => set('body_text', e.target.value)}
            required
            placeholder={"Hello Dr. {{1}},\n\nSunshine Hospital has {{2}} ICU beds available today.\n\nFor admissions, call: {{3}}"}
          />
          <p className="text-xs text-gray-400 mt-1">
            Use <code className="bg-gray-100 px-1 rounded">{"{{1}}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{{2}}"}</code> etc. for variables.
            Variable <code className="bg-gray-100 px-1 rounded">{"{{1}}"}</code> is automatically the contact's name.
          </p>
          {variables.length > 0 && (
            <div className="mt-2 text-xs text-primary-700 bg-primary-50 rounded p-2">
              Detected variables: {variables.join(', ')} — {variables.length} will be replaced when sending
            </div>
          )}
        </div>

        <div>
          <label className="label">Footer (optional)</label>
          <input className="input" value={form.footer_text} onChange={e => set('footer_text', e.target.value)}
            placeholder="e.g. Reply STOP to unsubscribe" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Template'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TemplatePreview({ template, onClose }) {
  const [vars, setVars] = useState({ '1': 'Dr. Sheikh', '2': 'Sample Value' });
  const [preview, setPreview] = useState('');

  useEffect(() => {
    templatesApi.preview(template.id, vars)
      .then(r => setPreview(r.data.preview))
      .catch(() => {
        let p = template.body_text;
        Object.entries(vars).forEach(([k, v]) => {
          p = p.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        });
        setPreview(p);
      });
  }, [vars]);

  const variableKeys = [...new Set((template.body_text.match(/\d+(?=\}\})/g) || []))];

  return (
    <Modal title="Template Preview" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Sample Variable Values</label>
          {variableKeys.map(k => (
            <div key={k} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500 w-16">{'{{' + k + '}}'}</span>
              <input className="input flex-1" value={vars[k] || ''} onChange={e => setVars(v => ({ ...v, [k]: e.target.value }))} />
            </div>
          ))}
        </div>

        <div>
          <label className="label">WhatsApp Preview</label>
          <div className="bg-[#e5ddd5] rounded-xl p-4">
            <div className="max-w-xs ml-auto">
              <div className="bg-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
                {template.header_text && (
                  <div className="font-bold text-sm text-gray-900 mb-2">{template.header_text}</div>
                )}
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{preview}</p>
                {template.footer_text && (
                  <p className="text-xs text-gray-400 mt-2 border-t pt-2">{template.footer_text}</p>
                )}
                <div className="text-right text-xs text-gray-400 mt-1">12:00 ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

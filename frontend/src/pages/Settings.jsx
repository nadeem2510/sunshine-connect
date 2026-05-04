import { useState, useEffect } from 'react';
import { dashboardApi } from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.health()
      .then(r => setHealth(r.data))
      .finally(() => setLoading(false));
  }, []);

  const checkHealth = () => {
    setLoading(true);
    dashboardApi.health()
      .then(r => { setHealth(r.data); toast.success('Status refreshed'); })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">API configuration and system status</p>
      </div>

      {/* API Status */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">WhatsApp API Status</h2>
          <button onClick={checkHealth} disabled={loading} className="btn-secondary text-xs">
            {loading ? 'Checking…' : '↻ Refresh'}
          </button>
        </div>

        {health && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${health.api_connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className={`font-semibold ${health.api_connected ? 'text-green-700' : 'text-red-700'}`}>
                {health.api_connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            {health.api_connected ? (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: 'Phone Number', value: health.phone_number },
                  { label: 'Quality Rating', value: health.quality_rating },
                  { label: 'Name Status', value: health.name_status },
                  { label: 'API Version', value: health.api_version },
                ].map(item => item.value && (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className="font-medium text-gray-900 mt-0.5">{item.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 mt-3">
                <p className="text-sm text-red-700">{health.message || 'API credentials not configured'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Guide */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">How to Configure WhatsApp API</h2>
        <ol className="space-y-4 text-sm">
          {[
            {
              step: 1,
              title: 'Create a Meta Business Account',
              desc: 'Go to business.facebook.com and create or use your existing Sunshine Hospital account.',
            },
            {
              step: 2,
              title: 'Set up WhatsApp Business API',
              desc: 'Navigate to Meta Developer portal → Create App → Add WhatsApp product. You\'ll get a Phone Number ID and WABA ID.',
            },
            {
              step: 3,
              title: 'Get a Permanent Access Token',
              desc: 'In Meta Business Suite → Settings → System Users → Create a System User with WhatsApp permissions. Generate a permanent token.',
            },
            {
              step: 4,
              title: 'Configure the .env file',
              desc: 'Open /backend/.env and fill in WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, and WA_BUSINESS_ACCOUNT_ID.',
            },
            {
              step: 5,
              title: 'Register Webhook',
              desc: 'In Meta Developer portal → WhatsApp → Configuration → set Webhook URL to: https://your-domain.com/api/webhooks and Verify Token to the value in your .env.',
            },
            {
              step: 6,
              title: 'Apply for Green Tick (Optional)',
              desc: 'For official verification, submit your business via Meta Business Suite → Settings → WhatsApp Manager → Phone Numbers → Display Name.',
            },
          ].map(item => (
            <li key={item.step} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-gray-500 mt-0.5">{item.desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Safety Features Info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Safety Gates (Active)</h2>
        <div className="space-y-3">
          {[
            { icon: '⏱️', label: 'Variable Delays', desc: '1–5 second random delay between each outgoing message to avoid WhatsApp rate-limit filters.' },
            { icon: '✅', label: 'Template Approval Gate', desc: 'Only Meta-approved templates can be sent in bulk. Draft templates are blocked from sending.' },
            { icon: '🙋', label: 'Personalization Engine', desc: 'Contact name is automatically injected as {{1}} in every message, making them personal and less likely to be reported as spam.' },
            { icon: '🚫', label: 'Opt-out Auto-Detection', desc: 'Webhook listener automatically opts out any contact who replies STOP, UNSUBSCRIBE, QUIT, END, or CANCEL.' },
            { icon: '📊', label: 'Delivery Tracking', desc: 'Every message status (queued → sent → delivered → read) is tracked via webhooks for full audit trail.' },
          ].map(f => (
            <div key={f.label} className="flex gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <span className="text-lg">{f.icon}</span>
              <div>
                <div className="font-medium text-green-800 text-sm">{f.label}</div>
                <div className="text-xs text-green-600 mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Variables Reference */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Environment Variables Reference</h2>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
          <div><span className="text-gray-500"># Backend .env file</span></div>
          <div>WA_PHONE_NUMBER_ID=<span className="text-yellow-300">your_phone_number_id</span></div>
          <div>WA_ACCESS_TOKEN=<span className="text-yellow-300">your_permanent_access_token</span></div>
          <div>WA_BUSINESS_ACCOUNT_ID=<span className="text-yellow-300">your_waba_id</span></div>
          <div>WA_WEBHOOK_VERIFY_TOKEN=<span className="text-yellow-300">sunshine_webhook_secret_2024</span></div>
          <div>WA_API_VERSION=<span className="text-yellow-300">v19.0</span></div>
          <div className="mt-2"><span className="text-gray-500"># Database</span></div>
          <div>DB_HOST=<span className="text-yellow-300">localhost</span></div>
          <div>DB_NAME=<span className="text-yellow-300">sunshine_connect</span></div>
          <div>DB_USER=<span className="text-yellow-300">postgres</span></div>
          <div>DB_PASSWORD=<span className="text-yellow-300">yourpassword</span></div>
          <div className="mt-2"><span className="text-gray-500"># Redis</span></div>
          <div>REDIS_HOST=<span className="text-yellow-300">localhost</span></div>
          <div>REDIS_PORT=<span className="text-yellow-300">6379</span></div>
        </div>
      </div>
    </div>
  );
}

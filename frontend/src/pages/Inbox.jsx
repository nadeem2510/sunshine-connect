import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '';

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [contact, setContact] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    const t = setInterval(fetchConversations, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (selected) fetchThread(selected);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  async function fetchConversations() {
    try {
      const { data } = await axios.get(`${API}/api/messages/inbox`);
      setConversations(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function fetchThread(contactId) {
    try {
      const { data } = await axios.get(`${API}/api/messages/inbox/${contactId}`);
      setContact(data.contact);
      setThread(data.messages);
    } catch {
      toast.error('Could not load conversation');
    }
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API}/api/messages/inbox/${selected}/reply`, { text: reply.trim() });
      setReply('');
      await fetchThread(selected);
      await fetchConversations();
      toast.success('Message sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Conversation List */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Inbox</h2>
          <p className="text-xs text-gray-500 mt-0.5">WhatsApp replies from patients</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm text-gray-500">No replies yet</p>
              <p className="text-xs text-gray-400 mt-1">When patients reply, they'll appear here</p>
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.contact_id}
              onClick={() => setSelected(conv.contact_id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selected === conv.contact_id ? 'bg-primary-50 border-l-2 border-l-primary-600' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900 truncate">{conv.contact_name}</span>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 truncate">{conv.last_message || '—'}</span>
                {parseInt(conv.unread_count) > 0 && (
                  <span className="ml-2 shrink-0 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{conv.phone}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-base font-medium text-gray-500">Select a conversation</p>
            <p className="text-sm text-gray-400">Choose a contact from the left to view their messages</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                {contact?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{contact?.name}</p>
                <p className="text-xs text-gray-500">{contact?.phone}</p>
              </div>
              {contact?.opted_out && (
                <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Opted Out</span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {thread.map(msg => {
                const isInbound = msg.status === 'inbound';
                return (
                  <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${
                        isInbound
                          ? 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                          : 'bg-primary-600 text-white rounded-tr-sm'
                      }`}
                    >
                      <p className="leading-snug">{msg.message_body}</p>
                      <p className={`text-xs mt-1 ${isInbound ? 'text-gray-400' : 'text-primary-200'}`}>
                        {formatTime(msg.queued_at)}
                        {!isInbound && (
                          <span className="ml-1">
                            {msg.status === 'read' ? ' ✓✓' : msg.status === 'delivered' ? ' ✓✓' : msg.status === 'sent' ? ' ✓' : ''}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Reply Box */}
            <div className="bg-white border-t border-gray-200 px-4 py-3">
              {contact?.opted_out ? (
                <p className="text-center text-sm text-red-500 py-2">This contact has opted out — cannot send messages.</p>
              ) : (
                <form onSubmit={sendReply} className="flex gap-2 items-end">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                    placeholder="Type a reply... (Enter to send)"
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors h-10"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

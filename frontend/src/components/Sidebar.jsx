import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',    icon: '📊' },
  { to: '/contacts',   label: 'Contacts',     icon: '👥' },
  { to: '/groups',     label: 'Groups',       icon: '🗂️' },
  { to: '/templates',  label: 'Templates',    icon: '📝' },
  { to: '/campaigns',  label: 'Campaigns',    icon: '🚀' },
  { to: '/messages',   label: 'Message Logs', icon: '📨' },
  { to: '/inbox',      label: 'Inbox',        icon: '💬' },
  { to: '/settings',   label: 'Settings',     icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          {/* Sunshine Hospital Logo Mark */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-10 h-10 shrink-0">
            <g fill="#F5A623">
              <circle cx="77.57" cy="54.86" r="7"/>
              <circle cx="54.86" cy="77.57" r="7"/>
              <circle cx="45.14" cy="77.57" r="7"/>
              <circle cx="22.43" cy="54.86" r="7"/>
              <circle cx="22.43" cy="45.14" r="7"/>
              <circle cx="45.14" cy="22.43" r="7"/>
              <circle cx="54.86" cy="22.43" r="7"/>
              <circle cx="77.57" cy="45.14" r="7"/>
            </g>
            <g fill="none" stroke="#F5A623" strokeWidth="13" strokeLinecap="round">
              <path d="M 77.57,54.86 A 28,28 0 0,1 54.86,77.57"/>
              <path d="M 45.14,77.57 A 28,28 0 0,1 22.43,54.86"/>
              <path d="M 22.43,45.14 A 28,28 0 0,1 45.14,22.43"/>
              <path d="M 54.86,22.43 A 28,28 0 0,1 77.57,45.14"/>
            </g>
          </svg>
          <div>
            <div className="font-bold leading-tight" style={{ color: '#7B2D9B', fontSize: '13px' }}>SUNSHINE</div>
            <div className="font-bold leading-tight" style={{ color: '#7B2D9B', fontSize: '11px', letterSpacing: '0.05em' }}>HOSPITAL</div>
            <div className="text-xs font-medium leading-tight" style={{ color: '#F5A623', fontSize: '9px' }}>Fair With Quality Care</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400">
        Sunshine Hospital · Fair With Quality Care
      </div>
    </aside>
  );
}

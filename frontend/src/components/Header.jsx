import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';

export default function Header() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    dashboardApi.health()
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ api_connected: false }));
  }, []);

  const qualityColor = {
    GREEN: 'text-green-600',
    YELLOW: 'text-yellow-600',
    RED: 'text-red-600',
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
      <div className="text-sm font-semibold text-gray-700">Sunshine Hospital — Marketing Suite</div>

      <div className="flex items-center gap-4">
        {health && (
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${health.api_connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-gray-500">
              {health.api_connected
                ? `WhatsApp API Connected${health.quality_rating ? ` · Quality: ` : ''}`
                : 'API Not Connected'}
            </span>
            {health.quality_rating && (
              <span className={`font-semibold ${qualityColor[health.quality_rating] || 'text-gray-600'}`}>
                {health.quality_rating}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
            SC
          </div>
        </div>
      </div>
    </header>
  );
}

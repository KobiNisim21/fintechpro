import { t, useLanguage } from '@/i18n';
import { useEffect, useState } from 'react';
import { getConnectionState, onConnectionStateChange } from '../services/socket';

export function ConnectionStatus() {
    useLanguage();
  const [status, setStatus] = useState(getConnectionState());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsub = onConnectionStateChange((state) => {
      clearTimeout(timer);
      setStatus(state);
      setVisible(true);
      if (state === 'connected') {
        timer = setTimeout(() => setVisible(false), 3000);
      }
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  if (!visible && status === 'connected') return null;
  if (status === 'disconnected' && !visible) return null;

  const config = {
    connected: { color: 'bg-green-500', label: 'Live', ping: false },
    connecting: { color: 'bg-yellow-500', label: 'Connecting...', ping: true },
    reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting...', ping: true },
    disconnected: { color: 'bg-red-500', label: 'Offline', ping: false },
  }[status];

  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 md:bottom-4 end-4 z-[60]">
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-full px-3.5 py-1.5 flex items-center gap-2 border border-slate-200/50">
        <div className="relative flex h-2.5 w-2.5">
          {config.ping && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.color}`} />
        </div>
        <span className="text-xs font-medium text-slate-600">{t(config.label)}</span>
      </div>
    </div>
  );
}

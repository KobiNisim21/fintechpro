import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const [visible, setVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      setStatus('connected');
      setVisible(true);
      setTimeout(() => setVisible(false), 3000);
    };

    const onDisconnect = () => {
      setStatus('disconnected');
      setVisible(true);
    };

    const onReconnectAttempt = () => {
      setStatus('reconnecting');
      setVisible(true);
    };

    if (socket.connected) {
      onConnect();
    } else {
      onDisconnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
    };
  }, []);

  if (!visible && status === 'connected' && !detailsVisible) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end"
      onMouseEnter={() => setDetailsVisible(true)}
      onMouseLeave={() => setDetailsVisible(false)}
      onClick={() => setDetailsVisible(!detailsVisible)}
    >
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer border border-slate-200 transition-all">
        <div className="relative flex h-3 w-3">
          {status === 'reconnecting' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${
            status === 'connected' ? 'bg-green-500' :
            status === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></span>
        </div>
        
        {detailsVisible ? (
          <span className="text-sm font-medium text-slate-700">
            {status === 'connected' ? 'Live' : 
             status === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
          </span>
        ) : (
          <span className="text-sm font-medium text-slate-700">
            {status === 'connected' ? 'Live' : 
             status === 'reconnecting' ? 'Reconnecting' : 'Offline'}
          </span>
        )}
      </div>
    </div>
  );
}

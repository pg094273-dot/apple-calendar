import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:right-auto z-40 flex items-center justify-center sm:justify-start gap-2 rounded-2xl bg-[#1D1D1F] px-4 py-2.5 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
      <span>Modo sin conexión — Generación local .ics disponible</span>
    </div>
  );
};

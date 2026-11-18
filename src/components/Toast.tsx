import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(4.25rem+env(safe-area-inset-top,0px))] left-4 right-4 z-50 flex justify-center"
    >
      <div
        className={`flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl transition-all ${
          isError
            ? 'bg-[#B42318] text-white'
            : 'bg-[#1D1D1F] text-white'
        }`}
      >
        {isError ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
        )}
        <span className="leading-snug">{toast.text}</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1D1D1F] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-black active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-black/[0.04] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PlusSquare className="h-3.5 w-3.5 text-[#FF3B30]" aria-hidden="true" />
          <span>Añadir al iPhone</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/15 sm:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="ios-install-title"
                    className="font-display text-lg font-bold text-[#1D1D1F]"
                  >
                    Añadir a pantalla de inicio
                  </h3>
                  <p className="mt-1 text-sm text-[#6E6E73]">
                    Úsala como aplicación en tu iPhone sin barras de Safari y sin desplazamiento lateral.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar instrucciones"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5 text-[#1D1D1F] hover:bg-black/10 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-5 space-y-3 text-sm text-[#1D1D1F]">
                <li className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-bold text-white tabular-nums">
                    1
                  </span>
                  <span className="leading-snug">
                    Pulsa el botón <strong className="inline-flex items-center gap-1 font-semibold">Compartir <Share className="inline h-3.5 w-3.5 text-[#007AFF]" /></strong> en la barra inferior de Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-bold text-white tabular-nums">
                    2
                  </span>
                  <span className="leading-snug">
                    Desliza hacia abajo y selecciona <strong className="font-semibold">«Añadir a pantalla de inicio»</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-bold text-white tabular-nums">
                    3
                  </span>
                  <span className="leading-snug">
                    Toca <strong className="font-semibold">Añadir</strong> arriba a la derecha.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#1D1D1F] text-sm font-semibold text-white transition-colors hover:bg-black active:scale-[0.98] cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

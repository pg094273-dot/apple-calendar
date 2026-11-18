import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  Clock,
  Copy,
  Download,
  ExternalLink,
  History,
  MapPin,
  RotateCcw,
  Trash2,
  FileCode2,
  Check,
  Bell,
  Globe,
} from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Toast, ToastMessage } from './components/Toast';
import {
  ALARM_OPTIONS,
  COMMON_TIMEZONES,
  CalendarEventForm,
  SavedEventRecord,
  addMinutesToTime,
  buildICS,
  buildICSFilename,
  createDefaultForm,
  formatSpanishDate,
  validateEventForm,
} from './utils/ics';

const STORAGE_KEY = 'apple_calendar_creator_history_v1';

type MobileTab = 'form' | 'preview' | 'history';

export default function App() {
  const [form, setForm] = useState<CalendarEventForm>(() => createDefaultForm());
  const [mobileTab, setMobileTab] = useState<MobileTab>('form');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [history, setHistory] = useState<SavedEventRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedEventRecord[]) : [];
    } catch {
      return [];
    }
  });

  const toastTimerRef = useRef<number | null>(null);

  const showToast = (type: ToastMessage['type'], text: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, text });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors in private browsing
    }
  }, [history]);

  const timezoneOptions = useMemo(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && !COMMON_TIMEZONES.some((tz) => tz.value === detected)) {
      return [{ value: detected, label: `Zona detectada (${detected})` }, ...COMMON_TIMEZONES];
    }
    return COMMON_TIMEZONES;
  }, []);

  const icsResult = useMemo(() => {
    try {
      return { ok: true as const, content: buildICS(form) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Completa los campos obligatorios.',
      };
    }
  }, [form]);

  const updateField = <K extends keyof CalendarEventForm,>(
    key: K,
    value: CalendarEventForm[K]
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'date' && typeof value === 'string' && prev.endDate < value) {
        next.endDate = value;
      }
      return next;
    });
  };

  const applyDuration = (minutes: number) => {
    const start = form.startTime || '09:00';
    setForm((prev) => ({
      ...prev,
      startTime: start,
      endTime: addMinutesToTime(start, minutes),
    }));
  };

  const saveToHistory = (snapshot: CalendarEventForm) => {
    const record: SavedEventRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      form: snapshot,
    };
    setHistory((prev) => {
      const filtered = prev.filter(
        (item) =>
          !(
            item.form.title.trim() === snapshot.title.trim() &&
            item.form.date === snapshot.date &&
            item.form.startTime === snapshot.startTime
          )
      );
      return [record, ...filtered].slice(0, 8);
    });
  };

  const triggerBlobDownload = (icsContent: string, filename: string) => {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleDownloadICS = () => {
    const validationError = validateEventForm(form);
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    try {
      const icsContent = buildICS(form);
      const filename = buildICSFilename(form.title);
      triggerBlobDownload(icsContent, filename);
      saveToHistory(form);
      showToast('success', `Archivo ${filename} descargado.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'No se pudo generar el archivo.');
    }
  };

  const handleAddCalendar = async () => {
    const validationError = validateEventForm(form);
    if (validationError) {
      showToast('error', validationError);
      return;
    }

    try {
      const icsContent = buildICS(form);
      const filename = buildICSFilename(form.title);
      saveToHistory(form);

      const isIOS =
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOS) {
        const file = new File(
          [icsContent],
          filename,
          { type: 'text/calendar;charset=utf-8', lastModified: Date.now() }
        );

        // iOS solo permite entregar el archivo a Calendario mediante
        // una acción del usuario (hoja nativa de compartir).
        if (
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              title: form.title.trim(),
            });

            showToast(
              'success',
              'Archivo preparado. Si no se ha añadido, selecciona Calendario en la hoja de compartir.'
            );
            return;
          } catch (shareErr) {
            // Cerrar la hoja de compartir no debe iniciar una descarga.
            if (shareErr instanceof Error && shareErr.name === 'AbortError') {
              return;
            }

            console.error('No se pudo compartir el evento:', shareErr);
          }
        }

        // Compatibilidad con versiones/navegadores que no admiten
        // compartir archivos ICS.
        triggerBlobDownload(icsContent, filename);
        showToast(
          'success',
          'Tu navegador no permite compartir el evento directamente. Se ha preparado el archivo .ics.'
        );
        return;
      }

      // En Mac, Windows y otros dispositivos se conserva la descarga.
      triggerBlobDownload(icsContent, filename);
      showToast(
        'success',
        `Archivo ${filename} listo. Ábrelo para añadirlo a tu calendario.`
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'No se pudo crear el evento.'
      );
    }
  };

  const handleCopyICS = async () => {
    const validationError = validateEventForm(form);
    if (validationError) {
      showToast('error', validationError);
      return;
    }
    try {
      const icsContent = buildICS(form);
      await navigator.clipboard.writeText(icsContent);
      setCopied(true);
      showToast('success', 'Contenido .ics copiado al portapapeles.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'No se pudo acceder al portapapeles.');
    }
  };

  const handleReset = () => {
    setForm(createDefaultForm());
    showToast('success', 'Formulario restablecido.');
  };

  const loadFromHistory = (record: SavedEventRecord) => {
    setForm(record.form);
    setMobileTab('form');
    showToast('success', 'Evento cargado en el editor.');
  };

  const removeHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // Parse month/day for mini Apple Calendar visual badge
  const calendarBadge = useMemo(() => {
    if (!form.date) return { month: 'HOY', day: '--' };
    const [y, m, d] = form.date.split('-').map(Number);
    if (!y || !m || !d) return { month: 'HOY', day: '--' };
    const dt = new Date(y, m - 1, d);
    const month = new Intl.DateTimeFormat('es-ES', { month: 'short' })
      .format(dt)
      .replace('.', '')
      .toUpperCase();
    return { month, day: String(d) };
  }, [form.date]);

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-clip bg-[#F5F5F7] text-[#1D1D1F] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      {/* Compact Sticky Top Bar (<= 15% mobile viewport height) */}
      <header className="sticky top-0 z-30 w-full border-b border-black/[0.06] bg-[#F5F5F7]/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg shadow-xs"
            />
            <span className="font-display truncate text-base sm:text-lg font-bold tracking-tight text-[#1D1D1F]">
              Apple Calendar
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleReset}
              aria-label="Limpiar formulario"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-black/[0.05] px-3 py-2 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-black/[0.09] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>
      </header>

      <Toast toast={toast} />

      <main className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
        {/* Intro Heading */}
        <div className="mb-4 sm:mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] [text-wrap:balance]">
            Crear evento para Apple Calendar
          </h1>
          <p className="mt-1 text-sm sm:text-base text-[#6E6E73]">
            Genera eventos y archivos <code className="font-mono-code text-[0.9em] text-[#1D1D1F]">.ics</code> compatibles con iPhone, iPad y Mac.
          </p>
        </div>

        {/* Mobile Segmented Switcher (< lg) */}
        <div
          className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/[0.06] p-1 lg:hidden"
          role="tablist"
          aria-label="Vistas del creador"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'form'}
            onClick={() => setMobileTab('form')}
            className={`min-h-[40px] rounded-xl px-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              mobileTab === 'form'
                ? 'bg-white text-[#1D1D1F] shadow-xs'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            Formulario
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'preview'}
            onClick={() => setMobileTab('preview')}
            className={`min-h-[40px] rounded-xl px-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              mobileTab === 'preview'
                ? 'bg-white text-[#1D1D1F] shadow-xs'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            Vista .ICS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'history'}
            onClick={() => setMobileTab('history')}
            className={`min-h-[40px] rounded-xl px-2 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              mobileTab === 'history'
                ? 'bg-white text-[#1D1D1F] shadow-xs'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            Recientes ({history.length})
          </button>
        </div>

        {/* Main 2-Column Workspace on Desktop, Single Column on iPhone */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* LEFT COLUMN: Event Editor Form */}
          <section
            aria-label="Editor de evento"
            className={`min-w-0 lg:col-span-7 ${
              mobileTab === 'form' ? 'block' : 'hidden lg:block'
            }`}
          >
            <div className="rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-6 shadow-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Título */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="title"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    Título <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Ej. Reunión con cliente"
                    autoComplete="off"
                    className="min-h-[46px] w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>

                {/* Fecha */}
                <div className="min-w-0">
                  <label
                    htmlFor="date"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    Fecha <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] tabular-nums focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>

                {/* Tipo: Evento con horario / Todo el día */}
                <div className="min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]">
                    Tipo de evento
                  </span>
                  <div className="grid min-h-[46px] grid-cols-2 gap-1 rounded-xl bg-[#F5F5F7] p-1">
                    <button
                      type="button"
                      onClick={() => updateField('allDay', false)}
                      className={`min-h-[38px] rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        !form.allDay
                          ? 'bg-white text-[#1D1D1F] shadow-xs'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      Con horario
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('allDay', true)}
                      className={`min-h-[38px] rounded-lg px-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        form.allDay
                          ? 'bg-white text-[#1D1D1F] shadow-xs'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      Todo el día
                    </button>
                  </div>
                </div>

                {/* Horario o Fecha final */}
                {!form.allDay ? (
                  <div className="min-w-0 sm:col-span-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label
                          htmlFor="start"
                          className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                        >
                          Hora inicio
                        </label>
                        <input
                          id="start"
                          type="time"
                          value={form.startTime}
                          onChange={(e) => updateField('startTime', e.target.value)}
                          className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-base text-[#1D1D1F] tabular-nums focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                        />
                      </div>
                      <div className="min-w-0">
                        <label
                          htmlFor="end"
                          className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                        >
                          Hora fin
                        </label>
                        <input
                          id="end"
                          type="time"
                          value={form.endTime}
                          onChange={(e) => updateField('endTime', e.target.value)}
                          className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-base text-[#1D1D1F] tabular-nums focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                        />
                      </div>
                    </div>

                    {/* Quick Duration Buttons */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[#6E6E73]">Duración rápida:</span>
                      {[
                        { label: '+30 min', mins: 30 },
                        { label: '+1 h', mins: 60 },
                        { label: '+2 h', mins: 120 },
                        { label: '+3 h', mins: 180 },
                      ].map((preset) => (
                        <button
                          key={preset.mins}
                          type="button"
                          onClick={() => applyDuration(preset.mins)}
                          className="min-h-[34px] rounded-lg bg-[#F5F5F7] px-3 py-1 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-black/10 active:scale-[0.97] tabular-nums cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 sm:col-span-2">
                    <label
                      htmlFor="endDate"
                      className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                    >
                      Fecha final (incluida)
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      min={form.date}
                      value={form.endDate}
                      onChange={(e) => updateField('endDate', e.target.value)}
                      className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] tabular-nums focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                    />
                  </div>
                )}

                {/* Zona horaria (solo cuando hay horario) & Recordatorio */}
                {!form.allDay && (
                  <div className="min-w-0">
                    <label
                      htmlFor="timezone"
                      className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#1D1D1F]"
                    >
                      <Globe className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
                      <span>Zona horaria</span>
                    </label>
                    <select
                      id="timezone"
                      value={form.timezone}
                      onChange={(e) => updateField('timezone', e.target.value)}
                      className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-base text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                    >
                      {timezoneOptions.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={`min-w-0 ${form.allDay ? 'sm:col-span-2' : ''}`}>
                  <label
                    htmlFor="alarm"
                    className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#1D1D1F]"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#6E6E73]" aria-hidden="true" />
                    <span>Aviso</span>
                  </label>
                  <select
                    id="alarm"
                    value={form.alarmMinutes === null ? '' : String(form.alarmMinutes)}
                    onChange={(e) =>
                      updateField(
                        'alarmMinutes',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                    className="min-h-[46px] w-full min-w-0 rounded-xl border border-[#D2D2D7] bg-white px-3 py-2.5 text-base text-[#1D1D1F] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  >
                    {ALARM_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Calendario y Lugar */}
                <div className="min-w-0">
                  <label
                    htmlFor="calendar"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    Nombre del calendario
                  </label>
                  <input
                    id="calendar"
                    type="text"
                    value={form.calendar}
                    onChange={(e) => updateField('calendar', e.target.value)}
                    placeholder="Opcional (ej. Trabajo)"
                    className="min-h-[46px] w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="location"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    Lugar
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    placeholder="Dirección o sala"
                    className="min-h-[46px] w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>

                {/* URL */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="url"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    inputMode="url"
                    value={form.url}
                    onChange={(e) => updateField('url', e.target.value)}
                    placeholder="https://..."
                    className="min-h-[46px] w-full rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>

                {/* Notas */}
                <div className="min-w-0 sm:col-span-2">
                  <label
                    htmlFor="notes"
                    className="mb-1.5 block text-sm font-semibold text-[#1D1D1F]"
                  >
                    Notas
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Información adicional..."
                    className="min-h-[96px] w-full resize-y rounded-xl border border-[#D2D2D7] bg-white px-3.5 py-2.5 text-base text-[#1D1D1F] placeholder:text-[#86868B] focus:border-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#1D1D1F]/10"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAddCalendar}
                  className="sm:col-span-2 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1D1D1F] px-5 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.99] cursor-pointer"
                >
                  <CalendarPlus className="h-5 w-5 text-[#FF453A]" aria-hidden="true" />
                  <span>Añadir al calendario</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadICS}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#F2F2F7] px-4 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-colors hover:bg-[#E5E5EA] active:scale-[0.98] cursor-pointer"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Descargar .ICS</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyICS}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#F2F2F7] px-4 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-colors hover:bg-[#E5E5EA] active:scale-[0.98] cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>{copied ? 'Copiado' : 'Copiar ICS'}</span>
                </button>
              </div>
            </div>

            {/* Compatibility Notice */}
            <div className="mt-4 rounded-2xl border border-black/[0.06] bg-white p-4 text-xs sm:text-sm leading-relaxed text-[#6E6E73]">
              <strong className="font-semibold text-[#1D1D1F]">Cómo se añade en iPhone:</strong>{' '}
              pulsa «Añadir al calendario» y se abrirá la hoja nativa de compartir de iOS. Selecciona <strong className="font-medium text-[#1D1D1F]">Calendario</strong> para importar el archivo y confirmar el evento. iOS no permite que una página web abra directamente la ficha de importación sin esta intervención.
            </div>
          </section>

          {/* RIGHT COLUMN: Live Event Summary, ICS Code Preview & Recent History */}
          <aside className="min-w-0 space-y-5 lg:col-span-5">
            {/* Live Apple Calendar Sheet Preview + Raw ICS */}
            <div
              className={`space-y-4 ${
                mobileTab === 'preview' ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* Visual Event Summary Card */}
              <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 shadow-xs">
                <div className="flex items-start gap-4">
                  {/* Date Leaf Badge */}
                  <div className="flex h-14 w-14 shrink-0 flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white text-center shadow-2xs">
                    <div className="bg-[#FF3B30] py-0.5 text-[10px] font-bold tracking-wider text-white">
                      {calendarBadge.month}
                    </div>
                    <div className="flex flex-1 items-center justify-center font-display text-xl font-bold text-[#1D1D1F] tabular-nums">
                      {calendarBadge.day}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display truncate text-lg font-bold text-[#1D1D1F]">
                      {form.title.trim() || 'Nuevo evento'}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#6E6E73]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="tabular-nums">
                          {formatSpanishDate(form.date)}
                          {form.allDay
                            ? form.endDate && form.endDate > form.date
                              ? ` — ${formatSpanishDate(form.endDate)} · Todo el día`
                              : ' · Todo el día'
                            : ` · ${form.startTime || '--:--'}–${form.endTime || '--:--'}`}
                        </span>
                      </span>
                    </div>

                    {form.location.trim() && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#6E6E73]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
                        <span className="truncate">{form.location.trim()}</span>
                      </div>
                    )}

                    {(form.calendar.trim() || form.url.trim()) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E6E73]">
                        {form.calendar.trim() && (
                          <span>Calendario: {form.calendar.trim()}</span>
                        )}
                        {form.calendar.trim() && form.url.trim() && (
                          <span aria-hidden="true">·</span>
                        )}
                        {form.url.trim() && (
                          <span className="inline-flex items-center gap-1 truncate max-w-full">
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{form.url.trim()}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Raw ICS Preview */}
              <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-xs">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-[#6E6E73]" aria-hidden="true" />
                    <h3 className="font-display text-sm font-bold text-[#1D1D1F]">
                      Vista previa .ICS
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyICS}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#F5F5F7] px-2.5 py-1 text-xs font-semibold text-[#1D1D1F] hover:bg-black/10 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                {icsResult.ok ? (
                  <pre className="font-mono-code max-w-full overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl bg-[#F5F5F7] p-3.5 text-xs leading-relaxed text-[#1D1D1F]">
                    {icsResult.content}
                  </pre>
                ) : (
                  <div className="rounded-2xl bg-[#F5F5F7] p-4 text-sm text-[#6E6E73]">
                    {icsResult.error}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Events History */}
            <div
              className={`rounded-3xl border border-black/[0.06] bg-white p-5 shadow-xs ${
                mobileTab === 'history' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-[#6E6E73]" aria-hidden="true" />
                  <h3 className="font-display text-sm font-bold text-[#1D1D1F]">
                    Eventos recientes
                  </h3>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="text-xs font-medium text-[#6E6E73] hover:text-[#B42318] cursor-pointer"
                  >
                    Borrar todo
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="rounded-2xl bg-[#F5F5F7] p-4 text-xs sm:text-sm text-[#6E6E73]">
                  Los eventos que descargues o añadas al calendario aparecerán aquí para reutilizarlos sin conexión.
                </p>
              ) : (
                <ul className="divide-y divide-black/[0.06]">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <button
                        type="button"
                        onClick={() => loadFromHistory(item)}
                        className="min-w-0 flex-1 text-left cursor-pointer group"
                      >
                        <div className="truncate text-sm font-semibold text-[#1D1D1F] group-hover:text-[#FF3B30] transition-colors">
                          {item.form.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[#6E6E73] tabular-nums">
                          {formatSpanishDate(item.form.date)}
                          {item.form.allDay
                            ? ' · Todo el día'
                            : ` · ${item.form.startTime}–${item.form.endTime}`}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeHistoryItem(item.id)}
                        aria-label={`Eliminar ${item.form.title}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#86868B] hover:bg-red-50 hover:text-[#B42318] cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>

      <OfflineIndicator />
    </div>
  );
}

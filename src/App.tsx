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

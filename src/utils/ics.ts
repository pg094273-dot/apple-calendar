export interface CalendarEventForm {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  endDate: string;
  timezone: string;
  alarmMinutes: number | null;
  calendar: string;
  location: string;
  notes: string;
  url: string;
}

export interface SavedEventRecord {
  id: string;
  createdAt: string;
  form: CalendarEventForm;
}

export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'Europe/Madrid', label: 'España — Madrid (CET/CEST)' },
  { value: 'Atlantic/Canary', label: 'España — Canarias (WET/WEST)' },
  { value: 'Europe/London', label: 'Reino Unido — Londres' },
  { value: 'Europe/Paris', label: 'Francia — París' },
  { value: 'America/Mexico_City', label: 'México — Ciudad de México' },
  { value: 'America/Bogota', label: 'Colombia — Bogotá' },
  { value: 'America/Lima', label: 'Perú — Lima' },
  { value: 'America/Santiago', label: 'Chile — Santiago' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina — Buenos Aires' },
  { value: 'America/New_York', label: 'EE. UU. — Nueva York' },
  { value: 'UTC', label: 'UTC (Tiempo universal)' },
];

export const ALARM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Sin aviso' },
  { value: '0', label: 'A la hora del evento' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 día antes' },
];

const pad = (n: number): string => String(n).padStart(2, '0');

export function getTodayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function createDefaultForm(): CalendarEventForm {
  const today = getTodayISO();
  return {
    title: '',
    date: today,
    allDay: false,
    startTime: '09:00',
    endTime: '10:00',
    endDate: today,
    timezone: 'Europe/Madrid',
    alarmMinutes: 15,
    calendar: '',
    location: '',
    notes: '',
    url: '',
  };
}

function escapeICS(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function utcStamp(date: Date = new Date()): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function localDT(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-');
  const [h, min] = timeStr.split(':');
  return `${y}${m}${d}T${h}${min}00`;
}

function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function addMinutesToTime(timeStr: string, deltaMinutes: number): string {
  if (!timeStr || !timeStr.includes(':')) return '10:00';
  const [h, m] = timeStr.split(':').map(Number);
  const total = (h * 60 + m + deltaMinutes + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function validateEventForm(form: CalendarEventForm): string | null {
  if (!form.title.trim()) {
    return 'Indica al menos el título del evento.';
  }
  if (!form.date) {
    return 'Indica la fecha del evento.';
  }
  if (!form.allDay && !form.startTime) {
    return 'Indica la hora de inicio.';
  }
  return null;
}

export function buildICS(form: CalendarEventForm): string {
  const error = validateEventForm(form);
  if (error) {
    throw new Error(error);
  }

  const title = form.title.trim();
  const uid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}@applecalendarapp`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Calendar Event Creator//ES//',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  if (form.calendar.trim()) {
    lines.push(`X-WR-CALNAME:${escapeICS(form.calendar.trim())}`);
  }

  lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${utcStamp()}`);

  if (form.allDay) {
    const startCompact = form.date.replaceAll('-', '');
    const effectiveEndDate =
      form.endDate && form.endDate >= form.date ? form.endDate : form.date;
    const exclusiveEnd = addDaysISO(effectiveEndDate, 1).replaceAll('-', '');
    lines.push(`DTSTART;VALUE=DATE:${startCompact}`);
    lines.push(`DTEND;VALUE=DATE:${exclusiveEnd}`);
  } else {
    const startDT = localDT(form.date, form.startTime);
    const effectiveEndTime = form.endTime || form.startTime;
    const rollsOverMidnight = effectiveEndTime < form.startTime;
    const endDateStr = rollsOverMidnight ? addDaysISO(form.date, 1) : form.date;
    const endDT = localDT(endDateStr, effectiveEndTime);

    if (form.timezone === 'UTC') {
      lines.push(`DTSTART:${startDT}Z`);
      lines.push(`DTEND:${endDT}Z`);
    } else {
      lines.push(`DTSTART;TZID=${form.timezone}:${startDT}`);
      lines.push(`DTEND;TZID=${form.timezone}:${endDT}`);
    }
  }

  lines.push(`SUMMARY:${escapeICS(title)}`);

  if (form.location.trim()) {
    lines.push(`LOCATION:${escapeICS(form.location.trim())}`);
  }
  if (form.notes.trim()) {
    lines.push(`DESCRIPTION:${escapeICS(form.notes.trim())}`);
  }
  if (form.url.trim()) {
    lines.push(`URL:${escapeICS(form.url.trim())}`);
  }

  if (form.alarmMinutes !== null && !Number.isNaN(form.alarmMinutes)) {
    const trigger =
      form.alarmMinutes === 1440
        ? '-P1D'
        : `-PT${Math.max(0, form.alarmMinutes)}M`;
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(title)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function buildICSFilename(title: string): string {
  const cleaned = (title.trim() || 'Evento')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_');
  return `${cleaned.slice(0, 90)}.ics`;
}

export function formatSpanishDate(dateStr: string): string {
  if (!dateStr) return 'Sin fecha';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

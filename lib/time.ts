import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/constants";

// This module is used by client components too — it must never import lib/env.
export const TZ = APP_TIMEZONE;

/** dd-mm-yyyy hh:mm in IST (SRS §5.2). */
export function formatDateTime(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), TZ, "dd-MM-yyyy HH:mm");
}

export function formatDateTimeSeconds(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), TZ, "dd-MM-yyyy HH:mm:ss");
}

export function formatDate(d: Date | string | number | null | undefined): string {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), TZ, "dd-MM-yyyy");
}

/** Value for an <input type="datetime-local"> shown in IST. */
export function toDateTimeLocalValue(d: Date | null | undefined): string {
  if (!d) return "";
  return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm");
}

/** Parses an <input type="datetime-local"> value entered in IST into a UTC Date. */
export function fromDateTimeLocalValue(value: string): Date | null {
  if (!value) return null;
  const d = fromZonedTime(value, TZ);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** mm:ss for durations (SRS §3.7). */
export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

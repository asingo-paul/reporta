import { isValid, format } from 'date-fns';

/**
 * Formats a date value returned by the API (ISO string or Date) without ever
 * throwing. Missing/unparseable values render as "—" instead of crashing the
 * whole page with `RangeError: Invalid time value`.
 */
export function formatSafeDate(value, pattern = 'MMM d, yyyy') {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? format(date, pattern) : '—';
}
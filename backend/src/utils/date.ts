/**
 * Date utility for Asia/Bangkok (UTC+07:00) timezone calculations.
 */

const BANGKOK_TIMEZONE = 'Asia/Bangkok';

/**
 * Returns the calendar date string in format YYYY-MM-DD for the given timestamp
 * in the Asia/Bangkok timezone.
 *
 * @param at Optional ISO timestamp string or Date object. If omitted, uses current date/time.
 * @returns YYYY-MM-DD string
 */
export function getBangkokCalendarDate(at?: string | Date): string {
  let date: Date;

  if (at === undefined || at === null) {
    date = new Date();
  } else if (at instanceof Date) {
    date = at;
  } else if (typeof at === 'string') {
    const trimmed = at.trim();
    date = new Date(trimmed);
  } else {
    throw new Error(`Invalid date input: ${at}`);
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date string: '${at}'`);
  }

  // Format as YYYY-MM-DD in Asia/Bangkok
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(date);
}

/**
 * Checks if the calendar date today is strictly before startsOn (YYYY-MM-DD).
 */
export function isBeforeStartsOn(todayDate: string, startsOn: string): boolean {
  return todayDate < startsOn;
}

/**
 * Checks if the calendar date today is strictly after endsOn (YYYY-MM-DD, inclusive).
 */
export function isAfterEndsOn(todayDate: string, endsOn: string): boolean {
  return todayDate > endsOn;
}

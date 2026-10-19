// Journal dates are plain 'YYYY-MM-DD' strings end to end (see the DATE type parser in db/pool.js),
// so they never shift by a day because of time zones.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates such as 2026-02-30, which Date would roll over to March.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Today's date in UTC. The client normally sends its own local date; this is the fallback.
export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// '2026-10-14' -> 'Tuesday, 14 October 2026'
export function formatLongDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const rest = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${weekday}, ${rest}`;
}

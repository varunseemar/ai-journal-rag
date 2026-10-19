// '2026-10-14' -> 'Tue, 14 Oct 2026'. Parsed as UTC so the date never shifts by a day.
export function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

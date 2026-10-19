// Finds an explicit date or period in a question ("on 1 October", "yesterday", "last Sunday",
// "last week", "in September 2026") and resolves it against the user's today.
//
// Why: embeddings capture meaning, not exact values. "What did I eat on 1 October?" is
// semantically close to every food entry, whatever its date. Turning the date into a
// structured filter (entry_date BETWEEN from AND to) makes date questions precise.
//
// Pure function: no I/O, unit-tested in test/dateParser.test.js.
import { formatLongDate, isIsoDate } from '../../utils/dates.js';

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';

// ---- small helpers on 'YYYY-MM-DD' strings (UTC, so no time-zone shifts) ----
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m is 1-12
const yearOf = (isoDate) => Number(isoDate.slice(0, 4));
const monthOf = (isoDate) => Number(isoDate.slice(5, 7));
const monthNumber = (name) => MONTH_NAMES.findIndex((m) => m.startsWith(name.slice(0, 3))) + 1;
const weekdayOf = (isoDate) => new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const single = (isoDate) => ({ from: isoDate, to: isoDate });
const wholeMonth = (y, m) => ({ from: iso(y, m, 1), to: iso(y, m, lastDayOfMonth(y, m)) });
const mondayOf = (isoDate) => addDays(isoDate, -((weekdayOf(isoDate) + 6) % 7));

// A day + month without a year means its most recent occurrence: a journal looks back.
function recentDayMonth(day, month, today) {
  const thisYear = iso(yearOf(today), month, day);
  return thisYear <= today ? thisYear : iso(yearOf(today) - 1, month, day);
}

// Most recent month with that name ("in November" asked in October 2026 -> November 2025).
function recentMonth(month, today, modifier) {
  const y = yearOf(today);
  if (modifier === 'this') return wholeMonth(y, month);
  const isFuture = month > monthOf(today) || (modifier === 'last' && month === monthOf(today));
  return wholeMonth(isFuture ? y - 1 : y, month);
}

// Ordered from most to least specific; the first rule that matches wins.
const RULES = [
  [/\b(\d{4})-(\d{2})-(\d{2})\b/, ([, y, m, d]) => single(iso(+y, +m, +d))],
  [
    new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}\\b(?:,?\\s+(\\d{4}))?`),
    ([, d, mon, y], today) =>
      single(y ? iso(+y, monthNumber(mon), +d) : recentDayMonth(+d, monthNumber(mon), today)),
  ],
  [
    new RegExp(`\\b${MONTH}\\s+${DAY}\\b(?:,?\\s+(\\d{4}))?`),
    ([, mon, d, y], today) =>
      single(y ? iso(+y, monthNumber(mon), +d) : recentDayMonth(+d, monthNumber(mon), today)),
  ],
  [/\bday before yesterday\b/, (_, today) => single(addDays(today, -2))],
  [/\byesterday\b/, (_, today) => single(addDays(today, -1))],
  [/\b(?:today|tonight|this morning)\b/, (_, today) => single(today)],
  [/\b(\d{1,3}) days? ago\b/, ([, n], today) => single(addDays(today, -Number(n)))],
  [/\b(?:past|last) (?:7|seven) days\b/, (_, today) => ({ from: addDays(today, -6), to: today })],
  [
    /\blast week\b/,
    (_, today) => ({ from: addDays(mondayOf(today), -7), to: addDays(mondayOf(today), -1) }),
  ],
  [/\bthis week\b/, (_, today) => ({ from: mondayOf(today), to: today })],
  [
    new RegExp(`\\b(?:(last|this|on|past)\\s+)?(${WEEKDAYS.join('|')})\\b`),
    ([, modifier, name], today) => {
      let daysBack = (weekdayOf(today) - WEEKDAYS.indexOf(name) + 7) % 7;
      if (modifier === 'last' && daysBack === 0) daysBack = 7; // "last Sunday" on a Sunday
      return single(addDays(today, -daysBack));
    },
  ],
  [/\blast month\b/, (_, today) => {
    const m = monthOf(today);
    return m === 1 ? wholeMonth(yearOf(today) - 1, 12) : wholeMonth(yearOf(today), m - 1);
  }],
  [/\bthis month\b/, (_, today) => ({ from: iso(yearOf(today), monthOf(today), 1), to: today })],
  [new RegExp(`\\b${MONTH}\\s+(\\d{4})\\b`), ([, mon, y]) => wholeMonth(+y, monthNumber(mon))],
  [
    new RegExp(`\\b(in|during|last|this)\\s+${MONTH}\\b`),
    ([, modifier, mon], today) => recentMonth(monthNumber(mon), today, modifier),
  ],
  [/\blast year\b/, (_, today) => ({ from: `${yearOf(today) - 1}-01-01`, to: `${yearOf(today) - 1}-12-31` })],
  [/\bthis year\b/, (_, today) => ({ from: `${yearOf(today)}-01-01`, to: today })],
  [/\b(?:in|during) (\d{4})\b/, ([, y]) => ({ from: `${y}-01-01`, to: `${y}-12-31` })],
];

// Returns { from, to, phrase } or null when the question mentions no (valid) date.
export function parseDateRange(question, today) {
  const text = String(question).toLowerCase();
  for (const [pattern, resolve] of RULES) {
    const match = text.match(pattern);
    if (!match) continue;
    const range = resolve(match, today);
    // "31 February" and similar impossible dates are ignored rather than guessed.
    if (isIsoDate(range.from) && isIsoDate(range.to) && range.from <= range.to) {
      return { ...range, phrase: match[0].trim() };
    }
  }
  return null;
}

// 'Thursday, 1 October 2026' or 'Tuesday, 1 September 2026 to Wednesday, 30 September 2026'
export function describeRange({ from, to }) {
  return from === to ? formatLongDate(from) : `${formatLongDate(from)} to ${formatLongDate(to)}`;
}

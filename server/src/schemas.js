// Request schemas (zod), shared by the routes. One schema = validation + the cleaned value.
import { z } from 'zod';
import { isIsoDate } from './utils/dates.js';

const isoDate = z.string().refine(isIsoDate, 'Use a real date in YYYY-MM-DD format');

// ---------- email ----------
// Practical check: name@domain.tld, no spaces, no leading/trailing/double dots in the name,
// domain labels of letters/digits/hyphens, and a top-level domain of 2+ letters.
// (The client has the same regex for instant feedback; this one is authoritative.)
const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]+(?<!\.)@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_PATTERN.test(email);
}

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email')
  .refine(isValidEmail, 'Enter a valid email address, like name@example.com');

// ---------- password ----------
// Rules follow current guidance (NIST SP 800-63B): require length and block common or guessable
// passwords, rather than forcing "one uppercase + one symbol" composition rules.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'qwerty12', 'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'asdfghjk',
  'abc12345', 'abcd1234', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball',
  'welcome1', 'welcome123', 'letmein1', 'admin123', 'monkey123', 'superman', 'trustno1',
  'dragon12', 'starwars', 'whatever', 'india123', 'computer', 'internet',
]);

// bcrypt only uses the first 72 BYTES; emoji and non-Latin letters take several bytes each.
const byteLength = (text) => Buffer.byteLength(text, 'utf8');

// Returns the list of problems with a new password (empty array = acceptable).
export function passwordProblems(password, email = '') {
  const problems = [];
  if (password.length < 8) problems.push('Password must be at least 8 characters');
  if (byteLength(password) > 72) problems.push('Password is too long (max 72 bytes)');
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) problems.push('This password is too common. Choose another one');
  if (password.length > 0 && /^(.)\1+$/.test(password)) problems.push('Password cannot be one repeated character');
  const name = email.split('@')[0];
  if (name.length >= 4 && lower.includes(name)) problems.push('Password should not contain your email name');
  return problems;
}

// Sign-up: strict email + password rules.
export const signupSchema = z
  .object({ email: emailField, password: z.string() })
  .superRefine(({ email, password }, ctx) => {
    for (const message of passwordProblems(password, email)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message });
    }
  });

// Log-in: only check that both fields are present and sane. Strength rules don't apply here,
// and a wrong password must produce the generic "Invalid email or password".
export const loginSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, 'Enter your password')
    .refine((p) => byteLength(p) <= 72, 'Password is too long'),
});

// ---------- entries & chat ----------
export const entryBodySchema = z.object({
  content: z.string().trim().min(1, 'Entry cannot be empty').max(10_000),
  entryDate: isoDate.optional(),
});

export const entryIdSchema = z.object({
  id: z.string().uuid('Invalid entry id'),
});

export const chatBodySchema = z.object({
  question: z.string().trim().min(1, 'Ask a question').max(1_000),
  // The user's local date, so "yesterday" or "on Tuesday" are understood in their time zone.
  today: isoDate.optional(),
});

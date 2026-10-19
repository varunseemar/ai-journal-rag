// Instant feedback in the browser. These mirror the server's rules in server/src/schemas.js,
// but the SERVER is authoritative: anything checked here is checked again there.

const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]+(?<!\.)@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export function isValidEmail(email) {
  const value = email.trim().toLowerCase();
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword',
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
  'qwerty12', 'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'asdfghjk',
  'abc12345', 'abcd1234', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball',
  'welcome1', 'welcome123', 'letmein1', 'admin123', 'monkey123', 'superman', 'trustno1',
  'dragon12', 'starwars', 'whatever', 'india123', 'computer', 'internet',
]);

// First problem with a new password, or null if it meets the rules.
export function passwordProblem(password, email = '') {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (new TextEncoder().encode(password).length > 72) return 'Password is too long (max 72 bytes)';
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'This password is too common. Choose another one';
  if (/^(.)\1+$/.test(password)) return 'Password cannot be one repeated character';
  const name = email.trim().toLowerCase().split('@')[0];
  if (name.length >= 4 && lower.includes(name)) return 'Password should not contain your email name';
  return null;
}

// 0-4 score for the strength meter. Length matters most; variety of characters helps.
export function passwordStrength(password, email = '') {
  if (!password) return { score: 0, label: '' };
  if (passwordProblem(password, email)) return { score: 0, label: 'Too weak' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (classes >= 3) score += 1;
  if (password.length >= 16 || (password.length >= 12 && classes === 4)) score += 1;
  return { score, label: ['Too weak', 'Okay', 'Good', 'Strong', 'Very strong'][score] };
}

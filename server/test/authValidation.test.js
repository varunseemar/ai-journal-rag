import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidEmail, passwordProblems, signupSchema } from '../src/schemas.js';

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    for (const email of ['name@example.com', 'first.last+tag@mail.co.in', 'a_b-c@sub.domain.org']) {
      assert.ok(isValidEmail(email), email);
    }
  });

  it('rejects malformed addresses', () => {
    for (const email of [
      '', 'plainaddress', 'name@', '@example.com', 'name@example', 'name@example.c',
      'name @example.com', 'name..dots@example.com', '.name@example.com', 'name.@example.com',
      'name@-example.com', 'name@example..com', 'name@exam_ple.com',
    ]) {
      assert.ok(!isValidEmail(email), `should reject: "${email}"`);
    }
  });
});

describe('passwordProblems', () => {
  it('accepts a reasonable password', () => {
    assert.deepEqual(passwordProblems('correct-horse-battery', 'riya@example.com'), []);
  });

  it('rejects short, common, repeated and email-based passwords', () => {
    assert.ok(passwordProblems('abc123').some((p) => p.includes('at least 8')));
    assert.ok(passwordProblems('Password123').some((p) => p.includes('too common')));
    assert.ok(passwordProblems('aaaaaaaaaa').some((p) => p.includes('repeated')));
    assert.ok(passwordProblems('riyasharma2026', 'riyasharma@example.com').some((p) => p.includes('email name')));
  });

  it('measures the 72 limit in bytes, not characters', () => {
    const emoji = '😀'.repeat(20); // 20 characters, 80 bytes
    assert.ok(passwordProblems(emoji).some((p) => p.includes('max 72 bytes')));
  });
});

describe('signupSchema', () => {
  it('normalises the email and reports field errors', () => {
    const ok = signupSchema.safeParse({ email: '  Riya@Example.COM ', password: 'correct-horse-battery' });
    assert.ok(ok.success);
    assert.equal(ok.data.email, 'riya@example.com');

    const bad = signupSchema.safeParse({ email: 'riya@example', password: 'password' });
    const fields = bad.error.flatten().fieldErrors;
    assert.ok(fields.email);
    assert.ok(fields.password);
  });
});

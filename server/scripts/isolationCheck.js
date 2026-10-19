// End-to-end proof of data isolation, run against a live server:
//   npm run check:isolation            (API_URL defaults to http://localhost:4000)
//
// Creates two fresh users. A writes a secret, B writes something unrelated.
// Then checks that B can't retrieve A's secret through chat and can't read, edit or delete
// A's entry through the API, while A can retrieve it.
const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const SECRET = `PINEAPPLE-${Math.floor(Math.random() * 9000) + 1000}`;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

let failures = 0;
function check(condition, label) {
  console.log(`${condition ? green('PASS') : red('FAIL')} ${label}`);
  if (!condition) failures += 1;
}

async function call(method, path, token, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

async function signup(label) {
  const email = `isolation-${label}-${Date.now()}@example.com`;
  const { status, data } = await call('POST', '/api/auth/signup', null, { email, password: 'correct-horse-battery' });
  if (status !== 201) throw new Error(`Signup failed for ${label}: ${status} ${JSON.stringify(data)}`);
  return data.token;
}

// Reads the SSE stream from /api/chat into { sources, answer, error }.
async function ask(token, question) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  });
  const text = await res.text();
  const result = { sources: [], answer: '', error: null };
  for (const block of text.split('\n\n')) {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (!event || !data) continue;
    const payload = JSON.parse(data);
    if (event === 'sources') result.sources = payload;
    if (event === 'token') result.answer += payload.t;
    if (event === 'error') result.error = payload.message;
  }
  return result;
}

console.log(`Isolation check against ${API_URL} (secret: ${SECRET})\n`);

const tokenA = await signup('a');
const tokenB = await signup('b');

const { data: created } = await call('POST', '/api/entries', tokenA, {
  content: `My secret code word for the locker is ${SECRET}. Do not tell anyone.`,
});
const entryA = created.entry;
await call('POST', '/api/entries', tokenB, { content: 'Drank masala chai and read a novel in the evening.' });

// 1. Retrieval: B asks for A's secret.
const answerB = await ask(tokenB, 'What is my secret code word for the locker?');
check(answerB.sources.every((s) => s.entryId !== entryA.id), "B's chat sources never include A's entry");
check(!answerB.answer.includes(SECRET), "B's chat answer does not contain A's secret");

// 2. Retrieval: A asks for their own secret.
const answerA = await ask(tokenA, 'What is my secret code word for the locker?');
check(answerA.sources.some((s) => s.entryId === entryA.id), "A's chat sources include A's entry");
if (answerA.error) {
  console.log(yellow(`note: the LLM call failed for A (${answerA.error}); retrieval checks still apply`));
} else if (!answerA.answer.includes(SECRET)) {
  console.log(yellow("note: A's answer didn't quote the secret word-for-word (model wording), retrieval was correct"));
}

// 3. CRUD: B tries to read, edit and delete A's entry by id.
const listB = await call('GET', '/api/entries', tokenB);
check(listB.data.entries.every((e) => e.id !== entryA.id), "B's entry list does not include A's entry");
const putB = await call('PUT', `/api/entries/${entryA.id}`, tokenB, { content: 'hacked' });
check(putB.status === 404, `B updating A's entry -> 404 (got ${putB.status})`);
const delB = await call('DELETE', `/api/entries/${entryA.id}`, tokenB);
check(delB.status === 404, `B deleting A's entry -> 404 (got ${delB.status})`);

// 4. A's entry is untouched.
const listA = await call('GET', '/api/entries', tokenA);
const stillThere = listA.data.entries.find((e) => e.id === entryA.id);
check(stillThere?.content.includes(SECRET), "A's entry is unchanged after B's attempts");

// 5. No token / forged token.
check((await call('GET', '/api/entries', null)).status === 401, 'No token -> 401');
check((await call('GET', '/api/entries', `${tokenA}x`)).status === 401, 'Tampered token -> 401');

console.log(failures === 0 ? green('\nISOLATION CHECK PASSED') : red(`\nISOLATION CHECK FAILED (${failures})`));
process.exitCode = failures === 0 ? 0 : 1;

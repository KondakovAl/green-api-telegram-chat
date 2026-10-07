import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_SESSION_STORAGE_KEY,
  createEmptySession,
  readChatSession,
  saveChatSession,
} from '../src/features/session/sessionStorage.ts';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function connectedSession() {
  return {
    credentials: {
      apiUrl: 'https://api.example.com',
      idInstance: '123456',
      apiTokenInstance: 'test-token',
    },
    chats: [
      { chatId: '101', name: 'Alice' },
      { chatId: '202', name: 'Bob' },
    ],
    activeChatId: '202',
    messagesByChat: {
      101: [{ id: 'alice-1', direction: 'outgoing', text: 'Hello Alice', sentAt: 123, status: 'sent' }],
      202: [{ id: 'bob-1', direction: 'incoming', text: 'Hello from Bob', sentAt: 456, status: 'sent' }],
    },
  };
}

test('restores two separate conversations, credentials, and the selected chat after reload', () => {
  const storage = memoryStorage();
  const session = connectedSession();
  assert.equal(saveChatSession(session, storage), true);
  assert.deepEqual(readChatSession(storage), session);

  session.activeChatId = '101';
  assert.equal(saveChatSession(session, storage), true);
  assert.equal(readChatSession(storage).activeChatId, '101');
  assert.deepEqual(readChatSession(storage).messagesByChat, session.messagesByChat);
});

test('disconnect removes only the application session and prevents restoring credentials or chats', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated', 'keep me');
  saveChatSession(connectedSession(), storage);

  assert.equal(saveChatSession(createEmptySession(), storage), true);
  assert.equal(storage.getItem(CHAT_SESSION_STORAGE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep me');
  assert.deepEqual(readChatSession(storage), createEmptySession());
});

test('empty sessions are independent instances', () => {
  const first = createEmptySession();
  first.chats.push({ chatId: '101', name: 'Alice' });
  assert.deepEqual(createEmptySession().chats, []);
});

test('malformed JSON, unknown versions, invalid credentials and broken chat references restore safely', async (t) => {
  const cases = [
    ['malformed JSON', '{'],
    ['null snapshot', 'null'],
    ['old version', JSON.stringify({ version: 0, session: connectedSession() })],
    ['missing version', JSON.stringify({ session: connectedSession() })],
  ];
  const invalidSessions = [
    ['insecure API URL', (session) => { session.credentials.apiUrl = 'http://api.example.com'; }],
    ['invalid API URL', (session) => { session.credentials.apiUrl = 'not-a-url'; }],
    ['invalid instance ID', (session) => { session.credentials.idInstance = 'abc'; }],
    ['empty token', (session) => { session.credentials.apiTokenInstance = ' '; }],
    ['unknown selected chat', (session) => { session.activeChatId = 'missing'; }],
    ['unknown messages chat', (session) => { session.messagesByChat.missing = []; }],
    ['duplicate chat IDs', (session) => { session.chats.push(session.chats[0]); }],
    ['invalid message status', (session) => { session.messagesByChat[101][0].status = 'unknown'; }],
    ['invalid message timestamp', (session) => { session.messagesByChat[101][0].sentAt = 'yesterday'; }],
    ['timestamp outside Date range', (session) => { session.messagesByChat[101][0].sentAt = 1e20; }],
    ['duplicate message IDs', (session) => { session.messagesByChat[101].push(session.messagesByChat[101][0]); }],
    ['invalid chat shape', (session) => { session.chats[0].name = 123; }],
  ];
  for (const [name, mutate] of invalidSessions) {
    const session = connectedSession();
    mutate(session);
    cases.push([name, JSON.stringify({ version: 1, session })]);
  }

  for (const [name, snapshot] of cases) {
    await t.test(name, () => {
      const storage = memoryStorage();
      storage.setItem(CHAT_SESSION_STORAGE_KEY, snapshot);
      assert.deepEqual(readChatSession(storage), createEmptySession());
    });
  }
});

test('denied storage and quota errors never crash the application', () => {
  const deniedStorage = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  assert.deepEqual(readChatSession(deniedStorage), createEmptySession());
  assert.equal(saveChatSession(connectedSession(), deniedStorage), false);
  assert.equal(saveChatSession(createEmptySession(), deniedStorage), false);

  const storage = memoryStorage();
  const original = connectedSession();
  saveChatSession(original, storage);
  const quotaStorage = { ...storage, setItem() { throw new Error('QuotaExceededError'); } };
  const changed = connectedSession();
  changed.activeChatId = '101';
  assert.equal(saveChatSession(changed, quotaStorage), false);
  assert.deepEqual(readChatSession(storage), original);
});

test('accessing unavailable default browser storage is handled safely', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { get sessionStorage() { throw new Error('SecurityError'); } },
    });
    assert.deepEqual(readChatSession(), createEmptySession());
    assert.equal(saveChatSession(connectedSession()), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else delete globalThis.window;
  }
});

test('pending outgoing messages recover as failed with an explicit unknown-result explanation', () => {
  const storage = memoryStorage();
  const session = connectedSession();
  session.messagesByChat[101][0].status = 'sending';
  assert.equal(saveChatSession(session, storage), true);
  assert.equal(session.messagesByChat[101][0].status, 'sending');

  const recovered = readChatSession(storage);
  assert.equal(recovered.messagesByChat[101][0].status, 'failed');
  assert.match(recovered.messagesByChat[101][0].error, /Результат отправки неизвестен/);
  assert.match(recovered.messagesByChat[101][0].error, /Проверьте Telegram перед повторной отправкой/);
  assert.deepEqual(recovered.messagesByChat[202], session.messagesByChat[202]);

  assert.equal(saveChatSession(recovered, storage), true);
  assert.deepEqual(readChatSession(storage), recovered);
});

test('writes and reads only known application fields', () => {
  const storage = memoryStorage();
  const session = connectedSession();
  const expected = structuredClone(session);
  session.extra = 'not persisted';
  session.credentials.extra = 'not persisted';
  session.chats[0].extra = 'not persisted';
  session.messagesByChat[101][0].extra = 'not persisted';
  assert.equal(saveChatSession(session, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(CHAT_SESSION_STORAGE_KEY)).session, expected);

  storage.setItem(CHAT_SESSION_STORAGE_KEY, JSON.stringify({ version: 1, session }));
  assert.deepEqual(readChatSession(storage), expected);
});

test('rejects invalid in-memory snapshots without overwriting the existing session', () => {
  const storage = memoryStorage();
  const original = connectedSession();
  saveChatSession(original, storage);
  const invalid = connectedSession();
  invalid.activeChatId = 'missing';
  assert.equal(saveChatSession(invalid, storage), false);
  assert.deepEqual(readChatSession(storage), original);
});

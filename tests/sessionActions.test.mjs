import assert from 'node:assert/strict';
import test from 'node:test';
import { removeChatFromSession } from '../src/features/session/sessionActions.ts';
import { readChatSession, saveChatSession } from '../src/features/session/sessionStorage.ts';

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
      { chatId: '303', name: 'Charlie' },
    ],
    activeChatId: '202',
    messagesByChat: {
      101: [{ id: 'alice-1', direction: 'outgoing', text: 'Hello Alice', sentAt: 123, status: 'sent' }],
      202: [{ id: 'bob-1', direction: 'incoming', text: 'Hello from Bob', sentAt: 456, status: 'sent' }],
      303: [{ id: 'charlie-1', direction: 'incoming', text: 'Hello from Charlie', sentAt: 789, status: 'sent' }],
    },
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  return Object.freeze(value);
}

test('deleting the active chat selects the first remaining chat and preserves other histories', () => {
  const session = connectedSession();
  const result = removeChatFromSession(session, '202');

  assert.deepEqual(result.chats, [session.chats[0], session.chats[2]]);
  assert.equal(result.activeChatId, '101');
  assert.deepEqual(Object.keys(result.messagesByChat), ['101', '303']);
  assert.equal(result.messagesByChat[101], session.messagesByChat[101]);
  assert.equal(result.messagesByChat[303], session.messagesByChat[303]);
  assert.equal(result.credentials, session.credentials);
});

test('deleting an inactive chat keeps the current selection', () => {
  const session = connectedSession();
  const result = removeChatFromSession(session, '101');

  assert.deepEqual(result.chats, session.chats.slice(1));
  assert.equal(result.activeChatId, '202');
  assert.deepEqual(Object.keys(result.messagesByChat), ['202', '303']);
});

test('deleting the last chat clears its selection and messages but keeps the connection', () => {
  const session = connectedSession();
  session.chats = [session.chats[1]];
  session.messagesByChat = { 202: session.messagesByChat[202] };

  assert.deepEqual(removeChatFromSession(session, '202'), {
    credentials: session.credentials,
    chats: [],
    activeChatId: null,
    messagesByChat: {},
  });
});

test('deleting an unknown chat returns the original session', () => {
  const session = connectedSession();
  assert.equal(removeChatFromSession(session, 'missing'), session);
});

test('deleting a chat does not mutate the original session or its nested data', () => {
  const session = deepFreeze(connectedSession());
  const before = structuredClone(session);
  const result = removeChatFromSession(session, '202');

  assert.deepEqual(session, before);
  assert.notEqual(result, session);
  assert.notEqual(result.chats, session.chats);
  assert.notEqual(result.messagesByChat, session.messagesByChat);
});

test('saving and restoring deletions never brings back chats or their messages', () => {
  const storage = memoryStorage();
  let session = connectedSession();
  assert.equal(saveChatSession(session, storage), true);

  for (const chatId of ['202', '101', '303']) {
    session = removeChatFromSession(session, chatId);
    assert.equal(saveChatSession(session, storage), true);
    const restored = readChatSession(storage);
    assert.deepEqual(restored, session);
    assert.equal(restored.chats.some((chat) => chat.chatId === chatId), false);
    assert.equal(Object.hasOwn(restored.messagesByChat, chatId), false);
  }

  assert.equal(readChatSession(storage).activeChatId, null);
  assert.deepEqual(readChatSession(storage).chats, []);
});

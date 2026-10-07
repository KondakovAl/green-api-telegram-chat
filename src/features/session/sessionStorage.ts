import type { GreenApiCredentials } from '../../api/types';
import type { ChatContact, ChatMessage } from '../chat/types';

export interface ChatSession {
  credentials: GreenApiCredentials | null;
  chats: ChatContact[];
  activeChatId: string | null;
  messagesByChat: Record<string, ChatMessage[]>;
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const CHAT_SESSION_STORAGE_KEY = 'green-api:chat-session';
const SNAPSHOT_VERSION = 1;
const INTERRUPTED_MESSAGE_ERROR =
  'Результат отправки неизвестен: страница была перезагружена. Проверьте Telegram перед повторной отправкой.';

export function createEmptySession(): ChatSession {
  return { credentials: null, chats: [], activeChatId: null, messagesByChat: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readCredentials(value: unknown): GreenApiCredentials | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.apiUrl) ||
    !isNonEmptyString(value.idInstance) ||
    !/^\d+$/.test(value.idInstance.trim()) ||
    !isNonEmptyString(value.apiTokenInstance)
  ) {
    return null;
  }

  try {
    if (new URL(value.apiUrl).protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return {
    apiUrl: value.apiUrl.trim(),
    idInstance: value.idInstance.trim(),
    apiTokenInstance: value.apiTokenInstance.trim(),
  };
}

function readMessage(value: unknown, recoverSending: boolean): ChatMessage | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    (value.direction !== 'incoming' && value.direction !== 'outgoing') ||
    typeof value.text !== 'string' ||
    typeof value.sentAt !== 'number' ||
    !Number.isFinite(value.sentAt) ||
    value.sentAt < 0 ||
    Number.isNaN(new Date(value.sentAt).getTime()) ||
    (value.status !== 'sending' && value.status !== 'sent' && value.status !== 'failed') ||
    (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return null;
  }

  const interrupted = recoverSending && value.direction === 'outgoing' && value.status === 'sending';
  return {
    id: value.id,
    direction: value.direction,
    text: value.text,
    sentAt: value.sentAt,
    status: interrupted ? 'failed' : value.status,
    ...(interrupted
      ? { error: INTERRUPTED_MESSAGE_ERROR }
      : value.error !== undefined
        ? { error: value.error }
        : {}),
  };
}

function readSession(value: unknown, recoverSending: boolean): ChatSession | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.chats) ||
    !isRecord(value.messagesByChat)
  ) {
    return null;
  }

  const credentials = readCredentials(value.credentials);
  if (!credentials) return null;

  const chats: ChatContact[] = [];
  const chatIds = new Set<string>();
  for (const chat of value.chats) {
    if (
      !isRecord(chat) ||
      !isNonEmptyString(chat.chatId) ||
      !isNonEmptyString(chat.name) ||
      chatIds.has(chat.chatId)
    ) {
      return null;
    }
    chatIds.add(chat.chatId);
    chats.push({ chatId: chat.chatId, name: chat.name });
  }

  const activeChatId = value.activeChatId;
  if (activeChatId !== null && (typeof activeChatId !== 'string' || !chatIds.has(activeChatId))) {
    return null;
  }

  const entries: [string, ChatMessage[]][] = [];
  for (const [chatId, values] of Object.entries(value.messagesByChat)) {
    if (!chatIds.has(chatId) || !Array.isArray(values)) return null;

    const messages: ChatMessage[] = [];
    const messageIds = new Set<string>();
    for (const value of values) {
      const message = readMessage(value, recoverSending);
      if (!message || messageIds.has(message.id)) return null;
      messageIds.add(message.id);
      messages.push(message);
    }
    entries.push([chatId, messages]);
  }

  return { credentials, chats, activeChatId, messagesByChat: Object.fromEntries(entries) };
}

export function readChatSession(storage?: SessionStorage): ChatSession {
  try {
    const sessionStorage = storage ?? window.sessionStorage;
    const stored = sessionStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (stored === null) return createEmptySession();

    const snapshot: unknown = JSON.parse(stored);
    if (isRecord(snapshot) && snapshot.version === SNAPSHOT_VERSION) {
      const session = readSession(snapshot.session, true);
      if (session) return session;
    }
  } catch {
    // Storage can be disabled, unavailable, or contain an incomplete snapshot.
  }
  return createEmptySession();
}

export function saveChatSession(session: ChatSession, storage?: SessionStorage): boolean {
  try {
    const sessionStorage = storage ?? window.sessionStorage;
    if (session.credentials === null) {
      sessionStorage.removeItem(CHAT_SESSION_STORAGE_KEY);
      return true;
    }

    const snapshot = readSession(session, false);
    if (!snapshot) return false;
    sessionStorage.setItem(
      CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: SNAPSHOT_VERSION, session: snapshot }),
    );
    return true;
  } catch {
    return false;
  }
}

import type { ChatSession } from './sessionStorage';

export function removeChatFromSession(session: ChatSession, chatId: string): ChatSession {
  if (!session.chats.some((chat) => chat.chatId === chatId)) return session;

  const chats = session.chats.filter((chat) => chat.chatId !== chatId);
  const messagesByChat = { ...session.messagesByChat };
  delete messagesByChat[chatId];

  return {
    ...session,
    chats,
    messagesByChat,
    activeChatId: session.activeChatId === chatId
      ? chats[0]?.chatId ?? null
      : session.activeChatId,
  };
}

import { useCallback, useRef, useState } from 'react';
import { readChatSession, saveChatSession, type ChatSession } from './sessionStorage';

export function useChatSession() {
  const [session, setSession] = useState(readChatSession);
  const currentSession = useRef(session);
  const [storageError, setStorageError] = useState<string | null>(null);

  const updateSession = useCallback((update: (current: ChatSession) => ChatSession) => {
    const nextSession = update(currentSession.current);
    if (nextSession === currentSession.current) return;

    currentSession.current = nextSession;
    const saved = saveChatSession(nextSession);
    setSession(nextSession);
    setStorageError(
      saved
        ? null
        : 'Не удалось сохранить сессию в этой вкладке. После перезагрузки последние изменения могут потеряться.',
    );
  }, []);

  return { session, updateSession, storageError };
}

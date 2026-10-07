import { useCallback, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconBolt,
  IconBrandTelegram,
  IconCheck,
  IconPlus,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { createGreenApiClient, GreenApiError } from '../api/greenApi';
import type { GreenApiCredentials } from '../api/types';
import { ChatRoom } from '../features/chat/ChatRoom';
import { DeleteChatModal } from '../features/chat/DeleteChatModal';
import { NewChatModal } from '../features/chat/NewChatModal';
import type { ChatContact, ChatMessage, PollStatus } from '../features/chat/types';
import { useIncomingMessages } from '../features/chat/useIncomingMessages';
import { useSendMessage } from '../features/chat/useSendMessage';
import { ConnectionModal } from '../features/connection/ConnectionModal';
import { createEmptySession } from '../features/session/sessionStorage';
import { removeChatFromSession } from '../features/session/sessionActions';
import { useChatSession } from '../features/session/useChatSession';

function isSameInstance(
  left: GreenApiCredentials | null,
  right: GreenApiCredentials | null,
): boolean {
  return Boolean(
    left && right &&
    left.idInstance === right.idInstance &&
    left.apiUrl.replace(/\/+$/, '') === right.apiUrl.replace(/\/+$/, ''),
  );
}

export function App() {
  const { session, updateSession, storageError } = useChatSession();
  const { credentials, chats, activeChatId, messagesByChat } = session;
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle');
  const [pollError, setPollError] = useState<string | null>(null);
  const [connectionOpened, setConnectionOpened] = useState(false);
  const [newChatOpened, setNewChatOpened] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatContact | null>(null);

  const client = useMemo(
    () => (credentials ? createGreenApiClient(credentials) : null),
    [credentials],
  );
  const activeChat = chats.find((chat) => chat.chatId === activeChatId) ?? null;
  const messages = activeChatId ? messagesByChat[activeChatId] ?? [] : [];
  const sendMessageMutation = useSendMessage(client);

  const updateChatMessages = useCallback((
    chatId: string,
    update: (current: ChatMessage[]) => ChatMessage[],
  ) => {
    updateSession((current) => {
      if (!isSameInstance(current.credentials, credentials)) return current;
      if (!current.chats.some((chat) => chat.chatId === chatId)) return current;

      const previousMessages = current.messagesByChat[chatId] ?? [];
      const nextMessages = update(previousMessages);
      if (nextMessages === previousMessages) return current;

      return {
        ...current,
        messagesByChat: { ...current.messagesByChat, [chatId]: nextMessages },
      };
    });
  }, [credentials, updateSession]);

  const receiveMessage = useCallback((chatId: string, message: ChatMessage) => {
    updateChatMessages(chatId, (current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message];
    });
  }, [updateChatMessages]);

  useIncomingMessages(
    client,
    receiveMessage,
    setPollStatus,
    setPollError,
  );

  const handleSaveConnection = (nextCredentials: GreenApiCredentials) => {
    setChatToDelete(null);
    updateSession((current) => ({
      ...(isSameInstance(current.credentials, nextCredentials) ? current : createEmptySession()),
      credentials: nextCredentials,
    }));
    setPollError(null);
    setConnectionOpened(false);
  };

  const handleDisconnect = () => {
    setChatToDelete(null);
    updateSession(createEmptySession);
    setPollStatus('idle');
    setPollError(null);
    setConnectionOpened(false);
    setNewChatOpened(false);
  };

  const handleChatCreated = (chat: ChatContact) => {
    updateSession((current) => {
      if (!credentials || current.credentials !== credentials) return current;

      return {
        ...current,
        chats: [chat, ...current.chats.filter((item) => item.chatId !== chat.chatId)],
        activeChatId: chat.chatId,
      };
    });
  };

  const handleDeleteChat = () => {
    if (!chatToDelete) return;

    updateSession((current) => removeChatFromSession(current, chatToDelete.chatId));
    setChatToDelete(null);
  };

  const handleSend = async (text: string) => {
    if (!client || !activeChat) return;

    const chatId = activeChat.chatId;
    const localId = `local-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: localId,
      direction: 'outgoing',
      text,
      sentAt: Date.now(),
      status: 'sending',
    };
    updateChatMessages(chatId, (current) => [...current, optimisticMessage]);

    try {
      const result = await sendMessageMutation.mutateAsync({
        chatId,
        message: text,
      });
      updateChatMessages(chatId, (current) =>
        current.map((message) =>
          message.id === localId
            ? { ...message, id: result.idMessage, status: 'sent' }
            : message,
        ),
      );
    } catch (error) {
      updateChatMessages(chatId, (current) =>
        current.map((message) =>
          message.id === localId
            ? {
                ...message,
                status: 'failed',
                error:
                  error instanceof GreenApiError
                    ? error.message
                    : 'Не удалось отправить сообщение',
              }
            : message,
        ),
      );
    }
  };

  const handleRetry = async (failedMessage: ChatMessage) => {
    if (!client || !activeChat) return;

    const chatId = activeChat.chatId;
    updateChatMessages(chatId, (current) =>
      current.map((message) =>
        message.id === failedMessage.id
          ? { ...message, status: 'sending', error: undefined }
          : message,
      ),
    );

    try {
      const result = await sendMessageMutation.mutateAsync({
        chatId,
        message: failedMessage.text,
      });
      updateChatMessages(chatId, (current) =>
        current.map((message) =>
          message.id === failedMessage.id
            ? { ...message, id: result.idMessage, status: 'sent', error: undefined }
            : message,
        ),
      );
    } catch (error) {
      updateChatMessages(chatId, (current) =>
        current.map((message) =>
          message.id === failedMessage.id
            ? {
                ...message,
                status: 'failed',
                error:
                  error instanceof GreenApiError
                    ? error.message
                    : 'Не удалось отправить сообщение',
              }
            : message,
        ),
      );
    }
  };

  const pollingIsHealthy = pollStatus === 'online';

  return (
    <main className="app-root">
      <header className="topbar">
        <a className="brand-lockup" href="https://green-api.com/telegram" target="_blank" rel="noreferrer">
          <span className="brand-mark" aria-hidden="true">
            <IconBolt size={24} fill="currentColor" stroke={1.7} />
          </span>
          <span className="brand-copy">
            <span className="brand-name">GREEN-API</span>
            <span className="brand-product">Telegram чат</span>
          </span>
        </a>

        <Group gap="sm" wrap="nowrap">
          {credentials ? (
            <Badge
              className="connection-badge"
              color={pollingIsHealthy ? 'green' : 'gray'}
              variant="light"
              leftSection={<span className={`status-dot status-dot-${pollStatus}`} />}
              radius="xl"
            >
              {activeChat ? (pollingIsHealthy ? 'Приём активен' : 'Подключение настроено') : 'Инстанс настроен'}
            </Badge>
          ) : (
            <Badge color="gray" variant="light" radius="xl">
              Нет подключения
            </Badge>
          )}
          <Tooltip label={credentials ? 'Настройки подключения' : 'Подключить GREEN-API'}>
            <ActionIcon
              variant="default"
              radius="xl"
              size={42}
              aria-label={credentials ? 'Настройки подключения' : 'Подключить GREEN-API'}
              onClick={() => setConnectionOpened(true)}
            >
              <IconSettings size={19} stroke={1.8} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </header>

      {storageError && (
        <Alert color="orange" title="Сессия не сохранена" mb="md" role="alert">
          {storageError}
        </Alert>
      )}

      <div className="workspace">
        <aside className="sidebar">
          <Group justify="space-between" align="center" className="sidebar-heading">
            <Stack gap={2}>
              <Text fw={700}>Диалоги</Text>
              <Text size="xs" c="dimmed">Сообщения Telegram</Text>
            </Stack>
            <Tooltip label={credentials ? 'Новый диалог' : 'Сначала подключите GREEN-API'}>
              <ActionIcon
                variant="light"
                color="green"
                radius="xl"
                aria-label="Создать диалог"
                disabled={!credentials}
                onClick={() => setNewChatOpened(true)}
              >
                <IconPlus size={19} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {chats.length > 0 ? (
            <div className="chat-list">
              {chats.map((chat) => {
                const isActive = chat.chatId === activeChatId;
                const chatMessages = messagesByChat[chat.chatId] ?? [];
                return (
                  <button
                    key={chat.chatId}
                    type="button"
                    className={`chat-list-item${isActive ? ' chat-list-item-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => updateSession((current) => ({
                      ...current,
                      activeChatId: chat.chatId,
                    }))}
                  >
                    <Avatar radius="xl" color="blue" variant="light" size={42}>
                      <IconBrandTelegram size={21} aria-hidden="true" />
                    </Avatar>
                    <Stack gap={3} className="chat-list-copy">
                      <Text size="sm" fw={600} truncate>{chat.name}</Text>
                      <Text size="xs" c="dimmed" truncate>
                        {chatMessages.at(-1)?.text ?? 'Диалог создан'}
                      </Text>
                    </Stack>
                    {isActive && <IconCheck className="chat-list-check" size={16} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon"><IconBrandTelegram size={21} aria-hidden="true" /></div>
              <Text size="sm" fw={600}>Пока нет диалогов</Text>
              <Text size="xs" c="dimmed" ta="center">
                Найдите пользователя по номеру телефона или username.
              </Text>
            </div>
          )}

          <div className="sidebar-footer">
            <span className="footer-logo">G</span>
            <Stack gap={1}>
              <Text size="xs" fw={600}>GREEN-API · Telegram</Text>
              <Text size="xs" c="dimmed">Текстовые сообщения</Text>
            </Stack>
          </div>
        </aside>

        <section className="conversation-area">
          {activeChat ? (
            <ChatRoom
              key={activeChat.chatId}
              chat={activeChat}
              messages={messages}
              pollStatus={pollStatus}
              pollError={pollError}
              onSend={handleSend}
              onRetry={(message) => void handleRetry(message)}
              onDelete={() => setChatToDelete(activeChat)}
            />
          ) : (
            <div className="welcome-panel">
              <div className="welcome-glow" />
              <div className="welcome-content">
                <ThemeIcon className="welcome-icon" size={74} radius={24}>
                  <IconBrandTelegram size={38} stroke={1.6} aria-hidden="true" />
                </ThemeIcon>
                <Badge className="hero-eyebrow" variant="light" radius="xl" leftSection={<IconSparkles size={13} />}>
                  Telegram через GREEN-API
                </Badge>
                <Title order={1} className="welcome-title">
                  Простое общение.
                  <br />
                  <span>Надёжное подключение.</span>
                </Title>
                <Text className="welcome-description" c="dimmed" size="md">
                  Подключите свой инстанс, найдите пользователя по телефону или username и отправляйте сообщения в Telegram.
                </Text>
                {credentials ? (
                  <Button
                    size="md"
                    radius="xl"
                    leftSection={<IconPlus size={18} />}
                    className="brand-button welcome-action"
                    onClick={() => setNewChatOpened(true)}
                  >
                    Создать диалог
                  </Button>
                ) : (
                  <Button
                    size="md"
                    radius="xl"
                    leftSection={<IconBolt size={18} />}
                    className="brand-button welcome-action"
                    onClick={() => setConnectionOpened(true)}
                  >
                    Подключить GREEN-API
                  </Button>
                )}
                <Text className="welcome-note" size="xs" c="dimmed">
                  Подключение и переписка сохраняются при обновлении страницы до закрытия вкладки или отключения.
                </Text>
              </div>
              <div className="welcome-orbit orbit-one" />
              <div className="welcome-orbit orbit-two" />
            </div>
          )}
        </section>
      </div>

      <ConnectionModal
        opened={connectionOpened}
        credentials={credentials}
        onClose={() => setConnectionOpened(false)}
        onSave={handleSaveConnection}
        onDisconnect={handleDisconnect}
      />
      <NewChatModal
        opened={newChatOpened}
        client={client}
        onClose={() => setNewChatOpened(false)}
        onChatCreated={handleChatCreated}
      />
      <DeleteChatModal
        chat={chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirm={handleDeleteChat}
      />
    </main>
  );
}

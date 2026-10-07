import { useEffect, useRef } from 'react';
import {
  Alert,
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconBrandTelegram, IconDots, IconTrash } from '@tabler/icons-react';
import type { ChatContact, ChatMessage, PollStatus } from './types';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';

interface ChatRoomProps {
  chat: ChatContact;
  messages: ChatMessage[];
  pollStatus: PollStatus;
  pollError: string | null;
  onSend: (message: string) => Promise<void>;
  onRetry: (message: ChatMessage) => void;
  onDelete: () => void;
}

function getPollLabel(status: PollStatus): string {
  switch (status) {
    case 'connecting':
      return 'Подключаем получение';
    case 'online':
      return 'Ожидаем сообщения';
    case 'reconnecting':
      return 'Переподключаемся';
    default:
      return 'Приём остановлен';
  }
}

export function ChatRoom({
  chat,
  messages,
  pollStatus,
  pollError,
  onSend,
  onRetry,
  onDelete,
}: ChatRoomProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages.length]);

  return (
    <section className="chat-room" aria-label={`Диалог с ${chat.name}`}>
      <header className="conversation-header">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar radius="xl" color="blue" variant="light" size={44}>
            <IconBrandTelegram size={23} aria-hidden="true" />
          </Avatar>
          <Stack gap={3} style={{ minWidth: 0 }}>
            <Text fw={700} truncate>
              {chat.name}
            </Text>
            <Group gap={7} wrap="nowrap">
              <span className={`status-dot status-dot-${pollStatus}`} />
              <Text size="xs" c="dimmed" truncate>
                {getPollLabel(pollStatus)}
              </Text>
            </Group>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Badge className="telegram-badge" variant="light" radius="xl">
            Telegram
          </Badge>
          <Menu position="bottom-end" shadow="md" radius="md" width={190} withinPortal>
            <Menu.Target>
              <ActionIcon
                type="button"
                variant="subtle"
                color="gray"
                aria-label="Действия с диалогом"
              >
                <IconDots size={20} aria-hidden="true" />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} aria-hidden="true" />}
                onClick={onDelete}
              >
                Удалить чат
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </header>

      {pollError && (
        <Alert
          className="poll-error"
          color="orange"
          variant="light"
          icon={<IconAlertCircle size={18} />}
          title="Не удаётся получать сообщения"
        >
          {pollError} Проверьте, что у инстанса пустой webhookUrl и включены входящие уведомления для HTTP API.
        </Alert>
      )}

      <ScrollArea className="message-scroll" type="auto" offsetScrollbars>
        <div className="message-list" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 ? (
            <div className="conversation-empty">
              <div className="empty-icon empty-icon-small">
                <IconBrandTelegram size={25} stroke={1.7} aria-hidden="true" />
              </div>
              <Text fw={600}>Диалог создан</Text>
              <Text size="sm" c="dimmed" ta="center">
                Напишите первое сообщение — ответ появится здесь.
              </Text>
            </div>
          ) : (
            <Stack gap="sm" className="message-stack">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} onRetry={onRetry} />
              ))}
            </Stack>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <MessageComposer onSend={onSend} />
    </section>
  );
}

import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconRefresh } from '@tabler/icons-react';
import type { ChatMessage } from './types';

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: (message: ChatMessage) => void;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';

  return (
    <div className={`message-row ${isOutgoing ? 'message-row-outgoing' : ''}`}>
      <div className={`message-bubble ${isOutgoing ? 'message-bubble-outgoing' : ''}`}>
        <Text className="message-text" size="sm">
          {message.text}
        </Text>
        <Group className="message-meta" gap={5} justify="flex-end" wrap="nowrap">
          {message.status === 'sending' && (
            <Badge size="xs" variant="transparent" color="gray" p={0}>
              отправляем
            </Badge>
          )}
          {message.status === 'sent' && isOutgoing && (
            <IconCheck size={14} stroke={2.2} aria-label="Передано GREEN-API" />
          )}
          {message.status === 'failed' && (
            <>
              <IconAlertCircle size={14} color="var(--mantine-color-red-6)" aria-label="Ошибка отправки" />
              {isOutgoing && onRetry && (
                <Tooltip label="Повторить отправку" withArrow>
                  <ActionIcon
                    size={20}
                    variant="subtle"
                    color="red"
                    aria-label="Повторить отправку сообщения"
                    onClick={() => onRetry(message)}
                  >
                    <IconRefresh size={14} />
                  </ActionIcon>
                </Tooltip>
              )}
            </>
          )}
          <Text size="xs" c="dimmed">
            {formatTime(message.sentAt)}
          </Text>
        </Group>
        {message.error && (
          <Text className="message-error" size="xs" c="red">
            {message.error}
          </Text>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ActionIcon, Group, Text, Textarea, Tooltip } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (message: string) => Promise<void>;
}

const MAX_MESSAGE_LENGTH = 4096;

export function MessageComposer({ disabled = false, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const send = async () => {
    const message = value.trim();
    if (!message || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(message);
      setValue('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          aria-label="Текст сообщения"
          placeholder="Напишите сообщение…"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={disabled || isSending}
          className="composer-input"
        />
        <Tooltip label="Отправить" withArrow>
          <ActionIcon
            type="submit"
            size={44}
            radius="xl"
            aria-label="Отправить сообщение"
            className="send-button"
            disabled={!value.trim() || disabled || isSending}
            loading={isSending}
          >
            <IconSend size={19} stroke={2.1} />
          </ActionIcon>
        </Tooltip>
      </form>
      <Group justify="space-between" mt={7} px={3}>
        <Text size="xs" c="dimmed">
          Enter — отправить · Shift + Enter — новая строка
        </Text>
        <Text size="xs" c={value.length > MAX_MESSAGE_LENGTH - 100 ? 'orange' : 'dimmed'}>
          {value.length}/{MAX_MESSAGE_LENGTH}
        </Text>
      </Group>
    </div>
  );
}

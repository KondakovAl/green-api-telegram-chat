import { useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { GreenApiError, type GreenApiClient } from '../../api/greenApi';
import type { CheckAccountResponse } from '../../api/types';
import { yupFormResolver } from '../../shared/yupFormResolver';
import type { ChatContact } from './types';
import { newChatSchema } from './newChatSchema';
import { useCheckAccount } from './useCheckAccount';

interface NewChatModalProps {
  opened: boolean;
  client: GreenApiClient | null;
  onClose: () => void;
  onChatCreated: (chat: ChatContact) => void;
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('@')) return trimmed;
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(trimmed)) return `@${trimmed}`;
  return trimmed.replace(/\D/g, '');
}

function toChatContact(identifier: string, result: CheckAccountResponse): ChatContact {
  const username = result.username?.replace(/^@/, '').trim();
  const fallbackName = identifier.startsWith('@') ? identifier : `+${identifier}`;
  return {
    chatId: result.chatId ?? '',
    name: result.chatName?.trim() || (username ? `@${username}` : fallbackName),
  };
}

export function NewChatModal({
  opened,
  client,
  onClose,
  onChatCreated,
}: NewChatModalProps) {
  const [requestError, setRequestError] = useState<string | null>(null);
  const checkAccountMutation = useCheckAccount(client);
  const form = useForm({
    initialValues: { identifier: '' },
    validateInputOnBlur: true,
    validate: yupFormResolver(newChatSchema),
  });

  const handleClose = () => {
    setRequestError(null);
    checkAccountMutation.reset();
    form.reset();
    onClose();
  };

  const checkAccount = async ({ identifier }: { identifier: string }) => {
    setRequestError(null);

    const normalizedIdentifier = normalizeIdentifier(identifier);
    try {
      const result = await checkAccountMutation.mutateAsync(normalizedIdentifier);
      if (!result.exist || !result.chatId) {
        setRequestError('Аккаунт Telegram не найден. Проверьте номер или публичный username.');
        return;
      }

      onChatCreated(toChatContact(normalizedIdentifier, result));
      handleClose();
    } catch (error) {
      setRequestError(
        error instanceof GreenApiError
          ? error.message
          : 'Не удалось найти пользователя. Попробуйте ещё раз.',
      );
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={<Text fw={700}>Новый диалог</Text>}
      centered
      size="md"
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.32, blur: 4 }}
    >
      <form noValidate onSubmit={form.onSubmit(checkAccount)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Найдите пользователя Telegram по номеру телефона или публичному username. GREEN-API вернёт chatId для диалога.
          </Text>

          <TextInput
            label="Телефон или username"
            placeholder="+7 999 123-45-67 или @username"
            autoComplete="off"
            autoFocus
            required
            {...form.getInputProps('identifier')}
          />

          {requestError && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              title="Не получилось создать диалог"
            >
              {requestError}
            </Alert>
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose}>
              Отмена
            </Button>
            <Button
              type="submit"
              loading={checkAccountMutation.isPending}
              leftSection={<IconSearch size={17} />}
              className="brand-button"
            >
              Найти в Telegram
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

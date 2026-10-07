import { useEffect } from 'react';
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlugConnectedX } from '@tabler/icons-react';
import type { GreenApiCredentials } from '../../api/types';
import { yupFormResolver } from '../../shared/yupFormResolver';
import { connectionSchema } from './connectionSchema';

interface ConnectionModalProps {
  opened: boolean;
  credentials: GreenApiCredentials | null;
  onClose: () => void;
  onSave: (credentials: GreenApiCredentials) => void;
  onDisconnect: () => void;
}

const emptyCredentials: GreenApiCredentials = {
  apiUrl: '',
  idInstance: '',
  apiTokenInstance: '',
};

export function ConnectionModal({
  opened,
  credentials,
  onClose,
  onSave,
  onDisconnect,
}: ConnectionModalProps) {
  const form = useForm<GreenApiCredentials>({
    initialValues: credentials ?? emptyCredentials,
    validateInputOnBlur: true,
    validate: yupFormResolver(connectionSchema),
  });
  const { setValues, clearErrors } = form;

  useEffect(() => {
    if (opened) {
      setValues(credentials ?? emptyCredentials);
      clearErrors();
    }
  }, [clearErrors, credentials, opened, setValues]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700}>Подключение GREEN-API</Text>}
      centered
      size="md"
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.32, blur: 4 }}
    >
      <form
        noValidate
        onSubmit={form.onSubmit((values) =>
          onSave({
            apiUrl: values.apiUrl.trim().replace(/\/+$/, ''),
            idInstance: values.idInstance.trim(),
            apiTokenInstance: values.apiTokenInstance.trim(),
          }),
        )}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Укажите параметры авторизованного Telegram-инстанса. Подключение сохраняется при обновлении страницы до закрытия вкладки или отключения.
          </Text>

          <TextInput
            label="Адрес API"
            placeholder="https://…api.green-api.com"
            autoComplete="url"
            required
            {...form.getInputProps('apiUrl')}
          />

          <TextInput
            label="ID инстанса"
            placeholder="1101000000"
            inputMode="numeric"
            autoComplete="off"
            required
            {...form.getInputProps('idInstance')}
          />

          <PasswordInput
            label="Токен инстанса"
            placeholder="apiTokenInstance"
            autoComplete="new-password"
            required
            {...form.getInputProps('apiTokenInstance')}
          />

          <Text size="xs" c="dimmed">
            Параметры API можно скопировать в личном кабинете{' '}
            <Anchor href="https://console.green-api.com/" target="_blank" rel="noreferrer">
              GREEN-API
            </Anchor>
            . Telegram API GREEN-API работает в бета-режиме. Для получения сообщений включите HTTP API у инстанса.
          </Text>

          <Group
            justify={credentials ? 'space-between' : 'flex-end'}
            wrap="nowrap"
            gap="xs"
            mt="xs"
            pt="md"
            style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
          >
            {credentials && (
              <Tooltip
                label="Отключить GREEN-API"
                withArrow
                events={{ hover: true, focus: true, touch: true }}
              >
                <ActionIcon
                  type="button"
                  variant="light"
                  color="red"
                  size={36}
                  radius="md"
                  aria-label="Отключить GREEN-API"
                  style={{ flexShrink: 0 }}
                  onClick={onDisconnect}
                >
                  <IconPlugConnectedX size={19} stroke={1.8} aria-hidden="true" />
                </ActionIcon>
              </Tooltip>
            )}
            <Group gap="xs" wrap="nowrap">
              <Button type="button" variant="default" px="sm" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" px="sm" className="brand-button">
                Сохранить
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

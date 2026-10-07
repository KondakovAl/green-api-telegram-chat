import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ChatContact } from './types';

interface DeleteChatModalProps {
  chat: ChatContact | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteChatModal({ chat, onClose, onConfirm }: DeleteChatModalProps) {
  return (
    <Modal
      opened={chat !== null}
      onClose={onClose}
      title={<Text fw={700}>Удалить чат?</Text>}
      centered
      size="sm"
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.32, blur: 4 }}
    >
      <Stack gap="lg">
        <Text size="sm">
          Диалог с <Text span fw={600}>{chat?.name}</Text> и его история будут удалены из
          этого приложения. Переписка в Telegram сохранится.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button type="button" variant="default" onClick={onClose} data-autofocus>
            Отмена
          </Button>
          <Button type="button" color="red" onClick={onConfirm}>
            Удалить чат
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

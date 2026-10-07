import { useMutation } from '@tanstack/react-query';
import { GreenApiError, type GreenApiClient } from '../../api/greenApi';

interface SendMessageInput {
  chatId: string;
  message: string;
}

export function useSendMessage(client: GreenApiClient | null) {
  return useMutation({
    mutationFn: ({ chatId, message }: SendMessageInput) => {
      if (!client) throw new GreenApiError('Сначала подключите GREEN-API');
      return client.sendMessage(chatId, message);
    },
  });
}

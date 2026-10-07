import { useMutation } from '@tanstack/react-query';
import { GreenApiError, type GreenApiClient } from '../../api/greenApi';

export function useCheckAccount(client: GreenApiClient | null) {
  return useMutation({
    mutationFn: (identifier: string) => {
      if (!client) throw new GreenApiError('Сначала подключите GREEN-API');
      return client.checkAccount(identifier);
    },
  });
}

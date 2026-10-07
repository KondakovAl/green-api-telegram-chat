import { useEffect, useRef } from 'react';
import type { GreenApiClient } from '../../api/greenApi';
import type { GreenApiNotificationBody } from '../../api/types';
import type { ChatMessage, PollStatus } from './types';

function makeIncomingMessage(
  body: GreenApiNotificationBody,
): { chatId: string; message: ChatMessage } | null {
  if (
    body.typeWebhook !== 'incomingMessageReceived' ||
    body.messageData?.typeMessage !== 'textMessage'
  ) {
    return null;
  }

  const text = body.messageData.textMessageData?.textMessage;
  const chatId = body.senderData?.chatId;
  if (!text || !chatId) return null;

  const sentAt = typeof body.timestamp === 'number' ? body.timestamp * 1000 : Date.now();
  return {
    chatId,
    message: {
      id: body.idMessage || `${chatId}-${sentAt}-${text}`,
      direction: 'incoming',
      text,
      sentAt,
      status: 'sent',
    },
  };
}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException('Polling stopped', 'AbortError'));
    };

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function useIncomingMessages(
  client: GreenApiClient | null,
  onIncomingMessage: (chatId: string, message: ChatMessage) => void,
  onStatusChange: (status: PollStatus) => void,
  onErrorChange: (error: string | null) => void,
) {
  const onIncomingRef = useRef(onIncomingMessage);
  const onStatusRef = useRef(onStatusChange);
  const onErrorRef = useRef(onErrorChange);

  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
    onStatusRef.current = onStatusChange;
    onErrorRef.current = onErrorChange;
  }, [onErrorChange, onIncomingMessage, onStatusChange]);

  useEffect(() => {
    if (!client) {
      onStatusRef.current('idle');
      onErrorRef.current(null);
      return undefined;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let retryDelay = 1000;
    onStatusRef.current('connecting');
    onErrorRef.current(null);

    const poll = async () => {
      while (!signal.aborted) {
        try {
          const notification = await client.receiveNotification(signal);
          if (signal.aborted) break;
          if (notification) {
            const incomingMessage = makeIncomingMessage(notification.body);
            if (incomingMessage) {
              onIncomingRef.current(incomingMessage.chatId, incomingMessage.message);
            }

            await client.deleteNotification(notification.receiptId, signal);
          }

          retryDelay = 1000;
          onErrorRef.current(null);
          onStatusRef.current('online');
        } catch (error) {
          if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            break;
          }

          onErrorRef.current(
            error instanceof Error
              ? error.message
              : 'Не удалось получить уведомления GREEN-API',
          );
          onStatusRef.current('reconnecting');
          try {
            await waitForRetry(retryDelay, signal);
          } catch {
            break;
          }
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      }
    };

    void poll();
    return () => controller.abort();
  }, [client]);
}

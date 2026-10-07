export interface ChatContact {
  chatId: string;
  name: string;
}

export type MessageDirection = 'incoming' | 'outgoing';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface ChatMessage {
  id: string;
  direction: MessageDirection;
  text: string;
  sentAt: number;
  status: MessageStatus;
  error?: string;
}

export type PollStatus = 'idle' | 'connecting' | 'online' | 'reconnecting';

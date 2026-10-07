export interface GreenApiCredentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface CheckAccountResponse {
  exist?: boolean;
  chatId?: string;
  chatName?: string;
  phoneNumber?: number;
  username?: string;
  status?: boolean;
  reason?: string;
}

export interface SendMessageResponse {
  idMessage: string;
}

export interface GreenApiNotificationBody {
  typeWebhook?: string;
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    chatName?: string;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: {
      textMessage?: string;
    };
  };
}

export interface GreenApiNotificationEnvelope {
  receiptId: number;
  body: GreenApiNotificationBody;
}

export interface DeleteNotificationResponse {
  result?: boolean;
  reason?: string;
}

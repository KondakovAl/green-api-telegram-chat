import axios, { type AxiosRequestConfig } from 'axios';
import type {
  CheckAccountResponse,
  DeleteNotificationResponse,
  GreenApiCredentials,
  GreenApiNotificationEnvelope,
  SendMessageResponse,
} from './types';

export class GreenApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GreenApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  for (const key of ['description', 'message', 'reason', 'error']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return fallback;
}

export function normalizeApiUrl(value: string): string {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'https:') {
    throw new GreenApiError('Адрес GREEN-API должен начинаться с https://');
  }

  return parsed.toString().replace(/\/+$/, '');
}

export function createGreenApiClient(credentials: GreenApiCredentials) {
  const apiUrl = normalizeApiUrl(credentials.apiUrl);
  const http = axios.create({
    baseURL: apiUrl,
    timeout: 30000,
    headers: { Accept: 'application/json' },
  });
  const instancePath = `waInstance${encodeURIComponent(credentials.idInstance)}`;
  const token = encodeURIComponent(credentials.apiTokenInstance);

  function endpoint(method: string, suffix = ''): string {
    return `/${instancePath}/${method}/${token}${suffix}`;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        url: path,
        method: options.method ?? 'GET',
        signal: options.signal,
      };
      if (options.body !== undefined) config.data = options.body;

      const response = await http.request<T>(config);
      const payload: unknown = response.data;

      if (isRecord(payload) && payload.status === false) {
        throw new GreenApiError(getErrorMessage(payload, 'GREEN-API не выполнил запрос'));
      }

      return payload as T;
    } catch (error) {
      if (options.signal?.aborted || axios.isCancel(error)) {
        throw new DOMException('Request aborted', 'AbortError');
      }

      if (error instanceof GreenApiError) throw error;

      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new GreenApiError(
            'Не удалось связаться с GREEN-API. Проверьте адрес API и подключение к интернету.',
          );
        }

        throw new GreenApiError(
          getErrorMessage(error.response.data, `GREEN-API вернул ошибку ${error.response.status}`),
        );
      }

      throw error;
    }
  }

  return {
    checkAccount(identifier: string): Promise<CheckAccountResponse> {
      const value = identifier.trim();
      const username = value.startsWith('@') ? value : `@${value}`;
      const isUsername = /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username);

      return request(endpoint('checkAccount'), {
        method: 'POST',
        body: isUsername
          ? { username }
          : { phoneNumber: Number(value.replace(/\D/g, '')) },
      });
    },

    sendMessage(chatId: string, message: string): Promise<SendMessageResponse> {
      return request(endpoint('sendMessage'), {
        method: 'POST',
        body: { chatId, message },
      });
    },

    async receiveNotification(
      signal: AbortSignal,
    ): Promise<GreenApiNotificationEnvelope | null> {
      const url = `${endpoint('receiveNotification')}?receiveTimeout=5`;
      const payload = await request<unknown>(url, { signal });

      if (!isRecord(payload) || typeof payload.receiptId !== 'number') return null;
      return payload as unknown as GreenApiNotificationEnvelope;
    },

    deleteNotification(
      receiptId: number,
      signal: AbortSignal,
    ): Promise<DeleteNotificationResponse> {
      return request(endpoint('deleteNotification', `/${receiptId}`), {
        method: 'DELETE',
        signal,
      });
    },
  };
}

export type GreenApiClient = ReturnType<typeof createGreenApiClient>;

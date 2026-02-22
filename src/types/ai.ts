export type AiProvider = 'openrouter';

export interface AiRuntimeConfig {
  enabled: boolean;
  provider: AiProvider;
  apiKey: string;
  model: string;
  reasoningEnabled: boolean;
  dailyUsageSoftLimit: number;
  todayRequestCount: number;
}

export type AiRequestMode = 'summary' | 'ask';

export type AiErrorCode =
  | 'AUTH_INVALID'
  | 'RATE_LIMIT'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'INVALID_CONFIG'
  | 'UNKNOWN';

export class AiServiceError extends Error {
  code: AiErrorCode;

  status?: number;

  constructor(message: string, code: AiErrorCode, status?: number) {
    super(message);
    this.name = 'AiServiceError';
    this.code = code;
    this.status = status;
  }
}

export interface StreamChatCompletionParams {
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  reasoningEnabled: boolean;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
}

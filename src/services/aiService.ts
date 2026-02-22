import { AiServiceError, type StreamChatCompletionParams } from '../types/ai';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function mapHttpError(status: number, message: string): AiServiceError {
  if (status === 401 || status === 403) {
    return new AiServiceError(message || 'Invalid API key.', 'AUTH_INVALID', status);
  }
  if (status === 429) {
    return new AiServiceError(message || 'Rate limited by provider.', 'RATE_LIMIT', status);
  }
  return new AiServiceError(message || 'Provider request failed.', 'PROVIDER_ERROR', status);
}

function extractDeltaContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const data = payload as {
    choices?: Array<{
      delta?: { content?: unknown };
      message?: { content?: unknown };
    }>;
  };

  const choice = data.choices?.[0];
  if (!choice) {
    return '';
  }

  const deltaContent = choice.delta?.content;
  if (typeof deltaContent === 'string') {
    return deltaContent;
  }

  const messageContent = choice.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  return '';
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    return json.error?.message || json.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function buildRequestBody(params: StreamChatCompletionParams) {
  return {
    model: params.model,
    messages: params.messages,
    reasoning: { enabled: params.reasoningEnabled },
    stream: true,
  };
}

export async function streamOpenRouterChatCompletion(params: StreamChatCompletionParams): Promise<string> {
  const apiKey = params.apiKey.trim();
  const model = params.model.trim();
  if (!apiKey || !model) {
    throw new AiServiceError('Missing OpenRouter API key or model.', 'INVALID_CONFIG');
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(params)),
      signal: params.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiServiceError('Request aborted.', 'ABORTED');
    }
    throw new AiServiceError('Network request failed.', 'NETWORK_ERROR');
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw mapHttpError(response.status, message);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new AiServiceError('Provider stream is unavailable.', 'PROVIDER_ERROR', response.status);
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    let chunkResult: ReadableStreamReadResult<Uint8Array>;
    try {
      chunkResult = await reader.read();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AiServiceError('Request aborted.', 'ABORTED');
      }
      throw new AiServiceError('Failed to read provider stream.', 'PROVIDER_ERROR');
    }

    if (chunkResult.done) {
      break;
    }

    buffer += decoder.decode(chunkResult.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const lines = event.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) {
          continue;
        }
        const rawData = trimmed.slice(5).trim();
        if (!rawData || rawData === '[DONE]') {
          continue;
        }

        try {
          const payload = JSON.parse(rawData) as unknown;
          const delta = extractDeltaContent(payload);
          if (delta) {
            fullText += delta;
            params.onDelta?.(delta);
          }
        } catch {
          // Ignore malformed partial events.
        }
      }
    }
  }

  if (!fullText.trim()) {
    throw new AiServiceError('Provider returned empty content.', 'PROVIDER_ERROR');
  }

  return fullText;
}

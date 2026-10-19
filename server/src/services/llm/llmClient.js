// The LLM abstraction layer. The rest of the app only ever calls llm.chat() or llm.streamChat()
// and never knows which provider is behind them. Switching between local Ollama and cloud
// OpenRouter is a .env change + restart (LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL).
//
// A provider that is NOT OpenAI-compatible would get its own adapter exposing the same two
// functions; callers would not change (adapter pattern).
import OpenAI from 'openai';
import { config } from '../../config/env.js';
import { LlmError } from '../../utils/errors.js';
import { log } from '../../utils/logger.js';
import { PROVIDERS } from './providers.js';

// Merge the provider preset with any overrides from .env.
export function resolveLlmSettings(llmEnv, appUrl) {
  const preset = PROVIDERS[llmEnv.provider];
  if (!preset) throw new Error(`Unknown LLM_PROVIDER "${llmEnv.provider}"`);

  // Ollama ignores the key, but the OpenAI SDK refuses to start without one.
  const apiKey = llmEnv.apiKey ?? (preset.requiresApiKey ? undefined : 'not-needed');
  if (!apiKey) throw new Error(`LLM_API_KEY is required when LLM_PROVIDER=${llmEnv.provider}`);

  return {
    provider: llmEnv.provider,
    label: preset.label,
    baseURL: llmEnv.baseURL ?? preset.baseURL,
    model: llmEnv.model ?? preset.defaultModel,
    // Ignored for providers that don't support a fallback list.
    fallbackModels: preset.supportsFallbackModels ? (llmEnv.fallbackModels ?? []) : [],
    apiKey,
    headers: preset.headers({ appUrl }),
  };
}

// Turn SDK/network errors into one error type with a message a user can act on.
function toLlmError(err, settings) {
  if (err instanceof OpenAI.APIConnectionError) {
    const hint = settings.provider === 'ollama' ? ' Is Ollama running?' : '';
    return new LlmError(`Could not reach ${settings.label} at ${settings.baseURL}.${hint}`);
  }
  if (err instanceof OpenAI.APIError) {
    return new LlmError(`${settings.label} returned ${err.status ?? 'an error'}: ${err.message}`);
  }
  return err;
}

const isAbort = (err) => err instanceof OpenAI.APIUserAbortError || err?.name === 'AbortError';

export function createLlmClient(settings) {
  const client = new OpenAI({
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
    defaultHeaders: settings.headers,
    timeout: 60_000,
    maxRetries: 1,
  });

  // Request body shared by both functions. `models` is OpenRouter's fallback list: the primary model
  // first, then the backups it should try if that one is down or rate-limited.
  const requestBody = (messages, temperature) => ({
    model: settings.model,
    ...(settings.fallbackModels.length > 0 && { models: [settings.model, ...settings.fallbackModels] }),
    messages,
    temperature,
  });

  // Non-streaming: returns the whole answer as one string.
  async function chat(messages, { temperature = 0.2, signal } = {}) {
    const started = Date.now();
    try {
      const completion = await client.chat.completions.create(requestBody(messages, temperature), { signal });
      log.llm('completion finished', {
        provider: settings.provider,
        model: completion.model ?? settings.model,
        ms: Date.now() - started,
        usage: completion.usage,
      });
      return completion.choices[0]?.message?.content ?? '';
    } catch (err) {
      if (isAbort(err)) throw err;
      throw toLlmError(err, settings);
    }
  }

  // Streaming: an async generator that yields text tokens as the model produces them.
  // onModel(name) reports the model that actually answered (it differs from settings.model
  // when OpenRouter fell back to a backup model).
  async function* streamChat(messages, { temperature = 0.2, signal, onModel } = {}) {
    const started = Date.now();
    let tokens = 0;
    let servedBy = null;
    try {
      const stream = await client.chat.completions.create(
        { ...requestBody(messages, temperature), stream: true },
        { signal },
      );
      for await (const part of stream) {
        if (!servedBy && part.model) {
          servedBy = part.model;
          onModel?.(servedBy);
        }
        const text = part.choices[0]?.delta?.content;
        if (text) {
          tokens += 1;
          yield text;
        }
      }
    } catch (err) {
      if (isAbort(err)) throw err;
      throw toLlmError(err, settings);
    }
    log.llm('stream finished', {
      provider: settings.provider,
      model: servedBy ?? settings.model,
      ...(servedBy && servedBy !== settings.model && { fallbackFrom: settings.model }),
      chunks: tokens,
      ms: Date.now() - started,
    });
  }

  return {
    provider: settings.provider,
    model: settings.model,
    fallbackModels: settings.fallbackModels,
    baseURL: settings.baseURL,
    chat,
    streamChat,
  };
}

// The single instance the app uses, built from .env at startup.
export const llm = createLlmClient(resolveLlmSettings(config.llm, config.clientOrigins[0]));

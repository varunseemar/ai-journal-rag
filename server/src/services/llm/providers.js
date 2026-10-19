// Presets for every supported LLM provider. Both speak the OpenAI Chat Completions API,
// so the only differences are the base URL, whether a key is needed, a default model and headers.
// LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env override any preset value, so any other
// OpenAI-compatible server (LM Studio, vLLM, Groq...) works without code changes.
export const PROVIDERS = Object.freeze({
  ollama: {
    label: 'Ollama (local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2:3b',
    requiresApiKey: false,
    supportsFallbackModels: false,
    headers: () => ({}),
  },
  openrouter: {
    label: 'OpenRouter (cloud)',
    baseURL: 'https://openrouter.ai/api/v1',
    // Free models come and go; check https://openrouter.ai/models (filter: free).
    defaultModel: 'poolside/laguna-s-2.1:free',
    requiresApiKey: true,
    // OpenRouter accepts a `models` list and moves to the next one if a model is down
    // or rate-limited (common with free models).
    supportsFallbackModels: true,
    // Optional attribution headers OpenRouter uses to identify the calling app.
    headers: ({ appUrl }) => ({ 'HTTP-Referer': appUrl, 'X-Title': 'AI Journal' }),
  },
});

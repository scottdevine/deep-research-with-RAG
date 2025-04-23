
export const CONFIG = {
  // Rate limits (requests per minute)
  rateLimits: {
    enabled: false, // Set to false to disable rate limiting
    search: 5,            // Search requests per minute
    contentFetch: 20,     // Content fetch requests per minute
    reportGeneration: 5   // Report generation requests per minute
  },

  // Search settings
  search: {
    resultsPerPage: 10,
    maxSelectableResults: 20,
    provider: 'google' as 'google' | 'bing' | 'exa', // Default search provider
    safeSearch: {
      google: 'active' as 'active' | 'off',
      bing: 'moderate' as 'moderate' | 'strict' | 'off',
    },
    market: 'en-US',
  },

  // AI Platform settings
  platforms: {
    google: {
      enabled: true,
      models: {
        // Gemini 2.0 Models
        'gemini-2.0-flash': {
          enabled: true,
          label: 'Gemini 2.0 Flash',
        },
        'gemini-2.0-pro': {
          enabled: true,
          label: 'Gemini 2.0 Pro',
        },
        // Gemini 2.5 Models
        'gemini-2.5-flash': {
          enabled: true,
          label: 'Gemini 2.5 Flash',
        },
        'gemini-2.5-pro': {
          enabled: true,
          label: 'Gemini 2.5 Pro',
        },
      },
    },
    ollama: {
      enabled: true,
      models: {
        'gemma3:27b': {
          enabled: true,
          label: 'gemma3:27b',
        },
        'qwq:latest': {
          enabled: true,
          label: 'qwq:latest',
        },
      },
    },
    openai: {
      enabled: true,
      models: {
        'gpt-4.1-2025-04-14': {  // Latest GPT-4.1
          enabled: true,
          label: 'GPT-4.1',
        },
        'gpt-4.1-mini-2025-04-14': {  // Latest GPT-4.1-mini
          enabled: true,
          label: 'GPT-4.1 Mini',
        },
        'o3-2025-04-16': {  // Latest o3
          enabled: true,
          label: 'O3',
        }
      },
    },
    anthropic: {
      enabled: true,
      models: {
        'claude-3-7-sonnet-latest': {
          enabled: true,
          label: 'Claude 3.7 Sonnet',
        },
        'claude-3-5-haiku-latest': {
          enabled: true,
          label: 'Claude 3.5 Haiku',
        },
      },
    },
    deepseek: {
      enabled: true,
      models: {
        chat: {
          enabled: false,
          label: 'Chat',
        },
        reasoner: {
          enabled: false,
          label: 'Reasoner',
        },
      },
    },
    openrouter: {
      enabled: true,
      models: {
        'openrouter/auto': {
          enabled: false,
          label: 'Auto',
        },
      },
    },
  },
} as const

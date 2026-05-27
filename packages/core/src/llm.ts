/**
 * Thin LLM provider abstraction for the HoloMem research swarm.
 *
 * Supports:
 *  - Anthropic  (Claude Haiku 4.5)   — set ANTHROPIC_API_KEY
 *  - OpenAI     (GPT-4o-mini)        — set OPENAI_API_KEY
 *
 * Usage:
 *   const llm = createProvider('anthropic');   // or 'openai'
 *   const text = await llm.complete('Your prompt here', 1024);
 *
 * Auto-detect (no flag passed):
 *   Uses Anthropic if ANTHROPIC_API_KEY is set, otherwise OpenAI.
 */

export type ProviderName = 'anthropic' | 'openai';

export interface LLMProvider {
  readonly name: ProviderName;
  readonly model: string;
  /**
   * Send a single-turn user prompt and return the assistant's text response.
   * @param prompt    The user message content.
   * @param maxTokens Maximum tokens to generate.
   */
  complete(prompt: string, maxTokens: number): Promise<string>;
}

/* ─── Anthropic ─────────────────────────────────────────────────────────── */

class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = 'anthropic';
  readonly model = 'claude-haiku-4-5-20251001';

  private _client: import('@anthropic-ai/sdk').default | null = null;

  private get client() {
    if (!this._client) {
      // Lazy import so the module loads even when the package isn't installed.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Anthropic = require('@anthropic-ai/sdk').default as typeof import('@anthropic-ai/sdk').default;
      this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this._client;
  }

  async complete(prompt: string, maxTokens: number): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }
}

/* ─── OpenAI ────────────────────────────────────────────────────────────── */

class OpenAIProvider implements LLMProvider {
  readonly name: ProviderName = 'openai';
  readonly model = 'gpt-4o-mini';

  private _client: import('openai').default | null = null;

  private get client() {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const OpenAI = require('openai').default as typeof import('openai').default;
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  async complete(prompt: string, maxTokens: number): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

/* ─── Factory ───────────────────────────────────────────────────────────── */

/**
 * Returns an LLM provider instance.
 *
 * @param name  `'anthropic'` | `'openai'` | `'auto'`
 *              `'auto'` (default): uses Anthropic if `ANTHROPIC_API_KEY` is
 *              set, falls back to OpenAI if `OPENAI_API_KEY` is set.
 */
export function createProvider(name: ProviderName | 'auto' = 'auto'): LLMProvider {
  if (name === 'auto') {
    if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
    if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
    throw new Error(
      'No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file.',
    );
  }
  if (name === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
    }
    return new AnthropicProvider();
  }
  if (name === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
    }
    return new OpenAIProvider();
  }
  throw new Error(`Unknown provider "${name as string}". Use "anthropic" or "openai".`);
}

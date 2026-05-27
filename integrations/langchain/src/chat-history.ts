import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  StoredMessage,
} from '@langchain/core/messages';
import { HoloMem, TtlTier } from '@holomem/sdk';

/** Options for constructing a {@link HoloMemChatHistory}. */
export interface HoloMemChatHistoryOptions {
  /**
   * Unique session identifier. All messages written by this instance are
   * stored under this key and recalled together.
   */
  sessionId: string;

  /** HoloMem API key. */
  apiKey: string;

  /**
   * 64-hex-character ECIES private key for end-to-end encryption.
   * If omitted the SDK generates an ephemeral key and warns — recall after
   * process restart will fail.
   */
  encryptionKey?: string;

  /**
   * Override the HoloMem API base URL (useful for local development /
   * staging environments).
   */
  baseUrl?: string;

  /**
   * Optional agent identifier written alongside each memory.  Lets you
   * distinguish messages from different agents sharing the same session.
   */
  agentId?: string;

  /**
   * TTL tier for stored messages.  Defaults to `'episodic'`.
   *
   * - `'working'`   — very short-lived, suitable for scratch context
   * - `'episodic'`  — session-length memory (default)
   * - `'persistent'` — long-term memory
   */
  ttl?: TtlTier;
}

/**
 * LangChain `BaseChatMessageHistory` backed by HoloMem encrypted on-chain
 * storage.
 *
 * Each message is serialised to JSON and stored as a separate HoloMem memory
 * entry under the given `sessionId`.  On retrieval the full conversation
 * history is reconstructed in insertion order.
 *
 * @example
 * ```typescript
 * import { HoloMemChatHistory } from '@holomem/langchain';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { RunnableWithMessageHistory } from '@langchain/core/runnables';
 *
 * const history = new HoloMemChatHistory({
 *   sessionId: 'user-123',
 *   apiKey: process.env.HOLOMEM_API_KEY!,
 *   encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
 * });
 *
 * const chain = new RunnableWithMessageHistory({
 *   runnable: new ChatOpenAI(),
 *   getMessageHistory: () => history,
 *   inputMessagesKey: 'input',
 *   historyMessagesKey: 'chat_history',
 * });
 * ```
 */
export class HoloMemChatHistory extends BaseChatMessageHistory {
  lc_namespace = ['holomem', 'chat_history'];

  private readonly sessionId: string;
  private readonly agentId?: string;
  private readonly ttl: TtlTier;
  private readonly memOptions: {
    apiKey: string;
    encryptionKey?: string;
    baseUrl?: string;
  };

  /** Lazily-initialised HoloMem client — created on first use. */
  private _mem: HoloMem | null = null;

  constructor(options: HoloMemChatHistoryOptions) {
    super();
    this.sessionId = options.sessionId;
    this.agentId = options.agentId;
    this.ttl = options.ttl ?? 'episodic';
    this.memOptions = {
      apiKey: options.apiKey,
      encryptionKey: options.encryptionKey,
      baseUrl: options.baseUrl,
    };
  }

  /** Returns (and lazily creates) the underlying {@link HoloMem} client. */
  private get mem(): HoloMem {
    if (!this._mem) {
      this._mem = new HoloMem(this.memOptions);
    }
    return this._mem;
  }

  /**
   * Retrieves the full chat history for the session from HoloMem.
   *
   * Entries whose stored JSON cannot be parsed are silently skipped so that
   * a single corrupted memory does not break the entire history.
   */
  async getMessages(): Promise<BaseMessage[]> {
    // Retrieve up to 500 entries — more than any practical conversation.
    const memories = await this.mem.recall(this.sessionId, { limit: 500 });

    const stored: StoredMessage[] = [];
    for (const memory of memories) {
      try {
        const parsed: unknown = JSON.parse(memory.plaintext);
        // Each memory holds a single serialised StoredMessage object.
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          'type' in parsed &&
          'data' in parsed
        ) {
          stored.push(parsed as StoredMessage);
        }
      } catch {
        // Silently skip malformed entries.
      }
    }

    return mapStoredMessagesToChatMessages(stored);
  }

  /**
   * Serialises `message` and writes it to HoloMem under the current session.
   *
   * The message is stored as a JSON object in the format expected by
   * `mapStoredMessagesToChatMessages` so that it can be round-tripped
   * back to a `BaseMessage` on retrieval.
   */
  /**
   * Convenience method that wraps a human text string as a `HumanMessage`
   * and stores it.
   * @deprecated Prefer `addMessage` with a typed `BaseMessage`.
   */
  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  /**
   * Convenience method that wraps an AI text string as an `AIMessage` and
   * stores it.
   * @deprecated Prefer `addMessage` with a typed `BaseMessage`.
   */
  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const [stored] = mapChatMessagesToStoredMessages([message]);
    const json = JSON.stringify(stored);
    await this.mem.write(this.sessionId, json, {
      ttl: this.ttl,
      agentId: this.agentId,
    });
  }

  /**
   * Writes multiple messages sequentially to avoid nonce collisions in the
   * underlying encryption layer.
   */
  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.addMessage(msg);
    }
  }

  /**
   * Deletes all memories associated with this session.
   *
   * Individual deletion errors are swallowed so that a partial failure does
   * not prevent the rest of the history from being cleared.
   */
  async clear(): Promise<void> {
    // Retrieve all memories (large limit to avoid partial clears).
    let memories;
    try {
      memories = await this.mem.recall(this.sessionId, { limit: 1000 });
    } catch {
      return;
    }

    for (const memory of memories) {
      try {
        await this.mem.delete(memory.entityKey);
      } catch {
        // Swallow individual deletion errors.
      }
    }
  }
}

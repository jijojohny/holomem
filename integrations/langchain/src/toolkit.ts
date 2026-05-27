import { DynamicTool } from '@langchain/core/tools';
import { HoloMem, TtlTier } from '@holomem/sdk';

/** Options for constructing a {@link HoloMemToolkit}. */
export interface HoloMemToolkitOptions {
  /**
   * Default session identifier used for all memory operations unless
   * overridden in a specific tool's input.
   */
  sessionId: string;

  /** HoloMem API key. */
  apiKey: string;

  /**
   * 64-hex-character ECIES private key for end-to-end encryption.
   * If omitted the SDK generates an ephemeral key and warns.
   */
  encryptionKey?: string;

  /**
   * Override the HoloMem API base URL (useful for staging environments).
   */
  baseUrl?: string;

  /**
   * Optional agent identifier attached to memories written by this toolkit.
   */
  agentId?: string;

  /**
   * TTL tier for written memories.  Defaults to `'episodic'`.
   *
   * - `'working'`    — very short-lived scratch context
   * - `'episodic'`   — session-length memory (default)
   * - `'persistent'` — long-term memory
   */
  ttl?: TtlTier;
}

/**
 * A collection of LangChain `DynamicTool`s that expose HoloMem memory
 * operations to LLM agents.
 *
 * Use `getTools()` to retrieve the tool array and pass it to your agent
 * executor.  The toolkit handles all encryption and API communication
 * transparently.
 *
 * @example
 * ```typescript
 * import { HoloMemToolkit } from '@holomem/langchain';
 * import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { pull } from 'langchain/hub';
 *
 * const toolkit = new HoloMemToolkit({
 *   sessionId: 'agent-session-42',
 *   apiKey: process.env.HOLOMEM_API_KEY!,
 *   encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
 *   agentId: 'research-agent',
 * });
 *
 * const agent = await createOpenAIFunctionsAgent({
 *   llm: new ChatOpenAI({ modelName: 'gpt-4o' }),
 *   tools: toolkit.getTools(),
 *   prompt: await pull('hwchase17/openai-functions-agent'),
 * });
 *
 * const executor = new AgentExecutor({ agent, tools: toolkit.getTools() });
 * ```
 */
export class HoloMemToolkit {
  private readonly sessionId: string;
  private readonly agentId?: string;
  private readonly ttl: TtlTier;

  /** Lazily-initialised HoloMem client — created on first tool invocation. */
  private _mem: HoloMem | null = null;

  private readonly memOptions: {
    apiKey: string;
    encryptionKey?: string;
    baseUrl?: string;
  };

  constructor(options: HoloMemToolkitOptions) {
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
   * Returns the full set of HoloMem memory tools ready to be passed to a
   * LangChain agent executor.
   *
   * Tools included:
   * - `holomem_write_memory`   — store a new memory
   * - `holomem_recall_memories` — retrieve all memories (with optional filter)
   * - `holomem_delete_memory`  — delete a memory by entity key
   * - `holomem_pin_memory`     — pin a memory so it is never expired
   */
  getTools(): DynamicTool[] {
    return [
      this._buildWriteTool(),
      this._buildRecallTool(),
      this._buildDeleteTool(),
      this._buildPinTool(),
    ];
  }

  // ── Individual tool builders ───────────────────────────────────────────────

  private _buildWriteTool(): DynamicTool {
    return new DynamicTool({
      name: 'holomem_write_memory',
      description:
        'Store a piece of information as an encrypted memory in HoloMem for the current session. ' +
        'Use this tool whenever you encounter information that should be remembered for later — ' +
        'such as user preferences, key facts learned during conversation, task progress, or any ' +
        'context that may be useful in future interactions. ' +
        'Input: the plain-text string you want to remember. ' +
        'Output: the entity key (unique identifier) of the stored memory.',
      func: async (input: string): Promise<string> => {
        try {
          const entityKey = await this.mem.write(this.sessionId, input.trim(), {
            agentId: this.agentId,
            ttl: this.ttl,
          });
          return `Memory stored successfully. Entity key: ${entityKey}`;
        } catch (err) {
          return `Failed to write memory: ${String(err)}`;
        }
      },
    });
  }

  private _buildRecallTool(): DynamicTool {
    return new DynamicTool({
      name: 'holomem_recall_memories',
      description:
        'Recall encrypted memories stored in HoloMem for the current session. ' +
        'Use this tool at the start of a conversation or task to reload relevant context, ' +
        'or whenever you need to check what has been remembered previously. ' +
        'Input: an optional keyword or phrase to filter results (leave empty to retrieve all memories). ' +
        'Output: a numbered list of memories with their entity keys.',
      func: async (input: string): Promise<string> => {
        try {
          const memories = await this.mem.recall(this.sessionId, { limit: 100 });

          if (memories.length === 0) {
            return 'No memories found for the current session.';
          }

          const keyword = input.trim().toLowerCase();
          const filtered = keyword
            ? memories.filter((m) => m.plaintext.toLowerCase().includes(keyword))
            : memories;

          if (filtered.length === 0) {
            return `No memories matched the keyword "${input.trim()}".`;
          }

          const lines = filtered.map(
            (m, i) => `${i + 1}. [${m.entityKey}] ${m.plaintext}`,
          );
          return `Found ${filtered.length} memory(s):\n\n${lines.join('\n')}`;
        } catch (err) {
          return `Failed to recall memories: ${String(err)}`;
        }
      },
    });
  }

  private _buildDeleteTool(): DynamicTool {
    return new DynamicTool({
      name: 'holomem_delete_memory',
      description:
        'Delete a specific memory from HoloMem by its entity key. ' +
        'Use this tool to remove outdated, incorrect, or no longer relevant information. ' +
        'Entity keys are returned by holomem_write_memory and holomem_recall_memories. ' +
        'Input: the entity key string of the memory to delete (e.g. "mem_abc123xyz"). ' +
        'Output: confirmation of deletion or an error message.',
      func: async (input: string): Promise<string> => {
        const entityKey = input.trim();
        if (!entityKey) {
          return 'Error: entity key is required. Provide the key returned by holomem_write_memory or holomem_recall_memories.';
        }
        try {
          await this.mem.delete(entityKey);
          return `Memory "${entityKey}" deleted successfully.`;
        } catch (err) {
          return `Failed to delete memory "${entityKey}": ${String(err)}`;
        }
      },
    });
  }

  private _buildPinTool(): DynamicTool {
    return new DynamicTool({
      name: 'holomem_pin_memory',
      description:
        'Pin a memory in HoloMem so it is never automatically expired, regardless of its TTL tier. ' +
        'Use this tool to mark critical, long-term information that must persist indefinitely — ' +
        'such as core user preferences, identity facts, or standing instructions. ' +
        'Entity keys are returned by holomem_write_memory and holomem_recall_memories. ' +
        'Input: the entity key string of the memory to pin (e.g. "mem_abc123xyz"). ' +
        'Output: confirmation that the memory has been pinned.',
      func: async (input: string): Promise<string> => {
        const entityKey = input.trim();
        if (!entityKey) {
          return 'Error: entity key is required. Provide the key returned by holomem_write_memory or holomem_recall_memories.';
        }
        try {
          await this.mem.pin(entityKey);
          return `Memory "${entityKey}" pinned successfully. It will not be automatically expired.`;
        } catch (err) {
          return `Failed to pin memory "${entityKey}": ${String(err)}`;
        }
      },
    });
  }
}

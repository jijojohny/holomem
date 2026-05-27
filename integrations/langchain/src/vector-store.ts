import { VectorStore } from '@langchain/core/vectorstores';
import { EmbeddingsInterface } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';
import { HoloMem, TtlTier } from '@holomem/sdk';

/** Options for constructing a {@link HoloMemVectorStore}. */
export interface HoloMemVectorStoreOptions {
  /** HoloMem API key. */
  apiKey: string;

  /**
   * Session identifier used to namespace all documents in this store.
   * Use different values to maintain separate collections.
   */
  sessionId: string;

  /**
   * 64-hex-character ECIES private key for end-to-end encryption.
   * If omitted the SDK generates an ephemeral key and warns.
   */
  encryptionKey?: string;

  /**
   * Override the HoloMem API base URL (useful for staging environments).
   */
  baseUrl?: string;

  /** LangChain embeddings interface used to compute vectors. */
  embeddings: EmbeddingsInterface;

  /**
   * Similarity threshold for searches (0–1).  Results below this score are
   * excluded.  Defaults to `0.6`.
   */
  threshold?: number;
}

/**
 * Prefix embedded at the start of stored plaintext to carry document metadata.
 * The format is `// META: <JSON>\n` so that it survives round-trips through
 * HoloMem's encryption layer as plain text and can be stripped on read.
 */
const META_PREFIX = '// META: ';
const META_SUFFIX = '\n';

function encodeContent(pageContent: string, metadata: Record<string, unknown>): string {
  const metaJson = JSON.stringify(metadata);
  return `${META_PREFIX}${metaJson}${META_SUFFIX}${pageContent}`;
}

function decodeContent(stored: string): { pageContent: string; metadata: Record<string, unknown> } {
  if (stored.startsWith(META_PREFIX)) {
    const newlineIdx = stored.indexOf(META_SUFFIX, META_PREFIX.length);
    if (newlineIdx !== -1) {
      const metaJson = stored.slice(META_PREFIX.length, newlineIdx);
      const pageContent = stored.slice(newlineIdx + META_SUFFIX.length);
      try {
        const metadata = JSON.parse(metaJson) as Record<string, unknown>;
        return { pageContent, metadata };
      } catch {
        // Fall through to treat the whole string as content.
      }
    }
  }
  return { pageContent: stored, metadata: {} };
}

/**
 * LangChain `VectorStore` backed by HoloMem encrypted on-chain storage.
 *
 * Documents are stored in HoloMem with their metadata serialised as a
 * `// META: {...}` comment prefix.  Similarity search is delegated to
 * HoloMem's server-side vector search, which requires an `embed` function
 * to be provided (done transparently via `this.embeddings`).
 *
 * ### Concurrency note
 * `addVectors` and `similaritySearchVectorWithScore` accept pre-computed
 * embeddings via the LangChain interface.  Because the HoloMem SDK embeds
 * internally, this class uses a per-call override closure to inject the
 * pre-computed vector.  Concurrent calls on the **same instance** are safe
 * when using `addVectors` (each creates its own `HoloMem` instance).  The
 * main `this._mem` instance is only used for text-first paths.
 *
 * @example
 * ```typescript
 * import { HoloMemVectorStore } from '@holomem/langchain';
 * import { OpenAIEmbeddings } from '@langchain/openai';
 *
 * const store = new HoloMemVectorStore({
 *   apiKey: process.env.HOLOMEM_API_KEY!,
 *   sessionId: 'knowledge-base-v1',
 *   encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
 *   embeddings: new OpenAIEmbeddings(),
 * });
 *
 * await store.addDocuments([
 *   new Document({ pageContent: 'The capital of France is Paris.' }),
 * ]);
 *
 * const results = await store.similaritySearch('European capitals', 3);
 * ```
 */
export class HoloMemVectorStore extends VectorStore {
  _vectorstoreType(): string {
    return 'holomem';
  }

  private readonly sessionId: string;
  private readonly threshold: number;
  private readonly memOptions: {
    apiKey: string;
    encryptionKey?: string;
    baseUrl?: string;
  };

  /** Lazily-initialised HoloMem client for text-first operations. */
  private _mem: HoloMem | null = null;

  constructor(options: HoloMemVectorStoreOptions) {
    super(options.embeddings, {});
    this.sessionId = options.sessionId;
    this.threshold = options.threshold ?? 0.6;
    this.memOptions = {
      apiKey: options.apiKey,
      encryptionKey: options.encryptionKey,
      baseUrl: options.baseUrl,
    };
  }

  /**
   * Returns (and lazily creates) the HoloMem client wired to use
   * `this.embeddings` for automatic embedding on write and search.
   */
  private get mem(): HoloMem {
    if (!this._mem) {
      this._mem = new HoloMem({
        ...this.memOptions,
        embed: (text: string) => this.embeddings.embedQuery(text),
      });
    }
    return this._mem;
  }

  /**
   * Creates a short-lived HoloMem client whose `embed` callback returns the
   * supplied `vector` exactly once, then falls back to live embedding.  This
   * lets `addVectors` and `similaritySearchVectorWithScore` inject
   * pre-computed vectors without re-computing them.
   *
   * A dedicated instance is created per call so concurrent callers don't
   * interfere with each other.
   */
  private memWithVector(vector: number[]): HoloMem {
    let used = false;
    return new HoloMem({
      ...this.memOptions,
      embed: async (text: string): Promise<number[]> => {
        if (!used) {
          used = true;
          return vector;
        }
        // Should only be called once; fall back to live embedding.
        return this.embeddings.embedQuery(text);
      },
    });
  }

  /**
   * Adds `docs` to the vector store.  Embeddings are computed via
   * `this.embeddings` and stored together with the document content and
   * metadata.  Writes are sequential to avoid nonce collisions.
   */
  async addDocuments(
    docs: Document[],
    _opts?: { ids?: string[] },
  ): Promise<string[]> {
    const keys: string[] = [];
    for (const doc of docs) {
      const stored = encodeContent(doc.pageContent, doc.metadata ?? {});
      const key = await this.mem.write(this.sessionId, stored, {
        agentId: 'vectorstore',
        ttl: 'persistent',
      });
      keys.push(key);
    }
    return keys;
  }

  /**
   * Adds documents with pre-computed `vectors`.  Each document is stored
   * using its supplied vector rather than recomputing it.  Writes are
   * sequential.
   */
  async addVectors(
    vectors: number[][],
    docs: Document[],
    _opts?: { ids?: string[] },
  ): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const vector = vectors[i];
      const stored = encodeContent(doc.pageContent, doc.metadata ?? {});
      const mem = this.memWithVector(vector);
      const key = await mem.write(this.sessionId, stored, {
        agentId: 'vectorstore',
        ttl: 'persistent',
      });
      keys.push(key);
    }
    return keys;
  }

  /**
   * Performs a similarity search using a pre-computed query `vector`.
   *
   * A dedicated HoloMem instance is created so that the supplied vector is
   * injected into the SDK's embed callback, enabling the server-side search
   * without re-computing the embedding.
   *
   * @param queryVector - Pre-computed query embedding.
   * @param k           - Maximum number of results to return.
   * @param filter      - Optional filter; supports `{ threshold: number }`.
   */
  async similaritySearchVectorWithScore(
    queryVector: number[],
    k: number,
    filter?: { threshold?: number; [key: string]: unknown },
  ): Promise<[Document, number][]> {
    const threshold = filter?.threshold ?? this.threshold;
    const mem = this.memWithVector(queryVector);

    // The SDK's search() takes a query string and calls embed() internally.
    // We pass a sentinel string; the embed callback returns our vector.
    const results = await mem.search('__vector__', {
      sessionId: this.sessionId,
      limit: k,
      threshold,
    });

    return results.map((r) => {
      const { pageContent, metadata } = decodeContent(r.plaintext);
      return [new Document({ pageContent, metadata }), r.score];
    });
  }

  // ── Factory methods ─────────────────────────────────────────────────────────

  /**
   * Creates a `HoloMemVectorStore` from an array of text strings and optional
   * metadata objects.
   */
  static async fromTexts(
    texts: string[],
    metadatas: Record<string, unknown>[] | Record<string, unknown>,
    embeddings: EmbeddingsInterface,
    opts: Omit<HoloMemVectorStoreOptions, 'embeddings'>,
  ): Promise<HoloMemVectorStore> {
    const docs = texts.map((text, i) => {
      const metadata = Array.isArray(metadatas) ? metadatas[i] ?? {} : metadatas;
      return new Document({ pageContent: text, metadata });
    });
    return HoloMemVectorStore.fromDocuments(docs, embeddings, opts);
  }

  /**
   * Creates a `HoloMemVectorStore` from an array of `Document` objects.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    opts: Omit<HoloMemVectorStoreOptions, 'embeddings'>,
  ): Promise<HoloMemVectorStore> {
    const store = new HoloMemVectorStore({ ...opts, embeddings });
    await store.addDocuments(docs);
    return store;
  }
}

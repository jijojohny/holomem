# @holomem/langchain

LangChain.js integration for [HoloMem](https://holomem.io) — encrypted on-chain memory for AI agents.

Provides three building blocks:

| Export | LangChain base | Purpose |
|---|---|---|
| `HoloMemChatHistory` | `BaseChatMessageHistory` | Persistent encrypted chat history |
| `HoloMemVectorStore` | `VectorStore` | Encrypted semantic document store |
| `HoloMemToolkit` | `DynamicTool[]` | Memory tools for function-calling agents |

## Installation

```bash
npm install @holomem/langchain @holomem/sdk @langchain/core
```

## Usage

### Chat History

Attach persistent, encrypted conversation history to any LangChain chain using `RunnableWithMessageHistory`.

```typescript
import { HoloMemChatHistory } from '@holomem/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant.'],
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
]);

const chain = prompt
  .pipe(new ChatOpenAI({ modelName: 'gpt-4o' }))
  .pipe(new StringOutputParser());

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: (sessionId: string) =>
    new HoloMemChatHistory({
      sessionId,
      apiKey: process.env.HOLOMEM_API_KEY!,
      encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
      ttl: 'episodic',
    }),
  inputMessagesKey: 'input',
  historyMessagesKey: 'chat_history',
});

const response = await chainWithHistory.invoke(
  { input: 'What is the capital of France?' },
  { configurable: { sessionId: 'user-123' } },
);

console.log(response);
// → "The capital of France is Paris."
```

### Vector Store

Store and semantically search encrypted documents.

```typescript
import { HoloMemVectorStore } from '@holomem/langchain';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

const embeddings = new OpenAIEmbeddings();

// Create store and index documents
const store = await HoloMemVectorStore.fromTexts(
  [
    'The Eiffel Tower is located in Paris, France.',
    'The Colosseum is in Rome, Italy.',
    'Big Ben is a clock tower in London, UK.',
  ],
  [
    { source: 'wiki', topic: 'france' },
    { source: 'wiki', topic: 'italy' },
    { source: 'wiki', topic: 'uk' },
  ],
  embeddings,
  {
    apiKey: process.env.HOLOMEM_API_KEY!,
    sessionId: 'landmarks-kb',
    encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
  },
);

// Semantic similarity search
const results = await store.similaritySearch('famous European monuments', 2);
results.forEach(({ pageContent, metadata }) => {
  console.log(pageContent, metadata);
});
```

### Toolkit (Agent Tools)

Give your LangChain agent read/write access to encrypted HoloMem memory.

```typescript
import { HoloMemToolkit } from '@holomem/langchain';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import type { ChatPromptTemplate } from '@langchain/core/prompts';

const toolkit = new HoloMemToolkit({
  sessionId: 'research-agent-session',
  apiKey: process.env.HOLOMEM_API_KEY!,
  encryptionKey: process.env.HOLOMEM_ENCRYPTION_KEY,
  agentId: 'research-agent',
  ttl: 'persistent',
});

const tools = toolkit.getTools();
// Includes: holomem_write_memory, holomem_recall_memories,
//           holomem_delete_memory, holomem_pin_memory

const prompt = await pull<ChatPromptTemplate>('hwchase17/openai-functions-agent');

const agent = await createOpenAIFunctionsAgent({
  llm: new ChatOpenAI({ modelName: 'gpt-4o' }),
  tools,
  prompt,
});

const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: 'Remember that the user prefers concise answers, then recall all memories.',
});

console.log(result.output);
```

## Configuration

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | HoloMem API key |
| `sessionId` | `string` | Yes | Namespace for memories |
| `encryptionKey` | `string` | Recommended | 64-char hex ECIES private key |
| `baseUrl` | `string` | No | Override API base URL |
| `agentId` | `string` | No | Tag memories with an agent identifier |
| `ttl` | `'working' \| 'episodic' \| 'persistent'` | No | Memory expiry tier (default: `'episodic'`) |

## License

MIT

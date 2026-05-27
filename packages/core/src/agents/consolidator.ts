import { encryptEpisodicData, decryptEpisodicData } from '../crypto/ecies.js';
import { createMemoryNode, createRelationshipEdge } from '../database/writer.js';
import { getChildMemories, getEntityWithPayload } from '../database/reader.js';
import { agentPublicKey, agentPrivateKey } from '../database/client.js';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { TTL } from '../constants.js';
import { type LLMProvider } from '../llm.js';

export interface ConsolidatorOutput {
  finalEntityKey: string;
  edgeEntityKey: string;
  txHash: string;
  report: string;
}

export async function runConsolidator(
  sessionId: string,
  planEntityKey: string,
  resultEntityKeys: string[],
  mock = false,
  llm?: LLMProvider,
): Promise<ConsolidatorOutput> {
  if (mock) {
    const report = `[Mock Final Report]

## Executive Summary
This mock report synthesizes findings from 4 research agents on decentralized AI infrastructure.

## Key Findings
1. **Current State**: The field is rapidly evolving with multiple competing architectures.
2. **Challenges**: Scalability, interoperability, and regulatory uncertainty remain top concerns.
3. **Opportunities**: Edge AI, privacy-preserving computation, and on-chain agent memory show promise.
4. **Future Outlook**: Decentralized AI infrastructure will likely merge with Web3 rails by 2028.

## Conclusion
HoloMem's cryptographic memory mesh positions itself at the intersection of these trends.`;

    return {
      finalEntityKey: `0x${'f'.repeat(64)}`,
      edgeEntityKey: `0x${'0'.repeat(64)}`,
      txHash: `0x${'1'.repeat(64)}`,
      report,
    };
  }

  // Reads can run in parallel — publicClient has no nonce constraint
  const decryptedFindings = await Promise.all(
    resultEntityKeys.map(async (key) => {
      const entity = await getEntityWithPayload(key);
      if (!entity?.payload) return null;
      try {
        const decrypted = decryptEpisodicData(
          JSON.parse(entity.payload).ciphertext,
          agentPrivateKey,
        );
        const parsed = JSON.parse(decrypted);
        return `## Step ${parsed.stepIndex + 1}: ${parsed.stepTitle}\n${parsed.findings}`;
      } catch {
        return null;
      }
    })
  );

  const validFindings = decryptedFindings.filter(Boolean) as string[];

  if (!llm) throw new Error('LLMProvider is required when not in mock mode');

  const report = await llm.complete(
    `You are a synthesis agent finalizing a multi-agent research swarm. Consolidate the following research findings into a comprehensive, well-structured final report with an executive summary, key insights per section, and a conclusion.

${validFindings.join('\n\n---\n\n')}

Format your response as a professional research report with clear headers using markdown.`,
    2048,
  );

  const finalPayload = JSON.stringify({
    report,
    sessionId,
    sourceEntityKeys: resultEntityKeys,
    createdAt: new Date().toISOString(),
  });
  const encrypted = encryptEpisodicData(finalPayload, agentPublicKey);

  const { entityKey: finalEntityKey, txHash } = await createMemoryNode({
    agentId: 'consolidator',
    sessionId,
    encryptedPayload: encrypted,
    ttlSeconds: ExpirationTime.fromDays(TTL.PERSISTENT_DAYS),
  });

  const { entityKey: edgeEntityKey } = await createRelationshipEdge({
    parentKey: planEntityKey,
    childKey: finalEntityKey,
    edgeType: 'task-delegation',
    sessionId,
    ttlSeconds: ExpirationTime.fromDays(TTL.PERSISTENT_DAYS),
  });

  return { finalEntityKey, edgeEntityKey, txHash, report };
}

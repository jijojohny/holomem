import { encryptEpisodicData, decryptEpisodicData } from '../crypto/ecies.js';
import { createMemoryNode, createRelationshipEdge } from '../database/writer.js';
import { getEntityWithPayload } from '../database/reader.js';
import { agentPublicKey, agentPrivateKey } from '../database/client.js';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { TTL, PlanStep } from '../constants.js';
import { type LLMProvider } from '../llm.js';

export interface ExecutorOutput {
  resultEntityKey: string;
  edgeEntityKey: string;
  txHash: string;
  agentIndex: number;
  stepTitle: string;
  preview: string;
}

export async function runExecutor(
  sessionId: string,
  planEntityKey: string,
  step: PlanStep,
  mock = false,
  llm?: LLMProvider,
): Promise<ExecutorOutput> {
  if (mock) {
    const key = `0x${'c'.repeat(62)}${step.index.toString().padStart(2, '0')}`;
    const edgeKey = `0x${'d'.repeat(62)}${step.index.toString().padStart(2, '0')}`;
    return {
      resultEntityKey: key,
      edgeEntityKey: edgeKey,
      txHash: `0x${'e'.repeat(64)}`,
      agentIndex: step.index,
      stepTitle: step.title,
      preview: `[mock] Research findings for "${step.title}"`,
    };
  }

  if (!llm) throw new Error('LLMProvider is required when not in mock mode');

  const findings = await llm.complete(
    `You are Research Agent #${step.index + 1} in an autonomous swarm.

Your assigned subtask: "${step.title}"
Instruction: ${step.instruction}

Provide a thorough, well-structured research response (200-400 words). Focus only on your assigned subtask. Be specific, insightful, and cite relevant trends or developments.`,
    1536,
  );
  const resultPayload = JSON.stringify({
    stepIndex: step.index,
    stepTitle: step.title,
    findings,
    sessionId,
    createdAt: new Date().toISOString(),
  });
  const encrypted = encryptEpisodicData(resultPayload, agentPublicKey);

  const { entityKey: resultEntityKey, txHash } = await createMemoryNode({
    agentId: `executor-${step.index}`,
    sessionId,
    encryptedPayload: encrypted,
    ttlSeconds: ExpirationTime.fromHours(TTL.EPISODIC_HOURS),
  });

  const { entityKey: edgeEntityKey } = await createRelationshipEdge({
    parentKey: planEntityKey,
    childKey: resultEntityKey,
    edgeType: 'reasoning-step',
    sessionId,
    ttlSeconds: ExpirationTime.fromHours(TTL.EPISODIC_HOURS),
  });

  return {
    resultEntityKey,
    edgeEntityKey,
    txHash,
    agentIndex: step.index,
    stepTitle: step.title,
    preview: findings.slice(0, 120) + '...',
  };
}

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { encryptEpisodicData } from '../crypto/ecies.js';
import { createMemoryNode } from '../database/writer.js';
import { agentPublicKey, agentPrivateKey } from '../database/client.js';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { TTL, PlanStep } from '../constants.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface PlannerOutput {
  sessionId: string;
  planEntityKey: string;
  txHash: string;
  steps: PlanStep[];
}

export async function runPlanner(researchQuestion: string, mock = false): Promise<PlannerOutput> {
  const sessionId = randomUUID().split('-')[0];

  if (mock) {
    return {
      sessionId,
      planEntityKey: `0x${'a'.repeat(64)}`,
      txHash: `0x${'b'.repeat(64)}`,
      steps: [
        { index: 0, title: 'Current State', instruction: 'Analyze the current state of decentralized AI' },
        { index: 1, title: 'Key Challenges', instruction: 'Identify major technical and adoption challenges' },
        { index: 2, title: 'Opportunities', instruction: 'Map key opportunities and growth vectors' },
        { index: 3, title: 'Future Outlook', instruction: 'Project where this will be in 5 years' },
      ],
    };
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a research planning agent. Break this research question into exactly 4 distinct, non-overlapping subtasks.

Research question: "${researchQuestion}"

Return ONLY a JSON array with this exact structure, no other text:
[
  {"index": 0, "title": "Short title", "instruction": "Detailed instruction for this subtask"},
  {"index": 1, "title": "Short title", "instruction": "Detailed instruction for this subtask"},
  {"index": 2, "title": "Short title", "instruction": "Detailed instruction for this subtask"},
  {"index": 3, "title": "Short title", "instruction": "Detailed instruction for this subtask"}
]`,
    }],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const steps: PlanStep[] = JSON.parse(rawText.trim());

  const planPayload = JSON.stringify({ question: researchQuestion, steps, sessionId, createdAt: new Date().toISOString() });
  const encrypted = encryptEpisodicData(planPayload, agentPublicKey);

  const { entityKey: planEntityKey, txHash } = await createMemoryNode({
    agentId: 'planner',
    sessionId,
    encryptedPayload: encrypted,
    ttlSeconds: ExpirationTime.fromMinutes(TTL.WORKING_MEMORY_MINUTES),
  });

  return { sessionId, planEntityKey, txHash, steps };
}

export const PROJECT_ATTRIBUTE = { key: 'project', value: 'HOLOMEM_SYSTEM_PROD' } as const;

export const TTL = {
  WORKING_MEMORY_MINUTES: 15,
  EPISODIC_HOURS: 1,
  SESSION_HOURS: 24,
  PERSISTENT_DAYS: 30,
} as const;

export const BRAGA_RPC = process.env.BRAGA_RPC_URL ?? 'https://braga.hoodi.arkiv.network/rpc';

export type EdgeType = 'reasoning-step' | 'task-delegation';

export interface PlanStep {
  index: number;
  title: string;
  instruction: string;
}

export interface MemoryNodePayload {
  data: string;
  sessionId: string;
  agentId: string;
  createdAt: string;
}

export interface RelationshipEdgePayload {
  handshakeSig: string;
  edgeType: EdgeType;
  createdAt: string;
}

export interface SwarmResult {
  sessionId: string;
  planEntityKey: string;
  planTxHash: string;
  steps: PlanStep[];
  resultEntityKeys: string[];
  finalEntityKey: string;
  finalTxHash: string;
  report: string;
  txHashes: string[];
}

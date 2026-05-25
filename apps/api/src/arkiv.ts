import { jsonToPayload, ExpirationTime } from '@arkiv-network/sdk/utils';
import { eq, and } from '@arkiv-network/sdk/query';
import { publicClient, walletClient, enqueueWrite } from './wallet-pool/index.js';

const PROJECT_ATTRIBUTE = { key: 'project', value: 'HOLOMEM_SYSTEM_PROD' } as const;
const PROJECT_VALUE = 'HOLOMEM_SYSTEM_PROD';

export const TTL_SECONDS = {
  working: ExpirationTime.fromMinutes(15),
  episodic: ExpirationTime.fromMinutes(60),
  persistent: ExpirationTime.fromMinutes(60 * 24 * 30),
} as const;

export type TtlTier = keyof typeof TTL_SECONDS;

export interface WriteMemoryParams {
  sessionId: string;
  agentId?: string;
  ciphertext: string;
  ttlTier: TtlTier;
}

export interface MemoryRecord {
  entityKey: string;
  sessionId: string;
  agentId: string;
  ciphertext: string | null;
  createdAt: string;
}

export async function writeMemory(params: WriteMemoryParams): Promise<{ entityKey: string; txHash: string }> {
  const attributes = [
    PROJECT_ATTRIBUTE,
    { key: 'type', value: 'memory-node' },
    { key: 'sessionId', value: params.sessionId },
    { key: 'agentId', value: params.agentId ?? 'sdk' },
  ];

  return enqueueWrite(() =>
    walletClient.createEntity({
      payload: jsonToPayload({ ciphertext: params.ciphertext }),
      contentType: 'application/json',
      attributes,
      expiresIn: TTL_SECONDS[params.ttlTier],
    })
  );
}

export async function readMemory(entityKey: string): Promise<MemoryRecord | null> {
  const entity = await publicClient.getEntity(entityKey as `0x${string}`);
  if (!entity) return null;

  const attrs: Record<string, string> = {};
  for (const a of (entity.attributes ?? [])) {
    attrs[String(a.key)] = String(a.value);
  }

  let ciphertext: string | null = null;
  try {
    const raw = entity.toText?.() ?? null;
    if (raw) {
      const parsed = JSON.parse(raw);
      ciphertext = parsed.ciphertext ?? null;
    }
  } catch {
    ciphertext = null;
  }

  return {
    entityKey,
    sessionId: attrs['sessionId'] ?? '',
    agentId: attrs['agentId'] ?? '',
    ciphertext,
    createdAt: attrs['createdAt'] ?? '',
  };
}

export interface EdgeRecord {
  entityKey: string;
  parentKey: string;
  childKey: string;
  edgeType: string;
  sessionId: string;
}

export async function writeRelationshipEdge(params: {
  parentKey: string;
  childKey: string;
  edgeType: string;
  sessionId: string;
}): Promise<{ entityKey: string; txHash: string }> {
  const attributes = [
    PROJECT_ATTRIBUTE,
    { key: 'type', value: 'relationship-edge' },
    { key: 'parentKey', value: params.parentKey },
    { key: 'childKey', value: params.childKey },
    { key: 'edgeType', value: params.edgeType },
    { key: 'sessionId', value: params.sessionId },
  ];

  return enqueueWrite(() =>
    walletClient.createEntity({
      payload: jsonToPayload({ edgeType: params.edgeType, createdAt: new Date().toISOString() }),
      contentType: 'application/json',
      attributes,
      expiresIn: TTL_SECONDS['episodic'],
    })
  );
}

export async function listEdgesByParent(parentKey: string): Promise<EdgeRecord[]> {
  const result = await publicClient
    .buildQuery()
    .where(
      and([
        eq('project', PROJECT_VALUE),
        eq('type', 'relationship-edge'),
        eq('parentKey', parentKey),
      ])
    )
    .withAttributes(true)
    .withPayload(false)
    .limit(50)
    .fetch();

  return result.entities.map((entity: any) => {
    const attrs: Record<string, string> = {};
    for (const a of (entity.attributes ?? [])) {
      attrs[String(a.key)] = String(a.value);
    }
    return {
      entityKey: entity.key,
      parentKey: attrs['parentKey'] ?? '',
      childKey: attrs['childKey'] ?? '',
      edgeType: attrs['edgeType'] ?? '',
      sessionId: attrs['sessionId'] ?? '',
    };
  });
}

export async function listSessionMemories(sessionId: string): Promise<MemoryRecord[]> {
  const result = await publicClient
    .buildQuery()
    .where(
      and([
        eq('project', PROJECT_VALUE),
        eq('type', 'memory-node'),
        eq('sessionId', sessionId),
      ])
    )
    .withAttributes(true)
    .withPayload(true)
    .limit(50)
    .fetch();

  return result.entities.map((entity: any) => {
    const attrs: Record<string, string> = {};
    for (const a of (entity.attributes ?? [])) {
      attrs[String(a.key)] = String(a.value);
    }

    let ciphertext: string | null = null;
    try {
      const raw = entity.toText?.() ?? null;
      if (raw) {
        const parsed = JSON.parse(raw);
        ciphertext = parsed.ciphertext ?? null;
      }
    } catch {
      ciphertext = null;
    }

    return {
      entityKey: entity.key,
      sessionId: attrs['sessionId'] ?? '',
      agentId: attrs['agentId'] ?? '',
      ciphertext,
      createdAt: attrs['createdAt'] ?? '',
    };
  });
}

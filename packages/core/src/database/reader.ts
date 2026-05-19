import { publicClient } from './client.js';
import { eq, and } from '@arkiv-network/sdk/query';

const PROJECT_VALUE = 'HOLOMEM_SYSTEM_PROD';

export interface EntityRecord {
  key: string;
  attributes: Array<{ key: string; value: string | number }>;
  payload: string | null;
}

function toRecord(entity: any): EntityRecord {
  let payload: string | null = null;
  try {
    payload = entity.toText?.() ?? null;
  } catch {
    payload = null;
  }
  return {
    key: entity.key,
    attributes: entity.attributes ?? [],
    payload,
  };
}

export async function getMemoryNode(entityKey: string): Promise<EntityRecord | null> {
  const entity = await publicClient.getEntity(entityKey as `0x${string}`);
  if (!entity) return null;
  return toRecord(entity);
}

export async function getChildMemories(parentKey: string): Promise<EntityRecord[]> {
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

  return result.entities.map(toRecord);
}

export async function queryBySession(sessionId: string, type: 'memory-node' | 'relationship-edge'): Promise<EntityRecord[]> {
  const result = await publicClient
    .buildQuery()
    .where(
      and([
        eq('project', PROJECT_VALUE),
        eq('type', type),
        eq('sessionId', sessionId),
      ])
    )
    .withAttributes(true)
    .withPayload(true)
    .limit(50)
    .fetch();

  return result.entities.map(toRecord);
}

export async function getEntityWithPayload(entityKey: string): Promise<EntityRecord | null> {
  const entity = await publicClient.getEntity(entityKey as `0x${string}`);
  if (!entity) return null;
  return toRecord(entity);
}

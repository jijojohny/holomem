import { jsonToPayload, ExpirationTime } from '@arkiv-network/sdk/utils';
import { walletClient, publicClient, writeQueue } from './client.js';
import { PROJECT_ATTRIBUTE, EdgeType } from '../constants.js';

export interface CreateMemoryNodeParams {
  agentId: string;
  sessionId: string;
  encryptedPayload: string;
  ttlSeconds: number;
}

export interface CreateRelationshipEdgeParams {
  parentKey: string;
  childKey: string;
  edgeType: EdgeType;
  sessionId: string;
  ttlSeconds: number;
}

export async function createMemoryNode(params: CreateMemoryNodeParams): Promise<{ entityKey: string; txHash: string }> {
  return writeQueue.enqueue(() =>
    walletClient.createEntity({
      payload: jsonToPayload({ ciphertext: params.encryptedPayload }),
      contentType: 'application/json',
      attributes: [
        PROJECT_ATTRIBUTE,
        { key: 'type', value: 'memory-node' },
        { key: 'agentId', value: params.agentId },
        { key: 'sessionId', value: params.sessionId },
      ],
      expiresIn: params.ttlSeconds,
    })
  );
}

export async function createRelationshipEdge(params: CreateRelationshipEdgeParams): Promise<{ entityKey: string; txHash: string }> {
  return writeQueue.enqueue(() =>
    walletClient.createEntity({
      payload: jsonToPayload({ edgeType: params.edgeType, createdAt: new Date().toISOString() }),
      contentType: 'application/json',
      attributes: [
        PROJECT_ATTRIBUTE,
        { key: 'type', value: 'relationship-edge' },
        { key: 'parentKey', value: params.parentKey },
        { key: 'childKey', value: params.childKey },
        { key: 'edgeType', value: params.edgeType },
        { key: 'sessionId', value: params.sessionId },
      ],
      expiresIn: params.ttlSeconds,
    })
  );
}

// Read-Merge-Write pattern: fetch existing attributes first to avoid destructive replacement.
// Arkiv's updateEntity completely replaces all attributes; omitting any key drops it from the index.
// ttlSeconds is required by updateEntity — pass the remaining or desired TTL.
export async function safeUpdateMemoryNode(
  entityKey: string,
  encryptedPayload: string,
  ttlSeconds: number,
): Promise<string> {
  const existing = await publicClient.getEntity(entityKey as `0x${string}`);
  if (!existing) throw new Error(`Entity ${entityKey} is expired or does not exist`);

  const existingAttrs = (existing.attributes ?? []).map((a: { key: string; value: string | number }) => ({
    key: a.key,
    value: a.value,
  }));

  // Ensure PROJECT_ATTRIBUTE is always preserved
  if (!existingAttrs.some((a) => a.key === 'project')) {
    existingAttrs.push(PROJECT_ATTRIBUTE);
  }

  const result = await writeQueue.enqueue(() =>
    walletClient.updateEntity({
      entityKey: entityKey as `0x${string}`,
      payload: jsonToPayload({ ciphertext: encryptedPayload }),
      contentType: 'application/json',
      attributes: existingAttrs,
      expiresIn: ttlSeconds,
    })
  );

  return result.txHash;
}

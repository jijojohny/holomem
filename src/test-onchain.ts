import 'dotenv/config';
import { createMemoryNode, createRelationshipEdge } from './database/writer.js';
import { getMemoryNode, getChildMemories } from './database/reader.js';
import { encryptEpisodicData, decryptEpisodicData } from './crypto/ecies.js';
import { agentPublicKey, agentPrivateKey, agentAddress } from './database/client.js';
import { ExpirationTime } from '@arkiv-network/sdk/utils';

async function main() {
  console.log('\n=== HoloMem On-Chain Test ===\n');
  console.log('Wallet address:', agentAddress);
  console.log('Public key    :', agentPublicKey.slice(0, 20) + '...\n');

  // 1. Encrypt a test payload
  const plaintext = JSON.stringify({ message: 'Hello from HoloMem!', ts: new Date().toISOString() });
  const encrypted = encryptEpisodicData(plaintext, agentPublicKey);
  console.log('Encrypted payload (first 40 chars):', encrypted.slice(0, 40) + '...');

  // 2. Write a MemoryNode to Braga
  console.log('\n[1/4] Writing MemoryNode to Arkiv Braga...');
  const { entityKey, txHash } = await createMemoryNode({
    agentId: 'test-agent',
    sessionId: 'test-session-001',
    encryptedPayload: encrypted,
    ttlSeconds: ExpirationTime.fromMinutes(30),
  });
  console.log('  entityKey :', entityKey);
  console.log('  txHash    :', txHash);
  console.log('  Explorer  : https://explorer.braga.hoodi.arkiv.network');

  // 3. Read it back
  console.log('\n[2/4] Reading MemoryNode back from Arkiv...');
  const fetched = await getMemoryNode(entityKey);
  if (!fetched) {
    console.log('  ERROR: entity not found after write!');
    return;
  }
  console.log('  Found entity with', fetched.attributes.length, 'attributes');
  console.log('  Attributes:', fetched.attributes.map(a => `${a.key}=${a.value}`).join(', '));

  // 4. Decrypt the payload
  console.log('\n[3/4] Decrypting payload...');
  const rawPayload = fetched.payload ? JSON.parse(fetched.payload) : null;
  if (!rawPayload?.ciphertext) {
    console.log('  ERROR: no ciphertext in payload');
    return;
  }
  const decrypted = decryptEpisodicData(rawPayload.ciphertext, agentPrivateKey);
  console.log('  Decrypted:', decrypted);

  // 5. Write a RelationshipEdge linking to itself (self-reference for test)
  console.log('\n[4/4] Writing RelationshipEdge...');
  const edge = await createRelationshipEdge({
    parentKey: entityKey,
    childKey: entityKey,
    edgeType: 'reasoning-step',
    sessionId: 'test-session-001',
    ttlSeconds: ExpirationTime.fromMinutes(30),
  });
  console.log('  edgeKey   :', edge.entityKey);
  console.log('  txHash    :', edge.txHash);

  // 6. Query children
  console.log('\n[5] Querying children of MemoryNode...');
  const children = await getChildMemories(entityKey);
  console.log('  Found', children.length, 'RelationshipEdge(s)');

  console.log('\n=== All on-chain operations succeeded! ===');
  console.log('\nVerify on explorer:');
  console.log('  https://explorer.braga.hoodi.arkiv.network');
  console.log('  Search txHash:', txHash);
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  if (err.message.includes('insufficient') || err.message.includes('funds') || err.message.includes('gas')) {
    console.error('\nWallet may be out of GLM. Fund at: https://discord.gg/golem (Braga faucet channel)');
  }
  process.exit(1);
});

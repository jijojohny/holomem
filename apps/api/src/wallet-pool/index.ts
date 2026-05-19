import { createPublicClient, createWalletClient, http } from '@arkiv-network/sdk';
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
import { braga } from '@arkiv-network/sdk/chains';

const BRAGA_RPC = process.env.BRAGA_RPC_URL ?? 'https://braga.hoodi.arkiv.network/rpc';

const rpcTransport = http(BRAGA_RPC);

export const publicClient = createPublicClient({
  chain: braga,
  transport: rpcTransport,
});

// Sequential write queue — single wallet, prevents nonce collisions across concurrent requests
class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => {});
    return next;
  }
}

const writeQueue = new WriteQueue();

function buildWalletClient() {
  const raw = process.env.POOL_WALLET_PRIVATE_KEY;
  if (!raw) throw new Error('POOL_WALLET_PRIVATE_KEY not set');
  const pk = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  if (pk.length !== 66) throw new Error(`POOL_WALLET_PRIVATE_KEY must be 32 bytes (64 hex chars)`);
  const account = privateKeyToAccount(pk);
  return createWalletClient({ account, chain: braga, transport: rpcTransport });
}

const walletClient = buildWalletClient();

export function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  return writeQueue.enqueue(fn);
}

export { walletClient };

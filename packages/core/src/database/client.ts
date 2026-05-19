import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from '@arkiv-network/sdk';
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
import { braga } from '@arkiv-network/sdk/chains';
import { BRAGA_RPC } from '../constants.js';

const rpcTransport = BRAGA_RPC !== braga.rpcUrls.default.http[0]
  ? http(BRAGA_RPC)
  : http();

export const publicClient = createPublicClient({
  chain: braga,
  transport: rpcTransport,
});

function getWalletClient() {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) throw new Error('AGENT_PRIVATE_KEY not set in .env');
  const pk = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  if (pk.length !== 66) throw new Error(`AGENT_PRIVATE_KEY must be 32 bytes (64 hex chars). Got ${pk.length - 2} chars.`);
  const account = privateKeyToAccount(pk);
  return {
    client: createWalletClient({ account, chain: braga, transport: rpcTransport }),
    publicKey: account.publicKey,
    privateKey: pk,
    address: account.address,
  };
}

const wallet = getWalletClient();
export const walletClient = wallet.client;
export const agentPublicKey = wallet.publicKey;
export const agentPrivateKey = wallet.privateKey;
export const agentAddress = wallet.address;

// Sequential write queue — prevents nonce collisions when multiple writes happen close together.
// The Arkiv SDK shares a single nonce counter per wallet; parallel createEntity calls would
// generate identical nonces and get rejected by the L3 chain.
class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    // Swallow errors on the tail so queue doesn't stall on rejections
    this.tail = next.catch(() => {});
    return next;
  }
}

export const writeQueue = new WriteQueue();

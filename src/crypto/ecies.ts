import { encrypt, decrypt } from 'eciesjs';

export function encryptEpisodicData(plaintext: string, publicKeyHex: string): string {
  // publicKeyHex is 0x-prefixed uncompressed secp256k1 key (132 chars)
  // eciesjs accepts hex string directly (no 0x prefix)
  const pubHex = publicKeyHex.startsWith('0x') ? publicKeyHex.slice(2) : publicKeyHex;
  const encrypted = encrypt(pubHex, Buffer.from(plaintext, 'utf8'));
  return Buffer.from(encrypted).toString('hex');
}

export function decryptEpisodicData(ciphertextHex: string, privateKeyHex: string): string {
  // privateKeyHex is 0x-prefixed 32-byte private key (66 chars)
  const privHex = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const decrypted = decrypt(privHex, Buffer.from(ciphertextHex, 'hex'));
  return Buffer.from(decrypted).toString('utf8');
}

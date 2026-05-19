from ecies import encrypt, decrypt
from ecies.utils import generate_key


def generate_encryption_key() -> tuple[str, str]:
    """Returns (private_key_hex, public_key_hex) — save private_key_hex for recall."""
    sk = generate_key()
    priv = sk.secret.hex()
    pub = sk.public_key.format(compressed=True).hex()
    return priv, pub


def encrypt_memory(plaintext: str, public_key_hex: str) -> str:
    ciphertext = encrypt(public_key_hex, plaintext.encode("utf-8"))
    return ciphertext.hex()


def decrypt_memory(ciphertext_hex: str, private_key_hex: str) -> str:
    plaintext = decrypt(private_key_hex, bytes.fromhex(ciphertext_hex))
    return plaintext.decode("utf-8")

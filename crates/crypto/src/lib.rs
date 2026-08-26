//! AES-256-GCM envelope encryption for secrets stored at rest (OAuth access
//! and refresh tokens). The key is supplied by the caller (loaded once from
//! `Config::token_encryption_key_b64`, itself from the `TOKEN_ENCRYPTION_KEY`
//! env var) and never persisted alongside the ciphertext it protects.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::Engine;
use rand::TryRng;

#[derive(thiserror::Error, Debug)]
pub enum CryptoError {
    #[error("invalid encryption key: {0}")]
    InvalidKey(String),
    #[error("encryption failed")]
    EncryptFailed,
    #[error("decryption failed (wrong key, or ciphertext was tampered with)")]
    DecryptFailed,
}

pub const NONCE_LEN: usize = 12;

#[derive(Clone)]
pub struct TokenCipher {
    cipher: Aes256Gcm,
}

/// Ciphertext + the nonce used to produce it. Both must be stored; the nonce
/// is not secret but must never be reused with the same key.
pub struct Encrypted {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

impl TokenCipher {
    pub fn from_base64_key(key_b64: &str) -> Result<Self, CryptoError> {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(key_b64)
            .map_err(|e| CryptoError::InvalidKey(e.to_string()))?;
        let key_arr: [u8; 32] = bytes.try_into().map_err(|_| {
            CryptoError::InvalidKey("key must be exactly 32 bytes (AES-256)".to_string())
        })?;
        let key = Key::<Aes256Gcm>::from(key_arr);
        Ok(Self {
            cipher: Aes256Gcm::new(&key),
        })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<Encrypted, CryptoError> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::rngs::SysRng
            .try_fill_bytes(&mut nonce_bytes)
            .map_err(|_| CryptoError::EncryptFailed)?;
        let nonce = Nonce::from(nonce_bytes);
        let ciphertext = self
            .cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| CryptoError::EncryptFailed)?;
        Ok(Encrypted {
            ciphertext,
            nonce: nonce_bytes.to_vec(),
        })
    }

    pub fn decrypt(&self, ciphertext: &[u8], nonce: &[u8]) -> Result<String, CryptoError> {
        if nonce.len() != NONCE_LEN {
            return Err(CryptoError::DecryptFailed);
        }
        let nonce = Nonce::try_from(nonce).map_err(|_| CryptoError::DecryptFailed)?;
        let plaintext = self
            .cipher
            .decrypt(&nonce, ciphertext)
            .map_err(|_| CryptoError::DecryptFailed)?;
        String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptFailed)
    }
}

/// Generates a fresh base64-encoded 32-byte key, e.g. for seeding
/// `TOKEN_ENCRYPTION_KEY` in a new `.env`. Not used at runtime.
pub fn generate_key_b64() -> String {
    let mut key = [0u8; 32];
    rand::rngs::SysRng
        .try_fill_bytes(&mut key)
        .expect("OS RNG failure");
    base64::engine::general_purpose::STANDARD.encode(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_round_trip() {
        let key = generate_key_b64();
        let cipher = TokenCipher::from_base64_key(&key).unwrap();
        let plaintext = "ya29.super-secret-oauth-access-token";
        let enc = cipher.encrypt(plaintext).unwrap();
        assert_ne!(enc.ciphertext, plaintext.as_bytes());
        let decrypted = cipher.decrypt(&enc.ciphertext, &enc.nonce).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn decrypt_fails_with_wrong_key() {
        let cipher_a = TokenCipher::from_base64_key(&generate_key_b64()).unwrap();
        let cipher_b = TokenCipher::from_base64_key(&generate_key_b64()).unwrap();
        let enc = cipher_a.encrypt("secret").unwrap();
        assert!(cipher_b.decrypt(&enc.ciphertext, &enc.nonce).is_err());
    }

    #[test]
    fn decrypt_fails_on_tampered_ciphertext() {
        let cipher = TokenCipher::from_base64_key(&generate_key_b64()).unwrap();
        let mut enc = cipher.encrypt("secret").unwrap();
        enc.ciphertext[0] ^= 0xFF;
        assert!(cipher.decrypt(&enc.ciphertext, &enc.nonce).is_err());
    }

    #[test]
    fn rejects_wrong_key_length() {
        let short_key = base64::engine::general_purpose::STANDARD.encode([0u8; 16]);
        assert!(TokenCipher::from_base64_key(&short_key).is_err());
    }
}

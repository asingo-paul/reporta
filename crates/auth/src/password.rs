use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand_core::OsRng;

#[derive(thiserror::Error, Debug)]
pub enum PasswordError {
    #[error("password does not meet strength requirements: {0}")]
    TooWeak(&'static str),
    #[error("hashing failed")]
    HashFailed,
}

/// Minimum length enforced server-side regardless of what client-side JS
/// validation does — never trust the client alone.
const MIN_LENGTH: usize = 10;

pub fn validate_strength(password: &str) -> Result<(), PasswordError> {
    if password.chars().count() < MIN_LENGTH {
        return Err(PasswordError::TooWeak("must be at least 10 characters"));
    }
    let has_letter = password.chars().any(|c| c.is_alphabetic());
    let has_digit_or_symbol = password.chars().any(|c| !c.is_alphabetic());
    if !has_letter || !has_digit_or_symbol {
        return Err(PasswordError::TooWeak(
            "must mix letters with numbers or symbols",
        ));
    }
    Ok(())
}

/// Argon2id with library defaults (19 MiB memory, 2 iterations, 1 lane) —
/// OWASP's current baseline recommendation for interactive login hashing.
pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| PasswordError::HashFailed)
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_round_trip() {
        let hash = hash_password("correct-horse-battery-staple1").unwrap();
        assert!(verify_password("correct-horse-battery-staple1", &hash));
        assert!(!verify_password("wrong-password", &hash));
    }

    #[test]
    fn rejects_short_passwords() {
        assert!(validate_strength("short1").is_err());
    }

    #[test]
    fn rejects_letters_only() {
        assert!(validate_strength("allletters").is_err());
    }

    #[test]
    fn accepts_strong_password() {
        assert!(validate_strength("correct-horse-battery-staple1").is_ok());
    }
}

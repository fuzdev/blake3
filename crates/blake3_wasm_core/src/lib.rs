//! WebAssembly bindings for BLAKE3
//!
//! Provides one-shot hash functions and a streaming `Blake3Hasher` class
//! that can be called from TypeScript/JS via WebAssembly.

use wasm_bindgen::prelude::*;

//
// One-shot functions
//

/// Hash data and return the 32-byte digest.
#[wasm_bindgen]
pub fn hash(data: &[u8]) -> Vec<u8> {
    blake3::hash(data).as_bytes().to_vec()
}

/// Keyed hash (MAC). Key must be exactly 32 bytes.
#[allow(clippy::missing_errors_doc)]
#[wasm_bindgen]
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}

/// Derive a key from context string and key material. Returns 32 bytes.
#[wasm_bindgen]
pub fn derive_key(context: &str, key_material: &[u8]) -> Vec<u8> {
    blake3::derive_key(context, key_material).to_vec()
}

//
// Streaming Hasher
//

/// Streaming BLAKE3 hasher supporting incremental updates.
#[wasm_bindgen]
pub struct Blake3Hasher {
    inner: blake3::Hasher,
}

impl Default for Blake3Hasher {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Blake3Hasher {
    /// Create a new hasher.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: blake3::Hasher::new(),
        }
    }

    /// Create a new keyed hasher. Key must be exactly 32 bytes.
    #[allow(clippy::missing_errors_doc)]
    pub fn new_keyed(key: &[u8]) -> Result<Self, JsError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
        Ok(Self {
            inner: blake3::Hasher::new_keyed(&key),
        })
    }

    /// Create a new key-derivation hasher.
    pub fn new_derive_key(context: &str) -> Self {
        Self {
            inner: blake3::Hasher::new_derive_key(context),
        }
    }

    /// Add data to the hasher.
    pub fn update(&mut self, data: &[u8]) {
        self.inner.update(data);
    }

    /// Finalize and return the 32-byte digest.
    pub fn finalize(&self) -> Vec<u8> {
        self.inner.finalize().as_bytes().to_vec()
    }

    /// Finalize the current hash and reset the hasher. Returns the 32-byte digest.
    /// Equivalent to calling `finalize()` then `reset()`, but in a single WASM call.
    pub fn finalize_and_reset(&mut self) -> Vec<u8> {
        let result = self.inner.finalize().as_bytes().to_vec();
        self.inner.reset();
        result
    }

    /// Reset the hasher to its initial state.
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}

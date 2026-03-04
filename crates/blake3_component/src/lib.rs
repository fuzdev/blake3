use std::cell::RefCell;

use exports::fuzdev::blake3::hashing;

wit_bindgen::generate!({
    path: "../../wit",
    world: "blake3",
});

struct Component;

export!(Component);

impl hashing::Guest for Component {
    type Hasher = HasherResource;

    fn hash(data: Vec<u8>) -> Vec<u8> {
        blake3::hash(&data).as_bytes().to_vec()
    }

    fn keyed_hash(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(blake3::keyed_hash(&key, &data).as_bytes().to_vec())
    }

    fn derive_key(context: String, key_material: Vec<u8>) -> Vec<u8> {
        blake3::derive_key(&context, &key_material).to_vec()
    }
}

struct HasherResource {
    inner: RefCell<blake3::Hasher>,
}

impl hashing::GuestHasher for HasherResource {
    fn new() -> Self {
        Self {
            inner: RefCell::new(blake3::Hasher::new()),
        }
    }

    fn new_keyed(key: Vec<u8>) -> Result<hashing::Hasher, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_keyed(&key)),
        }))
    }

    fn new_derive_key(context: String) -> hashing::Hasher {
        hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_derive_key(&context)),
        })
    }

    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }

    fn finalize(&self) -> Vec<u8> {
        self.inner.borrow().finalize().as_bytes().to_vec()
    }

    fn finalize_and_reset(&self) -> Vec<u8> {
        let mut inner = self.inner.borrow_mut();
        let result = inner.finalize().as_bytes().to_vec();
        inner.reset();
        result
    }

    fn reset(&self) {
        self.inner.borrow_mut().reset();
    }
}

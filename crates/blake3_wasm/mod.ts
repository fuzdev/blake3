import { Blake3Hasher, derive_key, hash, keyed_hash } from './pkg/deno/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };
export type { Blake3HasherInstance } from './types.ts';
export type { StreamFunctions } from './stream.ts';

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(
	Blake3Hasher,
);

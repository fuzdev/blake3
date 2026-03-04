import { readFileSync } from 'node:fs';
import { Blake3Hasher, derive_key, hash, initSync, keyed_hash } from './pkg/web/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };
export type { Blake3HasherInstance } from './types.ts';
export type { StreamFunctions } from './stream.ts';

const wasm = readFileSync(new URL('./pkg/web/blake3_wasm_bg.wasm', import.meta.url));
initSync({ module: wasm });

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(
	Blake3Hasher,
);

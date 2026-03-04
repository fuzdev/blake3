import type { Blake3HasherConstructor, Blake3HasherInstance } from './types.ts';

// 16 KB — benchmarked across runtimes (see benches/CLAUDE.md).
// Smaller batch allocation outweighs fewer update() calls vs 64 KB.
const BATCH_SIZE = 16_384;

/** Stream function signatures for re-export from entry points. */
export interface StreamFunctions {
	/** Hash a ReadableStream and return the 32-byte digest. */
	hash_stream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array>;
	/** Keyed hash a ReadableStream. Key must be exactly 32 bytes. */
	keyed_hash_stream(key: Uint8Array, stream: ReadableStream<Uint8Array>): Promise<Uint8Array>;
	/** Derive-key hash a ReadableStream. Returns 32 bytes. */
	derive_key_stream(
		context: string,
		stream: ReadableStream<Uint8Array>,
	): Promise<Uint8Array>;
}

/** Read all chunks from a stream into a hasher using batched updates to reduce WASM boundary crossings. */
async function hash_stream_core(
	hasher: Blake3HasherInstance,
	stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
	const reader = stream.getReader();
	let batch: Uint8Array | null = null;
	let offset = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value.length >= BATCH_SIZE) {
				if (offset > 0) {
					hasher.update(batch!.subarray(0, offset));
					offset = 0;
				}
				hasher.update(value);
			} else if (offset + value.length > BATCH_SIZE) {
				hasher.update(batch!.subarray(0, offset));
				batch!.set(value, 0);
				offset = value.length;
			} else {
				if (!batch) batch = new Uint8Array(BATCH_SIZE);
				batch.set(value, offset);
				offset += value.length;
			}
		}
		if (offset > 0) hasher.update(batch!.subarray(0, offset));
	} finally {
		reader.releaseLock();
	}
	return hasher.finalize();
}

/** Build stream convenience functions bound to a specific Blake3Hasher constructor. */
export function make_stream_functions(
	Hasher: Blake3HasherConstructor,
	check?: () => void,
): StreamFunctions {
	return {
		async hash_stream(stream) {
			check?.();
			const hasher = new Hasher();
			try {
				return await hash_stream_core(hasher, stream);
			} finally {
				hasher.free();
			}
		},
		async keyed_hash_stream(key, stream) {
			check?.();
			const hasher = Hasher.new_keyed(key);
			try {
				return await hash_stream_core(hasher, stream);
			} finally {
				hasher.free();
			}
		},
		async derive_key_stream(context, stream) {
			check?.();
			const hasher = Hasher.new_derive_key(context);
			try {
				return await hash_stream_core(hasher, stream);
			} finally {
				hasher.free();
			}
		},
	};
}

export type { StreamFunctions } from './stream.ts';

/** Streaming BLAKE3 hasher instance. */
export interface Blake3HasherInstance {
	/** Feed data into the hasher. May be called multiple times. */
	update(data: Uint8Array): void;
	/** Return the current 32-byte digest. Non-destructive — can be called multiple times. */
	finalize(): Uint8Array;
	/** Finalize the current hash and reset the hasher. Returns the 32-byte digest. */
	finalize_and_reset(): Uint8Array;
	/** Reset to initial state, preserving the hash mode (plain/keyed/derive). */
	reset(): void;
	/** Release WASM memory. Equivalent to `[Symbol.dispose]()`. */
	free(): void;
	/** TC39 explicit resource management — called automatically by `using`. Equivalent to `free()`. */
	[Symbol.dispose](): void;
}

/** Blake3Hasher constructor with static factory methods. */
export interface Blake3HasherConstructor {
	new (): Blake3HasherInstance;
	/** Throws if `key.length !== 32`. */
	new_keyed(key: Uint8Array): Blake3HasherInstance;
	new_derive_key(context: string): Blake3HasherInstance;
}

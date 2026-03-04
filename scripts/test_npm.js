/**
 * Node.js tests for the npm packages (@fuzdev/blake3_wasm and @fuzdev/blake3_wasm_small).
 *
 * Verifies the wasm-pack web target + auto-init wrapper works correctly
 * when imported as ESM in Node.js. Tests the same operations as
 * scripts/compare.ts but runs directly in Node.js against the built
 * pkg/web/ output.
 *
 * Usage: PKG_DIR=<pkg-dir> node --test scripts/test_npm.js
 *
 * Examples:
 *   PKG_DIR=crates/blake3_wasm/pkg/web node --test scripts/test_npm.js
 *   PKG_DIR=crates/blake3_wasm_small/pkg/web node --test scripts/test_npm.js
 *
 * Prerequisites: deno task build:wasm:web (or build:wasm:small:web)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg_dir = process.env.PKG_DIR;
if (!pkg_dir) {
	console.error('Usage: PKG_DIR=<pkg-dir> node --test scripts/test_npm.js');
	console.error('Example: PKG_DIR=crates/blake3_wasm/pkg/web node --test scripts/test_npm.js');
	process.exit(1);
}

const {
	Blake3Hasher,
	hash,
	keyed_hash,
	derive_key,
	hash_stream,
	keyed_hash_stream,
	derive_key_stream,
} = await import(`../${pkg_dir}/index.js`);

/** @type {Array<{label: string, input_hex: string, hash: string, keyed_hash: string, keyed_hash_key_hex: string, derive_key: string, derive_key_context: string}>} */
const test_vectors = JSON.parse(
	readFileSync(new URL('../test/test_vectors.json', import.meta.url), 'utf-8'),
);

const encoder = new TextEncoder();

/** @param {Uint8Array} bytes */
function to_hex(bytes) {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** @param {string} hex */
function hex_to_bytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

describe(`npm package: ${pkg_dir}`, () => {
	describe('one-shot hash', () => {
		for (const v of test_vectors) {
			it(`hash(${v.label})`, () => {
				assert.equal(to_hex(hash(hex_to_bytes(v.input_hex))), v.hash);
			});
		}
	});

	describe('keyed hash', () => {
		for (const v of test_vectors) {
			it(`keyed_hash(${v.label})`, () => {
				const key = hex_to_bytes(v.keyed_hash_key_hex);
				assert.equal(to_hex(keyed_hash(key, hex_to_bytes(v.input_hex))), v.keyed_hash);
			});
		}
	});

	describe('derive key', () => {
		for (const v of test_vectors) {
			it(`derive_key(${v.label})`, () => {
				assert.equal(
					to_hex(derive_key(v.derive_key_context, hex_to_bytes(v.input_hex))),
					v.derive_key,
				);
			});
		}
	});

	describe('streaming hasher', () => {
		for (const v of test_vectors) {
			it(`single-chunk(${v.label})`, () => {
				const h = new Blake3Hasher();
				h.update(hex_to_bytes(v.input_hex));
				assert.equal(to_hex(h.finalize()), v.hash);
				h.free();
			});
		}

		it('multi-chunk matches one-shot', () => {
			const hello = encoder.encode('hello');
			const expected = to_hex(hash(hello));
			const h = new Blake3Hasher();
			h.update(encoder.encode('hel'));
			h.update(encoder.encode('lo'));
			assert.equal(to_hex(h.finalize()), expected);
			h.free();
		});

		it('byte-at-a-time matches one-shot', () => {
			const hello = encoder.encode('hello');
			const expected = to_hex(hash(hello));
			const h = new Blake3Hasher();
			for (const byte of hello) {
				h.update(new Uint8Array([byte]));
			}
			assert.equal(to_hex(h.finalize()), expected);
			h.free();
		});

		it('reset works', () => {
			const hello = encoder.encode('hello');
			const expected = to_hex(hash(hello));
			const h = new Blake3Hasher();
			h.update(encoder.encode('garbage'));
			h.reset();
			h.update(hello);
			assert.equal(to_hex(h.finalize()), expected);
			h.free();
		});

		it('finalize is non-destructive', () => {
			const h = new Blake3Hasher();
			h.update(encoder.encode('hello'));
			const first = to_hex(h.finalize());
			const second = to_hex(h.finalize());
			assert.equal(first, second);
			h.free();
		});

		it('finalize_and_reset returns digest and resets', () => {
			const hello = encoder.encode('hello');
			const hello_hash = to_hex(hash(hello));
			const h = new Blake3Hasher();
			h.update(hello);
			assert.equal(to_hex(h.finalize_and_reset()), hello_hash);
			// After reset, hashing new data should produce fresh result
			h.update(encoder.encode('world'));
			assert.equal(to_hex(h.finalize()), to_hex(hash(encoder.encode('world'))));
			h.free();
		});

		it('finalize_and_reset preserves keyed mode', () => {
			const key = new Uint8Array(32).fill(0x02);
			const hello = encoder.encode('hello');
			const h = Blake3Hasher.new_keyed(key);
			h.update(hello);
			assert.equal(to_hex(h.finalize_and_reset()), to_hex(keyed_hash(key, hello)));
			// After reset, keyed mode should be preserved
			const world = encoder.encode('world');
			h.update(world);
			assert.equal(to_hex(h.finalize()), to_hex(keyed_hash(key, world)));
			h.free();
		});

		it('finalize_and_reset preserves derive-key mode', () => {
			const context = 'blake3-wasm-test finalize_and_reset';
			const hello = encoder.encode('hello');
			const h = Blake3Hasher.new_derive_key(context);
			h.update(hello);
			assert.equal(to_hex(h.finalize_and_reset()), to_hex(derive_key(context, hello)));
			// After reset, derive-key mode should be preserved
			const world = encoder.encode('world');
			h.update(world);
			assert.equal(to_hex(h.finalize()), to_hex(derive_key(context, world)));
			h.free();
		});

		it('keyed streaming matches keyed one-shot', () => {
			const key = new Uint8Array(32).fill(0x01);
			const hello = encoder.encode('hello');
			const h = Blake3Hasher.new_keyed(key);
			h.update(hello);
			assert.equal(to_hex(h.finalize()), to_hex(keyed_hash(key, hello)));
			h.free();
		});

		it('derive-key streaming matches derive-key one-shot', () => {
			const context = 'blake3-wasm-test 2024';
			const hello = encoder.encode('hello');
			const h = Blake3Hasher.new_derive_key(context);
			h.update(hello);
			assert.equal(to_hex(h.finalize()), to_hex(derive_key(context, hello)));
			h.free();
		});
	});

	/** @param {Uint8Array} data */
	function make_stream(data) {
		return new ReadableStream({
			start(controller) {
				const mid = Math.floor(data.length / 2);
				if (mid > 0) controller.enqueue(data.subarray(0, mid));
				if (mid < data.length) controller.enqueue(data.subarray(mid));
				controller.close();
			},
		});
	}

	describe('stream functions', () => {
		for (const v of test_vectors) {
			it(`hash_stream(${v.label})`, async () => {
				const input = hex_to_bytes(v.input_hex);
				const result = await hash_stream(make_stream(input));
				assert.equal(to_hex(result), v.hash);
			});
		}

		for (const v of test_vectors) {
			it(`keyed_hash_stream(${v.label})`, async () => {
				const input = hex_to_bytes(v.input_hex);
				const key = hex_to_bytes(v.keyed_hash_key_hex);
				const result = await keyed_hash_stream(key, make_stream(input));
				assert.equal(to_hex(result), v.keyed_hash);
			});
		}

		for (const v of test_vectors) {
			it(`derive_key_stream(${v.label})`, async () => {
				const input = hex_to_bytes(v.input_hex);
				const result = await derive_key_stream(v.derive_key_context, make_stream(input));
				assert.equal(to_hex(result), v.derive_key);
			});
		}

		it('hash_stream batching (many small chunks)', async () => {
			// 128 chunks of 1KB = 128KB total, exercises batch accumulation + flush in hash_stream_core
			const chunk = new Uint8Array(1024).fill(0x42);
			const full = new Uint8Array(128 * 1024);
			for (let i = 0; i < 128; i++) full.set(chunk, i * 1024);
			const expected = to_hex(hash(full));
			const stream = new ReadableStream({
				start(controller) {
					for (let i = 0; i < 128; i++) controller.enqueue(chunk.slice());
					controller.close();
				},
			});
			const result = await hash_stream(stream);
			assert.equal(to_hex(result), expected);
		});

		it('hash_stream with 32KB chunk (batch bypass)', async () => {
			// Path 1: chunk >= BATCH_SIZE (16384) — flush accumulated, pass chunk directly
			const chunk = new Uint8Array(32768).fill(0x42);
			const expected = to_hex(hash(chunk));
			const stream = new ReadableStream({
				start(c) {
					c.enqueue(chunk);
					c.close();
				},
			});
			assert.equal(to_hex(await hash_stream(stream)), expected);
		});

		it('hash_stream batch overflow boundary', async () => {
			// Path 2: accumulated + chunk > BATCH_SIZE — flush, start new batch
			// 15 KB accumulated + 2 KB = 17 KB > 16 KB batch
			const small_chunks = Array.from({ length: 15 }, () => new Uint8Array(1024).fill(0xaa));
			const overflow_chunk = new Uint8Array(2048).fill(0xbb);
			const full = new Uint8Array(15 * 1024 + 2048);
			for (let i = 0; i < 15; i++) full.set(small_chunks[i], i * 1024);
			full.set(overflow_chunk, 15 * 1024);
			const expected = to_hex(hash(full));
			const stream = new ReadableStream({
				start(c) {
					for (const chunk of small_chunks) c.enqueue(chunk);
					c.enqueue(overflow_chunk);
					c.close();
				},
			});
			assert.equal(to_hex(await hash_stream(stream)), expected);
		});

		it('hash_stream mixed chunk sizes (all code paths)', async () => {
			const chunks = [
				new Uint8Array(100).fill(0x01), // path 3: small, accumulate
				new Uint8Array(16384).fill(0x02), // path 1: >= BATCH_SIZE, flush + direct
				new Uint8Array(8192).fill(0x03), // path 3: accumulate
				new Uint8Array(9000).fill(0x04), // path 2: 8192+9000 > 16384, overflow
				new Uint8Array(50).fill(0x05), // path 3: small, accumulate (leftover)
			];
			const total = chunks.reduce((a, c) => a + c.length, 0);
			const full = new Uint8Array(total);
			let offset = 0;
			for (const c of chunks) {
				full.set(c, offset);
				offset += c.length;
			}
			const expected = to_hex(hash(full));
			const stream = new ReadableStream({
				start(controller) {
					for (const c of chunks) controller.enqueue(c);
					controller.close();
				},
			});
			assert.equal(to_hex(await hash_stream(stream)), expected);
		});

		it('keyed_hash_stream throws on invalid key', async () => {
			await assert.rejects(
				() => keyed_hash_stream(new Uint8Array(16), make_stream(new Uint8Array(0))),
				{ message: /key must be exactly 32 bytes/ },
			);
		});
	});

	describe('Symbol.dispose', () => {
		it('Blake3Hasher has Symbol.dispose', () => {
			const h = new Blake3Hasher();
			assert.equal(typeof h[Symbol.dispose], 'function');
			h[Symbol.dispose]();
		});
	});

	describe('error paths', () => {
		it('keyed_hash throws on 16-byte key', () => {
			assert.throws(
				() => keyed_hash(new Uint8Array(16), new Uint8Array(0)),
				{ message: /key must be exactly 32 bytes/ },
			);
		});

		it('new_keyed throws on empty key', () => {
			assert.throws(
				() => Blake3Hasher.new_keyed(new Uint8Array(0)),
				{ message: /key must be exactly 32 bytes/ },
			);
		});

		it('new_keyed throws on 16-byte key', () => {
			assert.throws(
				() => Blake3Hasher.new_keyed(new Uint8Array(16)),
				{ message: /key must be exactly 32 bytes/ },
			);
		});
	});
});

// Browser entry (browser.js) — tests the init guard wrapper.
// Imports browser.js which does NOT auto-init WASM, then tests:
// - Pre-init guard throws clear error
// - Post-init_sync: hash, instanceof, Symbol.dispose, factory methods
describe(`browser entry: ${pkg_dir}`, () => {
	/** @type {any} */
	let browser;

	it('import browser.js', async () => {
		browser = await import(`../${pkg_dir}/browser.js`);
	});

	it('hash throws before init', () => {
		assert.throws(() => browser.hash(new Uint8Array(0)), /WASM not initialized/);
	});

	it('new Blake3Hasher() throws before init', () => {
		assert.throws(() => new browser.Blake3Hasher(), /WASM not initialized/);
	});

	it('Blake3Hasher.new_keyed() throws before init', () => {
		assert.throws(
			() => browser.Blake3Hasher.new_keyed(new Uint8Array(32)),
			/WASM not initialized/,
		);
	});

	it('hash_stream throws before init', async () => {
		const stream = new ReadableStream({
			start(c) {
				c.close();
			},
		});
		await assert.rejects(() => browser.hash_stream(stream), /WASM not initialized/);
	});

	it('init_sync initializes WASM', () => {
		const base = pkg_dir.includes('small') ? 'blake3_wasm_small' : 'blake3_wasm';
		const wasm = readFileSync(
			new URL(`../${pkg_dir}/${base}_bg.wasm`, import.meta.url),
		);
		browser.init_sync({ module: wasm });
	});

	it('hash works after init', () => {
		const hello = encoder.encode('hello');
		assert.equal(to_hex(browser.hash(hello)), to_hex(hash(hello)));
	});

	it('instanceof Blake3Hasher works', () => {
		const h = new browser.Blake3Hasher();
		assert.ok(h instanceof browser.Blake3Hasher);
		h.free();
	});

	it('Symbol.dispose works', () => {
		const h = new browser.Blake3Hasher();
		assert.equal(typeof h[Symbol.dispose], 'function');
		h[Symbol.dispose]();
	});

	it('new_keyed works', () => {
		const key = new Uint8Array(32).fill(0x01);
		const hello = encoder.encode('hello');
		const h = browser.Blake3Hasher.new_keyed(key);
		h.update(hello);
		assert.equal(to_hex(h.finalize()), to_hex(keyed_hash(key, hello)));
		h.free();
	});

	it('new_derive_key works', () => {
		const context = 'browser-test 2024';
		const hello = encoder.encode('hello');
		const h = browser.Blake3Hasher.new_derive_key(context);
		h.update(hello);
		assert.equal(to_hex(h.finalize()), to_hex(derive_key(context, hello)));
		h.free();
	});

	it('hash_stream works after init', async () => {
		const hello = encoder.encode('hello');
		const stream = new ReadableStream({
			start(c) {
				c.enqueue(hello);
				c.close();
			},
		});
		const result = await browser.hash_stream(stream);
		assert.equal(to_hex(result), to_hex(hash(hello)));
	});

	it('init_sync is idempotent', () => {
		// Should not throw — just returns early
		browser.init_sync({ module: new Uint8Array(0) });
		// Still works after redundant call
		assert.equal(
			to_hex(browser.hash(encoder.encode('hello'))),
			to_hex(hash(encoder.encode('hello'))),
		);
	});
});

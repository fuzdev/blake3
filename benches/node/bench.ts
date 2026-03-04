/**
 * BLAKE3 WASM Benchmark — Node.js / Bun entry point.
 *
 * Benchmarks blake3_wasm + blake3_wasm_small + npm:blake3-wasm.
 *
 * Run with: deno task bench:node
 *   or:     deno task bench:bun
 *
 * Environment variables:
 *   BENCH_DURATION   Duration per benchmark in ms (default: 3000)
 *   BENCH_WARMUP     Warmup iterations (default: 10)
 *   BENCH_RUNTIME    Runtime label for results (default: Node.js)
 *   BENCH_OUTPUT     JSON output path (default: benches/results/node.json)
 */

import process from 'node:process';

import {
	Blake3Hasher,
	derive_key,
	derive_key_stream,
	hash,
	hash_stream,
	keyed_hash,
	keyed_hash_stream,
} from '../../crates/blake3_wasm/mod_node.ts';
import {
	Blake3Hasher as Blake3HasherSmall,
	derive_key as derive_key_small,
	derive_key_stream as derive_key_stream_small,
	hash as hash_small,
	hash_stream as hash_stream_small,
	keyed_hash as keyed_hash_small,
	keyed_hash_stream as keyed_hash_stream_small,
} from '../../crates/blake3_wasm_small/mod_node.ts';
import blake3_npm from 'blake3-wasm';
import { make_runners, run_benchmarks } from '../lib/bench_core.ts';

const BENCH_DURATION = parseInt(process.env.BENCH_DURATION ?? '3000', 10);
const BENCH_WARMUP = parseInt(process.env.BENCH_WARMUP ?? '10', 10);
const runtime_label = process.env.BENCH_RUNTIME ?? 'Node.js';
const output_json = process.env.BENCH_OUTPUT ?? 'benches/results/node.json';

const runners = make_runners(
	[
		{
			label: 'blake3_wasm',
			hash,
			keyed_hash,
			derive_key,
			Blake3Hasher,
			hash_stream,
			keyed_hash_stream,
			derive_key_stream,
			wasm_path: 'crates/blake3_wasm/pkg/web/blake3_wasm_bg.wasm',
		},
		{
			label: 'blake3_wasm_small',
			hash: hash_small,
			keyed_hash: keyed_hash_small,
			derive_key: derive_key_small,
			Blake3Hasher: Blake3HasherSmall,
			hash_stream: hash_stream_small,
			keyed_hash_stream: keyed_hash_stream_small,
			derive_key_stream: derive_key_stream_small,
			wasm_path: 'crates/blake3_wasm_small/pkg/web/blake3_wasm_small_bg.wasm',
		},
	],
	{ module: blake3_npm, wasm_path: 'node_modules/blake3-wasm/dist/wasm/nodejs/blake3_js_bg.wasm' },
);

await run_benchmarks({
	duration_ms: BENCH_DURATION,
	warmup_iterations: BENCH_WARMUP,
	runners,
	runtime_label,
	output_json,
	gc_between_groups: true,
});

/**
 * ANSI styling for the benchmark modules: `node:util`'s `styleText` as `st`,
 * and the runtime colors for bar charts.
 */

import { styleText } from 'node:util';

type Format = Parameters<typeof styleText>[0];

export const st = styleText;

/** Fixed runtime → format mapping for bar charts. */
const RUNTIME_FORMATS: Record<string, Format> = {
	Bun: 'yellow',
	Deno: 'cyan',
	'Node.js': 'green',
	Wasmtime: 'magenta'
};

const FALLBACK: Format[] = ['cyan', 'green', 'yellow', 'magenta'];

/** Get the style format for a runtime by name (or index fallback). */
export const runtime_format = (name: string, index = 0): Format =>
	RUNTIME_FORMATS[name] ?? FALLBACK[index % FALLBACK.length]!;

/**
 * Configures `st` from `@fuzdev/fuz_util/print.js` with `node:util`'s `styleText`.
 *
 * Re-exports `st` for use across benchmark modules.
 */

import { styleText } from 'node:util';
import { configure_print_colors, st } from '@fuzdev/fuz_util/print.js';

configure_print_colors(styleText);

export { st };

type Format = Parameters<typeof styleText>[0];

/** Fixed runtime → format mapping for bar charts. */
const RUNTIME_FORMATS: Record<string, Format> = {
	Bun: 'yellow',
	Deno: 'cyan',
	'Node.js': 'green',
	Wasmtime: 'magenta',
};

const FALLBACK: Format[] = ['cyan', 'green', 'yellow', 'magenta'];

/** Get the style format for a runtime by name (or index fallback). */
export const runtime_format = (name: string, index = 0): Format =>
	RUNTIME_FORMATS[name] ?? FALLBACK[index % FALLBACK.length];

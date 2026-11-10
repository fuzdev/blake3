/**
 * Aligns markdown tables, padding each column to its widest cell, as markdown formatters do,
 * so a generated report reads as a table in plain text too.
 *
 * @module
 */

type Align = 'none' | 'left' | 'right' | 'center';

const SEPARATOR_CELL = /^:?-+:?$/;

/** A cell's display width, one column per code point (the report has no wide characters). */
const cell_width = (cell: string): number => [...cell].length;

const split_row = (line: string): Array<string> =>
	line
		.trim()
		.replace(/^\|/, '')
		.replace(/\|$/, '')
		.split('|')
		.map((cell) => cell.trim());

const to_align = (cell: string): Align => {
	const left = cell.startsWith(':');
	const right = cell.endsWith(':');
	if (left && right) return 'center';
	if (right) return 'right';
	if (left) return 'left';
	return 'none';
};

const pad_cell = (cell: string, width: number, align: Align): string => {
	const space = width - cell_width(cell);
	if (align === 'right') return ' '.repeat(space) + cell;
	if (align === 'center') {
		const before = Math.floor(space / 2);
		return ' '.repeat(before) + cell + ' '.repeat(space - before);
	}
	return cell + ' '.repeat(space);
};

const to_separator = (width: number, align: Align): string => {
	if (align === 'right') return '-'.repeat(width - 1) + ':';
	if (align === 'left') return ':' + '-'.repeat(width - 1);
	if (align === 'center') return ':' + '-'.repeat(width - 2) + ':';
	return '-'.repeat(width);
};

/** Aligns one table: a header row, a separator row, and body rows, all with the same columns. */
const align_table = (rows: Array<Array<string>>): Array<string> => {
	const aligns = rows[1]!.map(to_align);
	const widths = aligns.map((align, i) => {
		const min = align === 'center' ? 3 : align === 'none' ? 1 : 2;
		return rows.reduce(
			(width, row, row_index) => (row_index === 1 ? width : Math.max(width, cell_width(row[i]!))),
			min
		);
	});
	return rows.map((row, row_index) => {
		const cells = row.map((cell, i) =>
			row_index === 1
				? to_separator(widths[i]!, aligns[i]!)
				: pad_cell(cell, widths[i]!, aligns[i]!)
		);
		return `| ${cells.join(' | ')} |`;
	});
};

/**
 * Aligns every table in `markdown`, leaving other lines as they are. A table is a run of lines
 * starting with `|` whose second line is a separator row and whose rows all have its columns;
 * a run that isn't one is left as written.
 */
export const align_markdown_tables = (markdown: string): string => {
	const lines = markdown.split('\n');
	const output: Array<string> = [];
	let i = 0;
	while (i < lines.length) {
		if (!lines[i]!.startsWith('|')) {
			output.push(lines[i]!);
			i++;
			continue;
		}
		const start = i;
		while (i < lines.length && lines[i]!.startsWith('|')) i++;
		const block = lines.slice(start, i);
		const rows = block.map(split_row);
		const columns = rows[0]!.length;
		const is_table =
			rows.length >= 2 &&
			rows[1]!.every((cell) => SEPARATOR_CELL.test(cell)) &&
			rows.every((row) => row.length === columns);
		output.push(...(is_table ? align_table(rows) : block));
	}
	return output.join('\n');
};

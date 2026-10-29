type Cell = string | number | undefined | null;

/**
 * Escapes one CSV cell. Values beginning with characters that spreadsheets treat as formulas are
 * prefixed with an apostrophe so exported data cannot execute as a formula.
 */
export function csvCell(value: Cell): string {
  if (value === undefined || value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Triggers a browser download of `content` as a file. */
export function downloadTextFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
  // A BOM lets spreadsheet apps detect UTF-8 (₹ and other symbols).
  const blob = new Blob(['﻿', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Escapes a value for CSV (RFC 4180), neutralising spreadsheet formula injection. */
export function csvCell(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  let text = String(value);
  // Prefix cells that a spreadsheet would interpret as a formula.
  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | boolean | undefined | null)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Triggers a browser download of `blob` as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | boolean | undefined | null)[][]): void {
  // BOM so spreadsheet apps detect UTF-8 (₹ and accented names).
  downloadBlob(new Blob(['﻿', toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'household';
}

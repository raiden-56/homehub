import { describe, expect, it } from 'vitest';
import {
  MAX_DOCUMENT_BYTES,
  documentExpiryStatus,
  formatFileSize,
  titleFromFileName,
  validateDocumentFile,
} from '../logic';

const file = (name: string, type: string, size = 1024) => ({ name, type, size });

describe('validateDocumentFile', () => {
  it('accepts supported types with matching extensions', () => {
    expect(validateDocumentFile(file('invoice.pdf', 'application/pdf'))).toEqual({ ok: true, mimeType: 'application/pdf' });
    expect(validateDocumentFile(file('photo.JPG', 'image/jpeg'))).toEqual({ ok: true, mimeType: 'image/jpeg' });
    expect(validateDocumentFile(file('scan.webp', 'image/webp'))).toEqual({ ok: true, mimeType: 'image/webp' });
  });

  it('infers the type from the extension when the browser gives none', () => {
    expect(validateDocumentFile(file('notes.txt', ''))).toEqual({ ok: true, mimeType: 'text/plain' });
  });

  it('rejects files over 10 MB and empty files', () => {
    const big = validateDocumentFile(file('manual.pdf', 'application/pdf', MAX_DOCUMENT_BYTES + 1));
    expect(big.ok).toBe(false);
    expect(!big.ok && big.error).toMatch(/10 MB or smaller/);
    expect(validateDocumentFile(file('manual.pdf', 'application/pdf', MAX_DOCUMENT_BYTES)).ok).toBe(true);
    expect(validateDocumentFile(file('empty.pdf', 'application/pdf', 0)).ok).toBe(false);
  });

  it('rejects unsupported extensions and MIME types', () => {
    const exe = validateDocumentFile(file('setup.exe', 'application/x-msdownload'));
    expect(!exe.ok && exe.error).toMatch(/isn’t a supported file/);
    const svg = validateDocumentFile(file('logo.png', 'image/svg+xml'));
    expect(!svg.ok && svg.error).toMatch(/unsupported file type/);
  });

  it('rejects an extension that does not match the MIME type', () => {
    const result = validateDocumentFile(file('invoice.pdf', 'image/png'));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/\.pdf extension but its content type is image\/png/);
  });
});

describe('helpers', () => {
  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('derives a title from a file name', () => {
    expect(titleFromFileName('fridge_warranty-card.pdf')).toBe('Fridge warranty card');
  });

  it('classifies document expiry', () => {
    const today = '2026-10-29';
    expect(documentExpiryStatus({}, today)).toBe('none');
    expect(documentExpiryStatus({ expiryDate: '2026-10-28' }, today)).toBe('expired');
    expect(documentExpiryStatus({ expiryDate: '2026-11-20' }, today)).toBe('expiring');
    expect(documentExpiryStatus({ expiryDate: '2027-01-01' }, today)).toBe('valid');
  });
});

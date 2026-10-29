import { getDocumentBlob } from '@/data/db';
import { AppError } from '@/data/errors';
import type { HouseholdDocument } from '@/types/models';

/** Saves a stored document to the user's device using a short-lived object URL. */
export async function downloadDocument(document: Pick<HouseholdDocument, 'id' | 'fileName' | 'mimeType'>): Promise<void> {
  const record = await getDocumentBlob(document.id);
  if (!record || !(record.blob instanceof Blob)) {
    throw new AppError('The file for this document could not be found in this browser’s storage.');
  }
  const blob = record.blob.type ? record.blob : new Blob([record.blob], { type: document.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.fileName;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give the browser time to start the download before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

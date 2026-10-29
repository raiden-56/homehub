import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDocumentBlob } from '@/data/db';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import { MAX_DOCUMENT_BYTES } from '../logic';
import { DocumentUploadDialog } from '../components/DocumentUploadDialog';

function chooseFile(file: File) {
  fireEvent.change(screen.getByLabelText('Choose a file or drag it here'), { target: { files: [file] } });
}

describe('DocumentUploadDialog', () => {
  it('rejects unsupported and oversized files with a specific message', async () => {
    const h = await setupHousehold();
    renderWithProviders(<DocumentUploadDialog open onClose={() => undefined} />, { store: h.store });

    chooseFile(new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('isn’t a supported file');

    const big = new File(['x'], 'manual.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: MAX_DOCUMENT_BYTES + 1 });
    chooseFile(big);
    expect(await screen.findByRole('alert')).toHaveTextContent('Files must be 10 MB or smaller');
  });

  it('requires a file, then saves a valid one with its blob', async () => {
    const h = await setupHousehold();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DocumentUploadDialog open onClose={onClose} defaultCategory="Warranty" />, { store: h.store });

    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a file to upload.');

    chooseFile(new File(['Warranty valid until 2027'], 'fridge_warranty.txt', { type: 'text/plain' }));
    expect(await screen.findByText('fridge_warranty.txt')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Fridge warranty');

    await user.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const documents = Object.values(h.store.getState().data.documents);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({ title: 'Fridge warranty', category: 'Warranty', mimeType: 'text/plain', fileName: 'fridge_warranty.txt', uploadedBy: h.userId });
    expect(await getDocumentBlob(documents[0]!.id)).toBeDefined();
  });
});

import { useEffect, useState } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useActiveHousehold, useCan, useCommit, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { newId, nowIso } from '@/lib/ids';
import type { DocumentLink, HouseholdDocument } from '@/types/models';
import { formatFileSize, titleFromFileName, validateDocumentFile } from '../logic';
import { DocumentMetadataFields, documentMetadataSchema, type DocumentMetadataValues } from './DocumentMetadataFields';
import { FileDropZone } from './FileDropZone';
import { FileTypeIcon } from './FileTypeIcon';

interface DocumentUploadDialogProps {
  open: boolean;
  onClose: () => void;
  defaultLink?: DocumentLink;
  defaultCategory?: string;
}

export function DocumentUploadDialog({ open, onClose, defaultLink, defaultCategory }: DocumentUploadDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const [file, setFile] = useState<{ file: File; mimeType: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const defaults = (): DocumentMetadataValues => ({
    title: '',
    category: defaultCategory ?? 'Other',
    notes: '',
    expiryDate: '',
    links: defaultLink ? [defaultLink] : [],
  });
  const { control, handleSubmit, reset, getValues, setValue, formState } = useForm<DocumentMetadataValues>({
    resolver: zodResolver(documentMetadataSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) {
      reset(defaults());
      setFile(null);
      setFileError(null);
    }
    // Reset only when the dialog opens.
  }, [open]);

  const chooseFile = (files: File[]) => {
    const picked = files[0];
    if (!picked) return;
    const result = validateDocumentFile(picked);
    if (!result.ok) {
      setFile(null);
      setFileError(result.error);
      return;
    }
    setFile({ file: picked, mimeType: result.mimeType });
    setFileError(null);
    if (!getValues('title').trim()) setValue('title', titleFromFileName(picked.name), { shouldValidate: true });
  };

  const save = handleSubmit(async (values) => {
    if (!household || !user || !file) return;
    const now = nowIso();
    const document: HouseholdDocument = {
      id: newId(),
      householdId: household.id,
      title: values.title.trim(),
      category: values.category,
      fileName: file.file.name,
      mimeType: file.mimeType,
      size: file.file.size,
      notes: values.notes.trim() || undefined,
      expiryDate: values.expiryDate || undefined,
      links: values.links,
      archived: false,
      uploadedBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    const ok = await commit(
      { put: { documents: [document] } },
      {
        blobs: { put: [{ id: document.id, householdId: household.id, blob: file.file }] },
        activity: { entity: 'document', entityId: document.id, message: `Uploaded “${document.title}”` },
        success: 'Document uploaded',
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Upload document"
      description="Files are stored privately in this browser."
      submitLabel="Upload"
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      onSubmit={(event) => {
        if (!file) {
          event.preventDefault();
          setFileError('Choose a file to upload.');
          void handleSubmit(() => undefined)();
          return;
        }
        void save(event);
      }}
    >
      <Stack spacing={2.5}>
        {file ? (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 3 }}
          >
            <FileTypeIcon mimeType={file.mimeType} size={36} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {file.file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(file.file.size)}
              </Typography>
            </Box>
            <IconButton aria-label={`Remove ${file.file.name}`} onClick={() => setFile(null)}>
              <X size={18} />
            </IconButton>
          </Stack>
        ) : (
          <FileDropZone onFiles={chooseFile} error={fileError} />
        )}
        <DocumentMetadataFields control={control} />
      </Stack>
    </FormDialog>
  );
}

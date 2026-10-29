import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCan, useCommit } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { nowIso } from '@/lib/ids';
import type { HouseholdDocument } from '@/types/models';
import { DocumentMetadataFields, documentMetadataSchema, type DocumentMetadataValues } from './DocumentMetadataFields';

function toValues(document: HouseholdDocument): DocumentMetadataValues {
  return {
    title: document.title,
    category: document.category,
    notes: document.notes ?? '',
    expiryDate: document.expiryDate ?? '',
    links: document.links,
  };
}

export function DocumentEditDialog({ open, onClose, document }: { open: boolean; onClose: () => void; document: HouseholdDocument }) {
  const canEdit = useCan('edit');
  const commit = useCommit();
  const { control, handleSubmit, reset, formState } = useForm<DocumentMetadataValues>({
    resolver: zodResolver(documentMetadataSchema),
    defaultValues: toValues(document),
  });

  useEffect(() => {
    if (open) reset(toValues(document));
  }, [open, document, reset]);

  const save = handleSubmit(async (values) => {
    const updated: HouseholdDocument = {
      ...document,
      title: values.title.trim(),
      category: values.category,
      notes: values.notes.trim() || undefined,
      expiryDate: values.expiryDate || undefined,
      links: values.links,
      updatedAt: nowIso(),
    };
    const ok = await commit(
      { put: { documents: [updated] } },
      {
        activity: { entity: 'document', entityId: document.id, message: `Updated details of “${updated.title}”` },
        success: 'Document updated',
        undo: { put: { documents: [document] } },
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Edit document details"
      onSubmit={save}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <DocumentMetadataFields control={control} />
    </FormDialog>
  );
}

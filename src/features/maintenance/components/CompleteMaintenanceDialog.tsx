import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, IconButton, Stack, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCan, useCollection, useCommit, useCurrency, useCurrentUser, useRecord, useToday } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormCheckbox, FormDateField, FormMoneyField, FormTextField } from '@/components/form/fields';
import { formatDate } from '@/lib/dates';
import { minorToInput, parseMoneyInput } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import { dateString, moneyString, optionalText, requiredText } from '@/lib/validation';
import type { DocumentBlob, DocumentLink, HouseholdDocument, MaintenanceTask } from '@/types/models';
import { formatFileSize, titleFromFileName, validateDocumentFile } from '@/features/documents/logic';
import { FileDropZone } from '@/features/documents/components/FileDropZone';
import { FileTypeIcon } from '@/features/documents/components/FileTypeIcon';
import { buildMaintenanceCompletion, MAINTENANCE_EXPENSE_CATEGORY } from '../logic';

interface CompleteMaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  /** The scheduled task being completed. Omit to log past maintenance for `assetId`. */
  task?: MaintenanceTask;
  assetId?: string;
}

interface Attachment {
  key: string;
  file: File;
  mimeType: string;
}

export function CompleteMaintenanceDialog({ open, onClose, task, assetId }: CompleteMaintenanceDialogProps) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const currency = useCurrency();
  const today = useToday();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const tasks = useCollection('maintenanceTasks');
  const asset = useRecord('assets', task?.assetId ?? assetId);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  // One idempotency key per opening of the dialog, so a double submit can't log twice.
  const [draftId, setDraftId] = useState(newId);

  const schema = useMemo(
    () =>
      z.object({
        completedDate: dateString({ required: true, label: 'Completion date' }).refine((value) => !value || value <= today, 'Completion date can’t be in the future'),
        workPerformed: requiredText('Work performed', 300),
        provider: optionalText(120),
        actualCost: moneyString({ label: 'Actual cost' }),
        notes: optionalText(1000),
        recordExpense: z.boolean(),
      }),
    [today],
  );
  type FormValues = z.infer<typeof schema>;

  const defaults = (): FormValues => ({
    completedDate: today,
    workPerformed: task?.name ?? '',
    provider: task?.provider ?? '',
    actualCost: minorToInput(task?.estimatedCostMinor, currency),
    notes: '',
    recordExpense: true,
  });
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const actualCost = useWatch({ control, name: 'actualCost' });
  const hasCost = (parseMoneyInput(actualCost ?? '', currency) ?? 0) > 0;

  useEffect(() => {
    if (open) {
      reset(defaults());
      setAttachments([]);
      setFileError(null);
      setDraftId(newId());
    }
    // Reset only when opening or switching record.
  }, [open, task?.id]);

  const addFiles = (files: File[]) => {
    const errors: string[] = [];
    const accepted: Attachment[] = [];
    for (const file of files) {
      const result = validateDocumentFile(file);
      if (result.ok) accepted.push({ key: newId(), file, mimeType: result.mimeType });
      else errors.push(result.error);
    }
    setAttachments((current) => [...current, ...accepted]);
    setFileError(errors.length ? errors.join(' ') : null);
  };

  const save = handleSubmit(async (values) => {
    if (!household || !user) return;
    const now = nowIso();
    const cost = values.actualCost.trim() ? (parseMoneyInput(values.actualCost, currency) ?? undefined) : undefined;
    const links: DocumentLink[] = [
      ...(task ? [{ type: 'maintenance' as const, id: task.id }] : []),
      ...(asset ? [{ type: 'asset' as const, id: asset.id }] : []),
    ];
    const documents: HouseholdDocument[] = attachments.map((attachment) => ({
      id: newId(),
      householdId: household.id,
      title: titleFromFileName(attachment.file.name),
      category: 'Service invoice',
      fileName: attachment.file.name,
      mimeType: attachment.mimeType,
      size: attachment.file.size,
      links,
      archived: false,
      uploadedBy: user.id,
      createdAt: now,
      updatedAt: now,
    }));
    const blobs: DocumentBlob[] = documents.map((document, index) => ({
      id: document.id,
      householdId: household.id,
      blob: attachments[index]!.file,
    }));
    const result = buildMaintenanceCompletion({
      householdId: household.id,
      userId: user.id,
      now,
      task,
      assetId: asset?.id,
      assetName: asset?.name,
      existingTaskIds: new Set(tasks.map((entry) => entry.id)),
      input: {
        completedDate: values.completedDate,
        workPerformed: values.workPerformed,
        provider: values.provider,
        actualCostMinor: cost,
        notes: values.notes,
        documentIds: documents.map((document) => document.id),
        recordExpense: values.recordExpense,
      },
    });
    const label = task?.name ?? values.workPerformed.trim();
    const ok = await commit(
      { put: { ...result.changes.put, ...(documents.length ? { documents } : {}) } },
      {
        idempotencyKey: task ? `maintenance-complete:${task.id}` : `maintenance-log:${draftId}`,
        blobs: blobs.length ? { put: blobs } : undefined,
        activity: [
          { entity: 'maintenance', entityId: task?.id ?? result.record.id, message: task ? `Completed maintenance “${label}”` : `Logged maintenance “${label}”${asset ? ` for ${asset.name}` : ''}` },
          ...(result.expense ? [{ entity: 'expense' as const, entityId: result.expense.id, message: `Recorded expense “${result.expense.description}”` }] : []),
        ],
        success: result.next
          ? `Maintenance completed · next due ${formatDate(result.next.dueDate, 'd MMM yyyy')}`
          : task
            ? 'Maintenance completed'
            : 'Maintenance logged',
      },
    );
    if (ok) onClose();
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={task ? `Complete “${task.name}”` : 'Log past maintenance'}
      description={asset ? asset.name : undefined}
      submitLabel={task ? 'Mark complete' : 'Save record'}
      onSubmit={save}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
    >
      <Stack spacing={2}>
        {task?.recurrence && (
          <Alert severity="info">This task repeats. The next occurrence will be scheduled automatically.</Alert>
        )}
        <FormDateField control={control} name="completedDate" label="Completion date" required />
        <FormTextField control={control} name="workPerformed" label="Work performed" required multiline minRows={2} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormTextField control={control} name="provider" label="Service provider" />
          <FormMoneyField control={control} name="actualCost" label="Actual cost" helperText="What was actually paid" />
        </Stack>
        <FormCheckbox
          control={control}
          name="recordExpense"
          label="Record the cost as a household expense"
          helperText={hasCost ? `Adds a “${MAINTENANCE_EXPENSE_CATEGORY}” expense paid by you.` : 'Enter an actual cost to record an expense.'}
          disabled={!hasCost}
        />
        <FormTextField control={control} name="notes" label="Notes" multiline minRows={2} />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Attachments (optional)
          </Typography>
          {attachments.length > 0 && (
            <Stack spacing={1} sx={{ mb: 1.5 }}>
              {attachments.map((attachment) => (
                <Stack key={attachment.key} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <FileTypeIcon mimeType={attachment.mimeType} size={26} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {attachment.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatFileSize(attachment.file.size)}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`Remove ${attachment.file.name}`}
                    onClick={() => setAttachments((current) => current.filter((entry) => entry.key !== attachment.key))}
                  >
                    <X size={16} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
          <FileDropZone multiple onFiles={addFiles} error={fileError} label="Attach invoices or photos" />
        </Box>
      </Stack>
    </FormDialog>
  );
}

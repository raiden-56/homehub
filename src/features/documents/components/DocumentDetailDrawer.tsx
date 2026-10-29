import { useState } from 'react';
import { Alert, Box, Button, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { Archive, ArchiveRestore, Download, Pencil, Trash2 } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCommit, useRecord, useToday } from '@/app/hooks';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { toUserMessage } from '@/data/errors';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { documentDeletionChanges } from '../changes';
import { downloadDocument } from '../download';
import { LINK_TYPE_LABELS, documentExpiryLabel, documentExpiryStatus, formatFileSize, resolveLink } from '../logic';
import { DocumentEditDialog } from './DocumentEditDialog';
import { DocumentPreview } from './DocumentPreview';

export function DocumentDetailDrawer({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const document = useRecord('documents', documentId);
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const confirm = useConfirm();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);

  if (!document) {
    return (
      <DetailDrawer open onClose={onClose} title="Document">
        <ErrorState kind="not-found" title="Document not found" />
      </DetailDrawer>
    );
  }

  const expiryStatus = documentExpiryStatus(document, today);
  const expiryLabel = documentExpiryLabel(document, today);
  const links = document.links.map((link) => ({ link, target: resolveLink(link, data, today) }));

  const download = async () => {
    try {
      await downloadDocument(document);
    } catch (error) {
      toast.show({ message: toUserMessage(error), severity: 'error' });
    }
  };

  const toggleArchive = async () => {
    const updated = { ...document, archived: !document.archived, updatedAt: nowIso() };
    await commit(
      { put: { documents: [updated] } },
      {
        activity: { entity: 'document', entityId: document.id, message: `${updated.archived ? 'Archived' : 'Restored'} “${document.title}”` },
        success: updated.archived ? 'Document archived' : 'Document restored',
        undo: { put: { documents: [document] } },
      },
    );
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${document.title}”?`,
      description: 'The file is permanently removed from this browser and unlinked from any records. This can’t be undone.',
      confirmLabel: 'Delete document',
      destructive: true,
    });
    if (!ok) return;
    // Close first so the drawer doesn't flash a "not found" state once the record is gone.
    onClose();
    await commit(documentDeletionChanges(document, data, nowIso()), {
      blobs: { remove: [document.id] },
      activity: { entity: 'document', entityId: document.id, message: `Deleted “${document.title}”` },
      success: 'Document deleted',
    });
  };

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={document.title}
      subtitle={`${document.category} · ${formatFileSize(document.size)}${document.archived ? ' · Archived' : ''}`}
      actions={
        <Tooltip title="Download">
          <IconButton aria-label={`Download ${document.fileName}`} onClick={download}>
            <Download size={19} />
          </IconButton>
        </Tooltip>
      }
      width={560}
    >
      <Stack spacing={2.5}>
        <DocumentPreview document={document} />
        <Typography variant="caption" color="text.secondary">
          Previews are generated in your browser. HomeHub doesn’t read or extract text from documents (no OCR).
        </Typography>

        <Box>
          <DetailRow label="File">{document.fileName}</DetailRow>
          <DetailRow label="Category">{document.category}</DetailRow>
          <DetailRow label="Uploaded">
            <Stack spacing={0.5}>
              <span>{formatTimestamp(document.createdAt)}</span>
              <MemberAvatar userId={document.uploadedBy} withName size={22} />
            </Stack>
          </DetailRow>
          <DetailRow label="Expiry">
            {expiryLabel ? (
              <StatusChip
                tone={expiryStatus === 'expired' ? 'danger' : expiryStatus === 'expiring' ? 'warning' : 'success'}
                label={expiryLabel}
              />
            ) : (
              'No expiry date'
            )}
          </DetailRow>
          <DetailRow label="Linked to">
            {links.length === 0 ? (
              'Not linked to any record'
            ) : (
              <Stack spacing={0.5}>
                {links.map(({ link, target }) =>
                  target ? (
                    <Link key={`${link.type}:${link.id}`} component={RouterLink} to={target.to} underline="hover">
                      {LINK_TYPE_LABELS[link.type]}: {target.label}
                    </Link>
                  ) : (
                    <Typography key={`${link.type}:${link.id}`} variant="body2" color="text.secondary">
                      {LINK_TYPE_LABELS[link.type]}: record no longer exists
                    </Typography>
                  ),
                )}
              </Stack>
            )}
          </DetailRow>
          {document.notes && <DetailRow label="Notes">{document.notes}</DetailRow>}
          <DetailRow label="Last updated">{formatDate(document.updatedAt.slice(0, 10))}</DetailRow>
        </Box>

        {canEdit ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="contained" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
              Edit details
            </Button>
            <Button
              variant="outlined"
              startIcon={document.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              onClick={toggleArchive}
            >
              {document.archived ? 'Restore' : 'Archive'}
            </Button>
            <Button color="error" startIcon={<Trash2 size={16} />} onClick={remove}>
              Delete
            </Button>
          </Stack>
        ) : (
          <Alert severity="info">Viewers can open and download documents but can’t change them.</Alert>
        )}
      </Stack>
      {canEdit && <DocumentEditDialog open={editOpen} onClose={() => setEditOpen(false)} document={document} />}
    </DetailDrawer>
  );
}

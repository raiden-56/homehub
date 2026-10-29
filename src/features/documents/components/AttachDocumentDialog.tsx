import { useEffect, useMemo, useState } from 'react';
import { Box, Checkbox, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { useCollection, useCommit } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { SearchField } from '@/components/ui/SearchField';
import { nowIso } from '@/lib/ids';
import type { DocumentLink } from '@/types/models';
import { formatFileSize, hasLink } from '../logic';
import { FileTypeIcon } from './FileTypeIcon';

interface AttachDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  link: DocumentLink;
  /** Name of the record being linked, used in feedback. */
  targetLabel?: string;
}

/** Picks existing (non-archived) documents and adds `link` to each of them. */
export function AttachDocumentDialog({ open, onClose, link, targetLabel }: AttachDocumentDialogProps) {
  const documents = useCollection('documents');
  const commit = useCommit();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected([]);
    }
  }, [open]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((document) => !document.archived && !hasLink(document, link))
      .filter((document) => !q || `${document.title} ${document.fileName} ${document.category}`.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [documents, link, query]);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const save = async () => {
    const picked = documents.filter((document) => selected.includes(document.id));
    if (picked.length === 0) return;
    setSaving(true);
    const now = nowIso();
    const ok = await commit(
      { put: { documents: picked.map((document) => ({ ...document, links: [...document.links, link], updatedAt: now })) } },
      {
        activity: picked.map((document) => ({
          entity: 'document' as const,
          entityId: document.id,
          message: `Linked “${document.title}”${targetLabel ? ` to ${targetLabel}` : ''}`,
        })),
        success: picked.length === 1 ? 'Document attached' : `${picked.length} documents attached`,
      },
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Attach existing documents"
      description={targetLabel ? `Choose documents to link to ${targetLabel}.` : undefined}
      submitLabel={selected.length > 1 ? `Attach ${selected.length}` : 'Attach'}
      submitting={saving}
      submitDisabled={selected.length === 0}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search documents" />
      {candidates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {documents.length === 0 ? 'No documents uploaded yet.' : 'No other documents match.'}
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 360, overflowY: 'auto', mt: 1.5 }}>
          <List dense disablePadding>
            {candidates.map((document) => (
              <ListItemButton key={document.id} onClick={() => toggle(document.id)} sx={{ borderRadius: 2 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox
                    edge="start"
                    checked={selected.includes(document.id)}
                    tabIndex={-1}
                    inputProps={{ 'aria-label': document.title }}
                  />
                </ListItemIcon>
                <Box sx={{ mr: 1.5 }}>
                  <FileTypeIcon mimeType={document.mimeType} size={28} />
                </Box>
                <ListItemText
                  primary={document.title}
                  secondary={`${document.category} · ${formatFileSize(document.size)}`}
                  slotProps={{ primary: { noWrap: true, fontWeight: 600 } }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </FormDialog>
  );
}

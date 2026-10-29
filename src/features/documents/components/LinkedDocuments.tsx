import { useMemo, useState } from 'react';
import { Box, Button, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { Link2Off, Paperclip, Upload } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useCommit, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { nowIso } from '@/lib/ids';
import type { DocumentLink } from '@/types/models';
import { formatFileSize, hasLink, resolveLink, sameLink } from '../logic';
import { AttachDocumentDialog } from './AttachDocumentDialog';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { FileTypeIcon } from './FileTypeIcon';

const DEFAULT_CATEGORY: Record<DocumentLink['type'], string> = {
  asset: 'Manual',
  bill: 'Bill',
  expense: 'Receipt',
  maintenance: 'Service invoice',
};

interface LinkedDocumentsProps {
  link: DocumentLink;
  title?: string;
}

/**
 * Documents linked to one record (asset, bill, expense or maintenance task), with upload,
 * attach-existing and unlink actions. Viewers see the list only.
 */
export function LinkedDocuments({ link, title = 'Documents' }: LinkedDocumentsProps) {
  const documents = useCollection('documents');
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  const linked = useMemo(
    () => documents.filter((document) => hasLink(document, link)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [documents, link],
  );
  const targetLabel = resolveLink(link, data, today)?.label;

  const unlink = async (documentId: string) => {
    const document = documents.find((entry) => entry.id === documentId);
    if (!document) return;
    const updated = { ...document, links: document.links.filter((entry) => !sameLink(entry, link)), updatedAt: nowIso() };
    await commit(
      { put: { documents: [updated] } },
      {
        activity: { entity: 'document', entityId: document.id, message: `Unlinked “${document.title}”${targetLabel ? ` from ${targetLabel}` : ''}` },
        success: 'Document unlinked',
        undo: { put: { documents: [document] } },
      },
    );
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Typography variant="h4" component="h3">
          {title}
          {linked.length > 0 && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
              ({linked.length})
            </Typography>
          )}
        </Typography>
        {canEdit && (
          <Stack direction="row" spacing={0.5}>
            <Button size="small" startIcon={<Upload size={15} />} onClick={() => setUploadOpen(true)}>
              Upload
            </Button>
            <Button size="small" startIcon={<Paperclip size={15} />} onClick={() => setAttachOpen(true)}>
              Attach existing
            </Button>
          </Stack>
        )}
      </Stack>
      {linked.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No documents linked yet.
        </Typography>
      ) : (
        <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {linked.map((document) => (
            <Stack
              component="li"
              key={document.id}
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
            >
              <FileTypeIcon mimeType={document.mimeType} size={28} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={paths.document(document.id)}
                  underline="hover"
                  sx={{ fontWeight: 600, fontSize: '0.875rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {document.title}
                </Link>
                <Typography variant="caption" color="text.secondary">
                  {document.category} · {formatFileSize(document.size)}
                  {document.archived ? ' · Archived' : ''}
                </Typography>
              </Box>
              {canEdit && (
                <Tooltip title="Unlink (the document is kept)">
                  <IconButton size="small" aria-label={`Unlink ${document.title}`} onClick={() => unlink(document.id)}>
                    <Link2Off size={16} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      {canEdit && (
        <>
          <DocumentUploadDialog
            open={uploadOpen}
            onClose={() => setUploadOpen(false)}
            defaultLink={link}
            defaultCategory={DEFAULT_CATEGORY[link.type]}
          />
          <AttachDocumentDialog open={attachOpen} onClose={() => setAttachOpen(false)} link={link} targetLabel={targetLabel} />
        </>
      )}
    </Box>
  );
}

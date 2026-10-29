import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { FileText, Upload } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useHouseholdLoading, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentListSkeleton } from '@/components/ui/Skeletons';
import { DOCUMENT_CATEGORIES } from '@/lib/constants';
import { documentExpiryStatus, documentSearchText } from './logic';
import { DocumentRow } from './components/DocumentRow';
import { DocumentUploadDialog } from './components/DocumentUploadDialog';
import { DocumentDetailDrawer } from './components/DocumentDetailDrawer';

const PAGE_SIZE = 40;

export default function DocumentsPage() {
  const documents = useCollection('documents');
  const data = useAppSelector((state) => state.data);
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const today = useToday();
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const archived = searchParams.get('archived') === 'true';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setLimit(PAGE_SIZE);
  };

  const categories = useMemo(
    () => [...new Set([...DOCUMENT_CATEGORIES, ...documents.map((document) => document.category)])],
    [documents],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return documents
      .filter((document) => document.archived === archived)
      .filter((document) => !category || document.category === category)
      .filter((document) => !query || documentSearchText(document, data, today).includes(query))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [documents, archived, category, q, data, today]);

  const active = documents.filter((document) => !document.archived);
  const expiringCount = active.filter((document) => {
    const status = documentExpiryStatus(document, today);
    return status === 'expiring' || status === 'expired';
  }).length;
  const filtersApplied = !!(q || category || archived);

  const uploadButton = (
    <Tooltip title={canEdit ? '' : 'Viewers can’t upload documents'}>
      <span>
        <Button variant="contained" startIcon={<Upload size={18} />} onClick={() => setUploadOpen(true)} disabled={!canEdit}>
          Upload
        </Button>
      </span>
    </Tooltip>
  );

  const closeDrawer = () => navigate({ pathname: paths.documents(), search: searchParams.toString() });

  return (
    <>
      <PageHeader
        title="Documents"
        description="Receipts, warranties, manuals and agreements — stored privately in this browser."
        actions={uploadButton}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <SearchField
          value={q}
          onChange={(value) => setParam('q', value)}
          placeholder="Search title, file, notes or linked record"
          sx={{ maxWidth: { md: 380 } }}
        />
        <TextField
          select
          label="Category"
          value={category}
          onChange={(event) => setParam('category', event.target.value)}
          sx={{ minWidth: 180, maxWidth: { md: 220 } }}
        >
          <MenuItem value="">All categories</MenuItem>
          {categories.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch checked={archived} onChange={(event) => setParam('archived', event.target.checked ? 'true' : '')} />}
          label="Show archived"
          sx={{ ml: { md: 1 } }}
        />
      </Stack>

      {!loading && documents.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }} role="status">
          {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
          {!archived && expiringCount > 0 ? ` · ${expiringCount} expired or expiring within 30 days` : ''}
        </Typography>
      )}

      <Card>
        {loading ? (
          <DocumentListSkeleton />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} />}
            title="No documents yet"
            description="Upload receipts, warranty cards, manuals and agreements so they’re easy to find when you need them."
            action={canEdit ? uploadButton : undefined}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={24} />}
            title={archived && !q && !category ? 'No archived documents' : 'No documents match'}
            description="Try a different search or category."
            action={
              filtersApplied ? (
                <Button onClick={() => setSearchParams({}, { replace: true })}>Clear filters</Button>
              ) : undefined
            }
          />
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Documents">
            {filtered.slice(0, limit).map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onOpen={() => navigate({ pathname: paths.document(document.id), search: searchParams.toString() })}
              />
            ))}
          </Box>
        )}
      </Card>
      {filtered.length > limit && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button onClick={() => setLimit((value) => value + PAGE_SIZE)}>Show more ({filtered.length - limit} remaining)</Button>
        </Box>
      )}

      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} defaultCategory={category || undefined} />
      {documentId && !loading && <DocumentDetailDrawer documentId={documentId} onClose={closeDrawer} />}
    </>
  );
}

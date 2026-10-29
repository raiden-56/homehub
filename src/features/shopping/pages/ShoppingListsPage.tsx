import { useMemo, useState } from 'react';
import { Box, Button, Card, CardActionArea, Collapse, Stack, Tooltip, Typography } from '@mui/material';
import { ChevronDown, History, Plus, ShoppingCart } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useCan, useCollection, useHouseholdLoading, useMembers } from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShoppingListSkeleton } from '@/components/ui/Skeletons';
import { Money } from '@/components/ui/Money';
import { MemberAvatarGroup } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import type { ShoppingList } from '@/types/models';
import { formatTimestamp, timeAgo } from '@/lib/dates';
import { paths } from '@/app/paths';
import { ListNameDialog } from '../components/ListNameDialog';
import { ListActionsMenu } from '../components/ListActionsMenu';
import { isPending, summariseList } from '../logic';

export default function ShoppingListsPage() {
  const lists = useCollection('shoppingLists');
  const items = useCollection('shoppingItems');
  const members = useMembers();
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ShoppingList | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const sorted = useMemo(() => [...lists].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)), [lists]);
  const active = sorted.filter((list) => !list.archived);
  const archived = sorted.filter((list) => list.archived);
  const pendingTotal = items.filter((item) => isPending(item) && active.some((list) => list.id === item.listId)).length;
  const memberIds = members.map((member) => member.userId);

  const newButton = (
    <Tooltip title={canEdit ? '' : 'Viewers can’t create lists'}>
      <span>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)} disabled={!canEdit}>
          New list
        </Button>
      </span>
    </Tooltip>
  );

  const renderCard = (list: ShoppingList) => {
    const summary = summariseList(items, list.id);
    return (
      <Card
        key={list.id}
        component="li"
        sx={{
          position: 'relative',
          listStyle: 'none',
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
          '&:hover': { borderColor: 'primary.main', boxShadow: '0 6px 18px rgba(36, 69, 45, 0.08)' },
        }}
      >
        <CardActionArea component={RouterLink} to={paths.shoppingList(list.id)} sx={{ p: 2.25, pr: 7, height: '100%' }}>
          <Typography variant="h3" component="h2" noWrap>
            {list.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Created {formatTimestamp(list.createdAt, 'd MMM yyyy')} · active {timeAgo(list.lastActivityAt)}
          </Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="h2" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {summary.remaining}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.remaining === 1 ? 'item to buy' : 'items to buy'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="h2" component="p">
                {summary.hasEstimate ? <Money minor={summary.estimatedTotalMinor} /> : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.hasEstimate ? 'estimated' : 'no estimate'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
            <Tooltip title="Shared with everyone in the household">
              <span>
                <MemberAvatarGroup userIds={memberIds} max={4} size={24} />
              </span>
            </Tooltip>
            {list.archived ? (
              <StatusChip tone="neutral" label="Archived" />
            ) : summary.purchased > 0 ? (
              <StatusChip tone="success" label={`${summary.purchased} bought`} />
            ) : null}
          </Stack>
        </CardActionArea>
        {canEdit && (
          <Box sx={{ position: 'absolute', top: 10, right: 8 }}>
            <ListActionsMenu list={list} onRename={() => setRenaming(list)} />
          </Box>
        )}
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Shopping"
        description={
          loading
            ? 'Shared lists for the whole household.'
            : `${active.length} active list${active.length === 1 ? '' : 's'} · ${pendingTotal} item${pendingTotal === 1 ? '' : 's'} to buy`
        }
        actions={
          <>
            <Button variant="outlined" component={RouterLink} to={paths.shoppingHistory()} startIcon={<History size={16} />}>
              Purchase history
            </Button>
            {newButton}
          </>
        }
      />

      {loading ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
          {[0, 1, 2].map((key) => (
            <Card key={key}>
              <ShoppingListSkeleton rows={3} />
            </Card>
          ))}
        </Box>
      ) : active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart size={24} />}
            title="No shopping lists yet"
            description="Create a list for weekly groceries, monthly essentials or anything else. Everyone in the household can add to it."
            action={canEdit ? newButton : undefined}
          />
        </Card>
      ) : (
        <Box
          component="ul"
          aria-label="Shopping lists"
          sx={{ m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}
        >
          {active.map(renderCard)}
        </Box>
      )}

      {!loading && archived.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Button
            color="inherit"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
            endIcon={<ChevronDown size={16} style={{ transform: showArchived ? 'rotate(180deg)' : undefined, transition: 'transform 160ms ease' }} />}
          >
            Archived lists ({archived.length})
          </Button>
          <Collapse in={showArchived}>
            <Box
              component="ul"
              aria-label="Archived shopping lists"
              sx={{ m: 0, mt: 1.5, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}
            >
              {archived.map(renderCard)}
            </Box>
          </Collapse>
        </Box>
      )}

      <ListNameDialog open={creating} onClose={() => setCreating(false)} />
      <ListNameDialog open={!!renaming} list={renaming ?? undefined} onClose={() => setRenaming(null)} />
    </>
  );
}

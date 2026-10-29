import { useMemo, useState } from 'react';
import { Box, Breadcrumbs, Button, Card, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle2, History, ReceiptText } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useHouseholdLoading } from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchField } from '@/components/ui/SearchField';
import { ShoppingListSkeleton } from '@/components/ui/Skeletons';
import { StatusChip } from '@/components/ui/StatusChip';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { selectHouseholdTimeZone } from '@/store/selectors';
import type { ShoppingItem } from '@/types/models';
import { formatDate, isoDateInZone } from '@/lib/dates';
import { sumMinor } from '@/lib/money';
import { paths } from '@/app/paths';
import { formatQuantity } from '@/features/inventory/logic';
import { ReceivePurchaseDialog } from '../components/ReceivePurchaseDialog';

const PAGE = 60;

export default function PurchaseHistoryPage() {
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const items = useCollection('shoppingItems');
  const lists = useCollection('shoppingLists');
  const timeZone = useAppSelector(selectHouseholdTimeZone);
  const [listFilter, setListFilter] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [receiving, setReceiving] = useState<ShoppingItem | null>(null);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);

  const purchased = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => item.purchased && item.purchasedAt)
      .filter((item) => !listFilter || item.listId === listFilter)
      .filter((item) => !q || item.name.toLowerCase().includes(q))
      .sort((a, b) => b.purchasedAt!.localeCompare(a.purchasedAt!));
  }, [items, listFilter, query]);

  const shown = purchased.slice(0, limit);
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of shown) {
      const day = isoDateInZone(item.purchasedAt!, timeZone);
      map.set(day, [...(map.get(day) ?? []), item]);
    }
    return [...map.entries()];
  }, [shown, timeZone]);

  const receivingList = receiving ? listById.get(receiving.listId) : undefined;

  return (
    <>
      <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 1 }}>
        <Link component={RouterLink} to={paths.shopping()} underline="hover" color="text.secondary">
          Shopping
        </Link>
        <Typography color="text.primary">Purchase history</Typography>
      </Breadcrumbs>
      <PageHeader title="Purchase history" description="Everything ticked off your lists, with what was paid and whether it was recorded." />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search purchases" sx={{ maxWidth: { sm: 300 } }} />
        <TextField select label="List" value={listFilter} onChange={(event) => setListFilter(event.target.value)} sx={{ maxWidth: { sm: 240 } }}>
          <MenuItem value="">All lists</MenuItem>
          {lists.map((list) => (
            <MenuItem key={list.id} value={list.id}>
              {list.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {loading ? (
        <Card>
          <ShoppingListSkeleton />
        </Card>
      ) : purchased.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={24} />}
            title={query || listFilter ? 'No purchases match' : 'No purchases yet'}
            description="Items you tick off a shopping list appear here."
            action={
              <Button component={RouterLink} to={paths.shopping()} variant="outlined">
                Go to shopping lists
              </Button>
            }
          />
        </Card>
      ) : (
        <Stack spacing={2}>
          {groups.map(([day, dayItems]) => {
            const total = sumMinor(dayItems.map((item) => item.actualPriceMinor));
            return (
              <Card key={day} component="section" aria-labelledby={`day-${day}`}>
                <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pt: 1.5, pb: 1 }}>
                  <Typography id={`day-${day}`} variant="h3" component="h2">
                    {formatDate(day, 'EEEE, d MMM yyyy')}
                  </Typography>
                  {total > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      Paid <Money minor={total} />
                    </Typography>
                  )}
                </Stack>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {dayItems.map((item) => (
                    <Stack
                      key={item.id}
                      component="li"
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}
                    >
                      <MemberAvatar userId={item.purchasedBy} size={28} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="p">
                          {formatQuantity(item.quantity)} {item.unit} · {listById.get(item.listId)?.name ?? 'Deleted list'}
                        </Typography>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          <Money minor={item.actualPriceMinor} fallback="No price" />
                        </Typography>
                        {item.receivedAt ? (
                          <StatusChip tone="success" label="Recorded" icon={<CheckCircle2 />} />
                        ) : canEdit && listById.get(item.listId) ? (
                          <Button size="small" startIcon={<ReceiptText size={14} />} onClick={() => setReceiving(item)} sx={{ minHeight: 28 }}>
                            Record
                          </Button>
                        ) : (
                          <StatusChip tone="neutral" label="Not recorded" />
                        )}
                      </Stack>
                    </Stack>
                  ))}
                </Box>
              </Card>
            );
          })}
          {purchased.length > limit && (
            <Button onClick={() => setLimit((value) => value + PAGE)} sx={{ alignSelf: 'center' }}>
              Show older purchases
            </Button>
          )}
        </Stack>
      )}

      {receiving && receivingList && (
        <ReceivePurchaseDialog open list={receivingList} items={[receiving]} onClose={() => setReceiving(null)} />
      )}
    </>
  );
}

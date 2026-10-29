import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { History } from 'lucide-react';
import { useAppSelector, useCollection } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatTimestamp, timeAgo } from '@/lib/dates';

export function ActivityWidget() {
  const activity = useCollection('activity');
  const users = useAppSelector((state) => state.data.users);
  const recent = useMemo(() => [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [activity]);

  return (
    <SectionCard title="Recent activity" subtitle="What’s been happening around the home" icon={<History size={17} />} sx={{ height: '100%' }}>
      {recent.length === 0 ? (
        <EmptyState compact icon={<History size={20} />} title="No activity yet" description="Purchases, completed chores and paid bills will show up here." />
      ) : (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, columnGap: 3 }}>
          {recent.map((entry) => (
            <Stack component="li" key={entry.id} direction="row" spacing={1.5} alignItems="flex-start" sx={{ py: 1 }}>
              <MemberAvatar userId={entry.actorId} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    {users[entry.actorId]?.name.split(' ')[0] ?? 'Someone'}
                  </Box>{' '}
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {entry.message.charAt(0).toLowerCase() + entry.message.slice(1)}
                  </Box>
                </Typography>
                <Typography variant="caption" color="text.secondary" component="time" dateTime={entry.createdAt} title={formatTimestamp(entry.createdAt)}>
                  {timeAgo(entry.createdAt)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Box>
      )}
    </SectionCard>
  );
}

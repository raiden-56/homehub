import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { FilterX } from 'lucide-react';
import { useMembers } from '@/app/hooks';
import { SearchField } from '@/components/ui/SearchField';
import { TASK_CATEGORIES } from '@/lib/constants';
import { PRIORITY_LABELS, type TaskFilters, type TaskSort } from '../logic';

interface TaskFiltersBarProps {
  filters: TaskFilters;
  sort: TaskSort;
  showStatus: boolean;
  showSort: boolean;
  activeFilterCount: number;
  onChange: (patch: Record<string, string | null>) => void;
  onClear: () => void;
}

export function TaskFiltersBar({ filters, sort, showStatus, showSort, activeFilterCount, onChange, onClear }: TaskFiltersBarProps) {
  const members = useMembers();
  const selectSx = { minWidth: { xs: 'calc(50% - 6px)', sm: 150 }, flex: { xs: '1 1 calc(50% - 6px)', sm: '0 0 auto' } };
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <SearchField
        value={filters.q}
        onChange={(value) => onChange({ q: value })}
        placeholder="Search tasks"
        label="Search tasks"
        sx={{ maxWidth: { sm: 360 } }}
      />
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }} role="group" aria-label="Task filters">
        {showStatus && (
          <TextField select label="Status" value={filters.status} onChange={(event) => onChange({ status: event.target.value === 'open' ? null : event.target.value })} sx={selectSx}>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="all">All tasks</MenuItem>
          </TextField>
        )}
        <TextField select label="Due" value={filters.due} onChange={(event) => onChange({ due: event.target.value })} sx={selectSx}>
          <MenuItem value="">Any time</MenuItem>
          <MenuItem value="today">Due today</MenuItem>
          <MenuItem value="week">Next 7 days</MenuItem>
        </TextField>
        <TextField select label="Assigned to" value={filters.assignee} onChange={(event) => onChange({ assignee: event.target.value })} sx={selectSx}>
          <MenuItem value="">Everyone</MenuItem>
          <MenuItem value="me">Me</MenuItem>
          <MenuItem value="unassigned">Unassigned</MenuItem>
          {members.map((member) => (
            <MenuItem key={member.userId} value={member.userId}>
              {member.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Priority" value={filters.priority} onChange={(event) => onChange({ priority: event.target.value })} sx={selectSx}>
          <MenuItem value="">Any priority</MenuItem>
          {(['high', 'medium', 'low'] as const).map((value) => (
            <MenuItem key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Category" value={filters.category} onChange={(event) => onChange({ category: event.target.value })} sx={selectSx}>
          <MenuItem value="">All categories</MenuItem>
          {TASK_CATEGORIES.map((value) => (
            <MenuItem key={value} value={value}>
              {value}
            </MenuItem>
          ))}
        </TextField>
        {showSort && (
          <TextField select label="Sort by" value={sort} onChange={(event) => onChange({ sort: event.target.value === 'due' ? null : event.target.value })} sx={selectSx}>
            <MenuItem value="due">Due date</MenuItem>
            <MenuItem value="priority">Priority</MenuItem>
            <MenuItem value="created">Newest first</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </TextField>
        )}
        {(activeFilterCount > 0 || filters.q) && (
          <Button color="inherit" startIcon={<FilterX size={16} />} onClick={onClear} sx={{ alignSelf: 'center' }}>
            Clear filters
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

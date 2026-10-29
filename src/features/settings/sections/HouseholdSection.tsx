import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Home, LayoutGrid, Tags, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useActiveHousehold, useAppDispatch, useCan, useCommit } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { FormSelectField, FormTextField } from '@/components/form/fields';
import { useToast } from '@/components/feedback/ToastProvider';
import { deleteHousehold } from '@/features/household/lifecycle';
import { toUserMessage } from '@/data/errors';
import { MODULE_KEYS, type ModuleKey } from '@/types/models';
import { HOUSEHOLD_TYPE_LABELS, MODULE_INFO } from '@/lib/constants';
import { COMMON_TIME_ZONES } from '@/lib/dates';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { nowIso } from '@/lib/ids';
import { optionalText, requiredText } from '@/lib/validation';
import { paths } from '@/app/paths';

const schema = z.object({
  name: requiredText('Household name', 60),
  type: z.enum(['individual', 'couple', 'family', 'roommates']),
  description: optionalText(240),
  currency: z.string().min(1),
  timeZone: z.string().min(1),
});
type Values = z.infer<typeof schema>;

export function HouseholdSection() {
  const household = useActiveHousehold();
  const canManage = useCan('manageHousehold');
  const canDelete = useCan('deleteHousehold');
  const commit = useCommit();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { control, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (household) {
      reset({
        name: household.name,
        type: household.type,
        description: household.description ?? '',
        currency: household.currency,
        timeZone: household.timeZone,
      });
    }
  }, [household, reset]);

  if (!household) return null;
  const zones = COMMON_TIME_ZONES.includes(household.timeZone) ? COMMON_TIME_ZONES : [household.timeZone, ...COMMON_TIME_ZONES];

  const onSubmit = handleSubmit(async (values) => {
    await commit(
      {
        put: {
          households: [
            { ...household, ...values, name: values.name.trim(), description: values.description.trim() || undefined, updatedAt: nowIso() },
          ],
        },
      },
      {
        action: 'manageHousehold',
        success: 'Household details saved',
        activity: { entity: 'household', entityId: household.id, message: 'Updated household details' },
      },
    );
  });

  const toggleModule = async (key: ModuleKey, enabled: boolean) => {
    const next = MODULE_KEYS.filter((module) => (module === key ? enabled : household.enabledModules.includes(module)));
    await commit(
      { put: { households: [{ ...household, enabledModules: next, updatedAt: nowIso() }] } },
      {
        action: 'manageHousehold',
        success: `${MODULE_INFO[key].label} ${enabled ? 'shown' : 'hidden'}`,
        undo: { put: { households: [{ ...household }] } },
      },
    );
  };

  const removeCategory = async (category: string) => {
    await commit(
      {
        put: {
          households: [
            { ...household, customExpenseCategories: household.customExpenseCategories.filter((entry) => entry !== category), updatedAt: nowIso() },
          ],
        },
      },
      { action: 'manageHousehold', success: `Removed “${category}” from the category list. Existing expenses keep it.` },
    );
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      const result = await dispatch(deleteHousehold(household.id));
      setDeleteOpen(false);
      toast.show({ message: `${household.name} was deleted`, severity: 'success' });
      navigate(result === 'switched' ? paths.overview() : paths.onboarding(), { replace: true });
    } catch (error) {
      toast.show({ message: toUserMessage(error), severity: 'error' });
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionCard title="Household details" icon={<Home size={17} />}>
        {!canManage && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Only the household owner can change these settings.
          </Alert>
        )}
        <form onSubmit={onSubmit} noValidate>
          <Stack spacing={2} sx={{ maxWidth: 560 }}>
            <FormTextField control={control} name="name" label="Household name" required disabled={!canManage} />
            <FormSelectField
              control={control}
              name="type"
              label="Household type"
              disabled={!canManage}
              options={Object.entries(HOUSEHOLD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <FormTextField control={control} name="description" label="Description" multiline minRows={2} disabled={!canManage} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormSelectField
                control={control}
                name="currency"
                label="Currency"
                disabled={!canManage}
                options={SUPPORTED_CURRENCIES.map((currency) => ({ value: currency.code, label: currency.label }))}
                helperText="Changes how amounts are displayed; existing amounts are not converted."
              />
              <FormSelectField
                control={control}
                name="timeZone"
                label="Time zone"
                disabled={!canManage}
                options={zones.map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
                helperText="Used for “today”, due dates and reminders."
              />
            </Stack>
            {canManage && (
              <Box>
                <Button type="submit" variant="contained" disabled={!formState.isDirty || formState.isSubmitting}>
                  Save changes
                </Button>
              </Box>
            )}
          </Stack>
        </form>
      </SectionCard>

      <SectionCard title="Modules" subtitle="Hidden modules keep their data and can be shown again any time" icon={<LayoutGrid size={17} />}>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {MODULE_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              sx={{ alignItems: 'flex-start', m: 0, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2.5 }}
              control={
                <Switch
                  checked={household.enabledModules.includes(key)}
                  onChange={(event) => toggleModule(key, event.target.checked)}
                  disabled={!canManage}
                  sx={{ mt: -0.5 }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {MODULE_INFO[key].label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {MODULE_INFO[key].description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Box>
      </SectionCard>

      <SectionCard title="Custom expense categories" icon={<Tags size={17} />}>
        {household.customExpenseCategories.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No custom categories yet. Add them from the “Category” field when recording an expense.
          </Typography>
        ) : (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {household.customExpenseCategories.map((category) => (
              <Chip key={category} label={category} onDelete={canManage ? () => removeCategory(category) : undefined} />
            ))}
          </Stack>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Manage people and roles on the{' '}
          <Box component={RouterLink} to={paths.members()} sx={{ color: 'primary.main', fontWeight: 600 }}>
            Household Members
          </Box>{' '}
          page.
        </Typography>
      </SectionCard>

      {canDelete && (
        <SectionCard title="Delete household" icon={<Trash2 size={17} />}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
            Permanently deletes {household.name} with all its inventory, lists, tasks, bills, expenses, assets, events and
            documents for every member on this device. Consider downloading a backup first (Data & backup).
          </Typography>
          <Button color="error" variant="outlined" onClick={() => setDeleteOpen(true)}>
            Delete this household
          </Button>
        </SectionCard>
      )}

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="xs" fullWidth aria-labelledby="delete-household-title">
        <DialogTitle id="delete-household-title">Delete {household.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This can’t be undone. Type the household name to confirm.
          </Typography>
          <TextField
            label="Household name"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            autoFocus
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" disabled={confirmName.trim() !== household.name || deleting} onClick={runDelete}>
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

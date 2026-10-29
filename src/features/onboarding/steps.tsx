import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ArrowRight, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  useActiveHousehold,
  useAppDispatch,
  useAppSelector,
  useCollection,
  useCommit,
  useCurrentUser,
} from '@/app/hooks';
import { commitChanges, switchHousehold } from '@/data/actions';
import { toUserMessage } from '@/data/errors';
import { buildNewHousehold, buildProfile } from '@/features/household/factory';
import { createDemoHousehold } from '@/features/household/demo';
import { FormSelectField, FormTextField } from '@/components/form/fields';
import { selectMyHouseholds } from '@/store/selectors';
import { MODULE_KEYS, type InventoryItem, type ModuleKey, type Role, type ShoppingItem, type ShoppingList } from '@/types/models';
import { HOUSEHOLD_TYPE_LABELS, MODULE_INFO } from '@/lib/constants';
import { COMMON_TIME_ZONES, browserTimeZone } from '@/lib/dates';
import { SUPPORTED_CURRENCIES } from '@/lib/money';
import { newId, nowIso } from '@/lib/ids';
import { optionalText, requiredText } from '@/lib/validation';
import { ROLE_LABELS } from '@/lib/permissions';
import { paths } from '@/app/paths';

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '1.375rem', sm: '1.625rem' } }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        {description}
      </Typography>
    </Box>
  );
}

function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mt: 4 }}>
      {children}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */

export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const user = useCurrentUser();
  const households = useAppSelector(selectMyHouseholds);
  const hasDemo = households.some(({ household }) => household.isDemo);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exploreDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await dispatch(createDemoHousehold());
      navigate(paths.overview(), { replace: true });
    } catch (caught) {
      setError(toUserMessage(caught));
      setBusy(false);
    }
  };

  return (
    <>
      <StepHeading
        title={`Welcome${user ? `, ${user.name.split(' ')[0]}` : ''}!`}
        description="Let’s set up your household. It takes about a minute, and you can skip anything that isn’t essential."
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1.5}>
        {[
          'See what needs attention today — chores, bills, expiring food.',
          'Share shopping lists that update your pantry and expenses.',
          'Split costs fairly and keep track of who owes whom.',
        ].map((text) => (
          <Stack key={text} direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={(theme) => ({ color: theme.tokens.success, mt: '2px' })}>
              <Check size={18} aria-hidden />
            </Box>
            <Typography variant="body2">{text}</Typography>
          </Stack>
        ))}
      </Stack>
      <StepActions>
        {households.length > 0 && (
          <Button color="inherit" onClick={() => navigate(paths.overview())}>
            Cancel
          </Button>
        )}
        {!hasDemo && (
          <Button variant="outlined" startIcon={<Sparkles size={18} />} onClick={exploreDemo} disabled={busy}>
            {busy ? 'Preparing sample data…' : 'Explore with sample data'}
          </Button>
        )}
        <Button variant="contained" endIcon={<ArrowRight size={18} />} onClick={onContinue} disabled={busy}>
          Set up my household
        </Button>
      </StepActions>
    </>
  );
}

/* ------------------------------------------------------------------ */

const householdSchema = z.object({
  name: requiredText('Household name', 60),
  type: z.enum(['individual', 'couple', 'family', 'roommates']),
  description: optionalText(240),
  currency: z.string().min(1),
  timeZone: z.string().min(1),
});
type HouseholdValues = z.infer<typeof householdSchema>;

export function HouseholdStep({ onCreated }: { onCreated: () => void }) {
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const [error, setError] = useState<string | null>(null);
  const zone = browserTimeZone();
  const zones = COMMON_TIME_ZONES.includes(zone) ? COMMON_TIME_ZONES : [zone, ...COMMON_TIME_ZONES];
  const { control, handleSubmit, formState } = useForm<HouseholdValues>({
    resolver: zodResolver(householdSchema),
    defaultValues: { name: '', type: 'family', description: '', currency: 'INR', timeZone: zone },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    setError(null);
    try {
      const { household, changes } = buildNewHousehold(values, user.id, nowIso());
      await dispatch(
        commitChanges(changes, {
          flow: 'createHousehold',
          householdId: household.id,
          activity: { entity: 'household', entityId: household.id, message: `Created the household “${household.name}”` },
        }),
      );
      await dispatch(switchHousehold(household.id));
      onCreated();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <StepHeading title="Create your household" description="You can change these details later in Settings." />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={2}>
        <FormTextField control={control} name="name" label="Household name" required placeholder="e.g. Maple Street Home" autoFocus />
        <FormSelectField
          control={control}
          name="type"
          label="Who lives here?"
          options={Object.entries(HOUSEHOLD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <FormTextField control={control} name="description" label="Description (optional)" multiline minRows={2} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormSelectField
            control={control}
            name="currency"
            label="Currency"
            options={SUPPORTED_CURRENCIES.map((currency) => ({ value: currency.code, label: currency.label }))}
          />
          <FormSelectField
            control={control}
            name="timeZone"
            label="Time zone"
            options={zones.map((value) => ({ value, label: value.replace(/_/g, ' ') }))}
          />
        </Stack>
      </Stack>
      <StepActions>
        <Button type="submit" variant="contained" endIcon={<ArrowRight size={18} />} disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating…' : 'Create household'}
        </Button>
      </StepActions>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function ModulesStep({ onDone }: { onDone: () => void }) {
  const household = useActiveHousehold();
  const commit = useCommit();
  const [enabled, setEnabled] = useState<ModuleKey[]>(household?.enabledModules ?? [...MODULE_KEYS]);
  const [saving, setSaving] = useState(false);

  const toggle = (key: ModuleKey) =>
    setEnabled((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));

  const save = async () => {
    if (!household) return;
    setSaving(true);
    const ordered = MODULE_KEYS.filter((key) => enabled.includes(key));
    const ok = await commit(
      { put: { households: [{ ...household, enabledModules: ordered, updatedAt: nowIso() }] } },
      { action: 'manageHousehold' },
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <>
      <StepHeading
        title="What would you like to start with?"
        description="Hidden modules stay available — turn them back on any time in Settings."
      />
      <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        {MODULE_KEYS.map((key) => {
          const selected = enabled.includes(key);
          return (
            <Card
              key={key}
              sx={(theme) => ({
                borderColor: selected ? theme.palette.primary.main : undefined,
                backgroundColor: selected ? theme.tokens.sage : undefined,
                transition: 'background-color 160ms ease, border-color 160ms ease',
              })}
            >
              <CardActionArea
                onClick={() => toggle(key)}
                role="checkbox"
                aria-checked={selected}
                sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1, justifyContent: 'flex-start' }}
              >
                <Checkbox checked={selected} tabIndex={-1} sx={{ p: 0, mt: '2px' }} inputProps={{ 'aria-hidden': true }} />
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{MODULE_INFO[key].label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {MODULE_INFO[key].description}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      <StepActions>
        <Button variant="contained" endIcon={<ArrowRight size={18} />} onClick={save} disabled={saving}>
          Continue
        </Button>
      </StepActions>
    </>
  );
}

/* ------------------------------------------------------------------ */

interface MemberDraft {
  key: string;
  name: string;
  role: Exclude<Role, 'owner'>;
}

export function MembersStep({ onDone }: { onDone: () => void }) {
  const household = useActiveHousehold();
  const commit = useCommit();
  const [drafts, setDrafts] = useState<MemberDraft[]>([{ key: newId(), name: '', role: 'member' }]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const named = drafts.filter((draft) => draft.name.trim() !== '');
  const tooLong = drafts.some((draft) => draft.name.trim().length > 60);

  const save = async () => {
    setTouched(true);
    if (!household || tooLong) return;
    if (named.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    const now = nowIso();
    const profiles = named.map((draft) => ({ draft, profile: buildProfile(draft.name, undefined, now) }));
    const ok = await commit(
      {
        put: {
          users: profiles.map(({ profile }) => profile.user),
          preferences: profiles.flatMap(({ profile }) => profile.put?.preferences ?? []),
          memberships: profiles.map(({ draft, profile }) => ({
            id: newId(),
            householdId: household.id,
            userId: profile.user.id,
            role: draft.role,
            createdAt: now,
            updatedAt: now,
          })),
        },
      },
      {
        action: 'manageMembers',
        success: `${named.length} member${named.length === 1 ? '' : 's'} added`,
        activity: named.map((draft) => ({ entity: 'member', message: `Added ${draft.name.trim()} as ${ROLE_LABELS[draft.role].toLowerCase()}` })),
      },
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <>
      <StepHeading
        title="Who else lives here?"
        description="Add people so you can assign chores and split expenses. Each person gets a local profile on this device. You can also create invite links later from Household Members."
      />
      <Stack spacing={1.5}>
        {drafts.map((draft, index) => (
          <Stack key={draft.key} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            <TextField
              label={`Name ${index + 1}`}
              value={draft.name}
              onChange={(event) =>
                setDrafts((current) => current.map((item) => (item.key === draft.key ? { ...item, name: event.target.value } : item)))
              }
              error={touched && draft.name.trim().length > 60}
              helperText={touched && draft.name.trim().length > 60 ? 'Use 60 characters or fewer' : undefined}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                select
                label="Role"
                value={draft.role}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item) => (item.key === draft.key ? { ...item, role: event.target.value as MemberDraft['role'] } : item)),
                  )
                }
                sx={{ minWidth: 140 }}
              >
                {(['admin', 'member', 'viewer'] as const).map((role) => (
                  <MenuItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton
                aria-label={`Remove name ${index + 1}`}
                onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}
                disabled={drafts.length === 1}
              >
                <Trash2 size={18} />
              </IconButton>
            </Stack>
          </Stack>
        ))}
        <Box>
          <Button
            startIcon={<Plus size={16} />}
            onClick={() => setDrafts((current) => [...current, { key: newId(), name: '', role: 'member' }])}
          >
            Add another person
          </Button>
        </Box>
      </Stack>
      <StepActions>
        <Button color="inherit" onClick={onDone} disabled={saving}>
          Skip for now
        </Button>
        <Button variant="contained" endIcon={<ArrowRight size={18} />} onClick={save} disabled={saving}>
          {named.length > 0 ? `Add ${named.length} and continue` : 'Continue'}
        </Button>
      </StepActions>
    </>
  );
}

/* ------------------------------------------------------------------ */

const STARTER_ITEMS: { name: string; unit: string; category: string; location: string }[] = [
  { name: 'Rice', unit: 'kg', category: 'Grains & staples', location: 'Pantry' },
  { name: 'Milk', unit: 'L', category: 'Dairy & eggs', location: 'Refrigerator' },
  { name: 'Eggs', unit: 'pcs', category: 'Dairy & eggs', location: 'Refrigerator' },
  { name: 'Bread', unit: 'pack', category: 'Grains & staples', location: 'Kitchen cabinet' },
  { name: 'Cooking oil', unit: 'L', category: 'Kitchen supplies', location: 'Kitchen cabinet' },
  { name: 'Tea', unit: 'pack', category: 'Beverages', location: 'Kitchen cabinet' },
  { name: 'Dish soap', unit: 'bottle', category: 'Cleaning supplies', location: 'Kitchen cabinet' },
  { name: 'Laundry detergent', unit: 'kg', category: 'Cleaning supplies', location: 'Laundry room' },
  { name: 'Toilet paper', unit: 'roll', category: 'Paper products', location: 'Bathroom' },
  { name: 'Toothpaste', unit: 'pcs', category: 'Toiletries', location: 'Bathroom' },
];

export function StarterItemsStep({ onDone }: { onDone: () => void }) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const categories = useCollection('inventoryCategories');
  const locations = useCollection('inventoryLocations');
  const commit = useCommit();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<'inventory' | 'shopping'>('shopping');
  const [saving, setSaving] = useState(false);
  const inventoryEnabled = household?.enabledModules.includes('inventory') ?? true;
  const shoppingEnabled = household?.enabledModules.includes('shopping') ?? true;
  const effectiveTarget = !shoppingEnabled ? 'inventory' : !inventoryEnabled ? 'shopping' : target;

  if (!inventoryEnabled && !shoppingEnabled) {
    return (
      <>
        <StepHeading title="You’re almost done" description="Inventory and shopping are turned off, so there’s nothing to add here." />
        <StepActions>
          <Button variant="contained" onClick={onDone}>
            Continue
          </Button>
        </StepActions>
      </>
    );
  }

  const save = async () => {
    if (!household || !user || selected.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    const now = nowIso();
    const picks = STARTER_ITEMS.filter((item) => selected.includes(item.name));
    const categoryId = (name: string) => categories.find((entry) => entry.name === name)?.id ?? categories[0]?.id ?? '';
    const locationId = (name: string) => locations.find((entry) => entry.name === name)?.id ?? locations[0]?.id ?? '';
    let ok: boolean;
    if (effectiveTarget === 'inventory') {
      const items: InventoryItem[] = picks.map((pick) => ({
        id: newId(),
        householdId: household.id,
        name: pick.name,
        categoryId: categoryId(pick.category),
        locationId: locationId(pick.location),
        quantity: 1,
        unit: pick.unit,
        minQuantity: 1,
        archived: false,
        createdAt: now,
        updatedAt: now,
      }));
      ok = await commit(
        {
          put: {
            inventoryItems: items,
            inventoryMovements: items.map((item) => ({
              id: newId(),
              householdId: household.id,
              itemId: item.id,
              type: 'initial' as const,
              delta: item.quantity,
              quantityAfter: item.quantity,
              actorId: user.id,
              occurredAt: now,
              note: 'Opening stock',
              createdAt: now,
              updatedAt: now,
            })),
          },
        },
        { success: `${items.length} items added to inventory`, activity: { entity: 'inventory', message: `Added ${items.length} starter items to inventory` } },
      );
    } else {
      const list: ShoppingList = {
        id: newId(),
        householdId: household.id,
        name: 'Weekly Groceries',
        archived: false,
        createdBy: user.id,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const items: ShoppingItem[] = picks.map((pick, index) => ({
        id: newId(),
        householdId: household.id,
        listId: list.id,
        name: pick.name,
        quantity: 1,
        unit: pick.unit,
        categoryId: categoryId(pick.category),
        priority: 'normal',
        purchased: false,
        addedBy: user.id,
        sortOrder: index + 1,
        createdAt: now,
        updatedAt: now,
      }));
      ok = await commit(
        { put: { shoppingLists: [list], shoppingItems: items } },
        { success: `Shopping list created with ${items.length} items`, activity: { entity: 'shopping', entityId: list.id, message: 'Created the list “Weekly Groceries”' } },
      );
    }
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <>
      <StepHeading title="Add a few everyday items" description="Pick some common items to get started — or skip and add your own later." />
      {inventoryEnabled && shoppingEnabled && (
        <ToggleButtonGroup
          exclusive
          value={target}
          onChange={(_, value: 'inventory' | 'shopping' | null) => value && setTarget(value)}
          size="small"
          sx={{ mb: 2 }}
          aria-label="Where to add the items"
        >
          <ToggleButton value="shopping">Start a shopping list</ToggleButton>
          <ToggleButton value="inventory">Add to inventory</ToggleButton>
        </ToggleButtonGroup>
      )}
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {STARTER_ITEMS.map((item) => {
          const active = selected.includes(item.name);
          return (
            <Chip
              key={item.name}
              label={item.name}
              icon={active ? <Check size={14} /> : <Plus size={14} />}
              onClick={() =>
                setSelected((current) => (active ? current.filter((name) => name !== item.name) : [...current, item.name]))
              }
              aria-pressed={active}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              sx={{ height: 36, fontSize: '0.875rem' }}
            />
          );
        })}
      </Stack>
      <StepActions>
        <Button color="inherit" onClick={onDone} disabled={saving}>
          Skip
        </Button>
        <Button variant="contained" endIcon={<ArrowRight size={18} />} onClick={save} disabled={saving || selected.length === 0}>
          Add {selected.length > 0 ? selected.length : ''} items
        </Button>
      </StepActions>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function DoneStep() {
  const household = useActiveHousehold();
  const navigate = useNavigate();
  return (
    <Stack alignItems="center" textAlign="center" spacing={2} sx={{ py: 2 }}>
      <Box
        sx={(theme) => ({
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: theme.tokens.sage,
          color: theme.tokens.sageText,
        })}
      >
        <Check size={30} aria-hidden />
      </Box>
      <Typography variant="h1">{household?.name ?? 'Your household'} is ready</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        Your overview shows what needs attention each day. Use “Add new” in the header whenever you want to add something.
      </Typography>
      <Button variant="contained" size="large" onClick={() => navigate(paths.overview(), { replace: true })}>
        Go to my dashboard
      </Button>
    </Stack>
  );
}

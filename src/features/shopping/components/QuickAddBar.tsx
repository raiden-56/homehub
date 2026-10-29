import { useMemo, useRef, useState, useEffect } from 'react';
import { Autocomplete, Box, Button, InputAdornment, Stack, TextField } from '@mui/material';
import { ListPlus, Plus } from 'lucide-react';
import { useCollection } from '@/app/hooks';
import type { ShoppingList } from '@/types/models';
import { useAddToShoppingList } from '../hooks';
import { isPending, normaliseName, parseQuickAdd, quickAddSuggestions } from '../logic';

interface QuickAddBarProps {
  list: ShoppingList;
  autoFocus?: boolean;
  onAddMultiple: () => void;
}

/** Type-and-Enter item entry with suggestions from what the household usually buys. */
export function QuickAddBar({ list, autoFocus, onAddMultiple }: QuickAddBarProps) {
  const items = useCollection('shoppingItems');
  const inventory = useCollection('inventoryItems');
  const addToList = useAddToShoppingList();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const suggestions = useMemo(() => {
    const pending = new Set(items.filter((item) => item.listId === list.id && isPending(item)).map((item) => normaliseName(item.name)));
    return quickAddSuggestions(items, inventory.filter((item) => !item.archived).map((item) => item.name))
      .filter((name) => !pending.has(normaliseName(name)))
      .slice(0, 40);
  }, [items, inventory, list.id]);

  const add = async (text: string) => {
    const parsed = parseQuickAdd(text);
    // A ref guards against a second Enter before the first add has been saved.
    if (!parsed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const match = inventory.find((entry) => !entry.archived && normaliseName(entry.name) === normaliseName(parsed.name));
    const result = await addToList(
      [{ ...parsed, unit: match && parsed.unit === 'pcs' ? match.unit : parsed.unit, inventoryItemId: match?.id, categoryId: match?.categoryId }],
      list.id,
    );
    busyRef.current = false;
    setBusy(false);
    if (result) setInput('');
    inputRef.current?.focus();
  };

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      <Autocomplete
        freeSolo
        fullWidth
        options={suggestions}
        value={null}
        inputValue={input}
        onInputChange={(_, value, reason) => {
          if (reason !== 'reset') setInput(value);
        }}
        onChange={(_, value) => {
          if (typeof value === 'string' && value.trim()) void add(value);
        }}
        clearOnBlur={false}
        filterOptions={(options, state) => {
          const query = normaliseName(parseQuickAdd(state.inputValue)?.name ?? '');
          return (query ? options.filter((option) => normaliseName(option).includes(query)) : options).slice(0, 8);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            placeholder="Add an item, e.g. “2 L milk”"
            inputProps={{ ...params.inputProps, 'aria-label': `Add item to ${list.name}`, enterKeyHint: 'enter' }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start">
                  <Plus size={18} aria-hidden />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Button variant="contained" onClick={() => void add(input)} disabled={!input.trim() || busy} sx={{ flexShrink: 0 }}>
        Add
      </Button>
      <Button
        variant="outlined"
        onClick={onAddMultiple}
        aria-label="Add several items"
        sx={{ flexShrink: 0, minWidth: { xs: 44, sm: 64 }, px: { xs: 1, sm: 2 } }}
      >
        <ListPlus size={18} aria-hidden />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 1 }}>
          Several
        </Box>
      </Button>
    </Stack>
  );
}

import type { AppDispatch, RootState } from '@/app/store';
import type { ChangeSet } from '@/data/collections';
import { writeChanges } from '@/data/db';
import { switchHousehold } from '@/data/actions';
import { broadcastChange } from '@/data/sync';
import { changesApplied } from '@/store/dataSlice';
import type {
  ActivityLog,
  Asset,
  Bill,
  BillOccurrence,
  Budget,
  CalendarEvent,
  DocumentBlob,
  Expense,
  HouseholdDocument,
  HouseholdMembership,
  InventoryItem,
  InventoryMovement,
  MaintenanceRecord,
  MaintenanceTask,
  Role,
  Settlement,
  ShoppingItem,
  ShoppingList,
  Task,
  User,
} from '@/types/models';
import { addDaysISO, addMonthsISO, todayIn } from '@/lib/dates';
import { allocateEvenly } from '@/lib/money';
import { newId } from '@/lib/ids';
import { occurrencesBetween } from '@/lib/recurrence';
import { BILL_TO_EXPENSE_CATEGORY, pickAvatarColor } from '@/lib/constants';
import { billOccurrenceId } from '@/features/finance/logic/bills';
import { buildNewHousehold, defaultPreferences } from './factory';

/** Small deterministic PRNG so the demo looks the same on every machine. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rupees = (value: number) => Math.round(value * 100);

/** Timestamp at a given hour on a household-local date (approximate; used for history only). */
function at(date: string, hour = 10, minute = 0): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();
}

export interface DemoResult {
  householdId: string;
  changes: ChangeSet;
  blobs: DocumentBlob[];
}

/**
 * Builds a complete sample household for `ownerId` with realistic, internally consistent data:
 * every expense total comes from recorded expenses, bills have matching paid occurrences, and
 * inventory quantities match their movement history.
 */
export function buildDemoHousehold(ownerId: string, timeZone = 'Asia/Kolkata'): DemoResult {
  const random = mulberry32(20261029);
  const today = todayIn(timeZone);
  const day = (offset: number) => addDaysISO(today, offset);
  const now = new Date().toISOString();
  const stamp = (offset: number, hour = 10) => at(day(offset), hour);

  const { household, changes: base, taxonomy } = buildNewHousehold(
    {
      name: 'Maple Street Home',
      type: 'family',
      description: 'Sample household with demo data — explore freely, then delete it from Settings → Data.',
      currency: 'INR',
      timeZone,
    },
    ownerId,
    now,
    { isDemo: true },
  );
  const householdId = household.id;
  const meta = (createdOffset = -30) => ({
    householdId,
    createdAt: stamp(createdOffset),
    updatedAt: stamp(createdOffset),
  });

  /* ---------------- Members ---------------- */
  const demoPeople: { name: string; email: string; role: Role }[] = [
    { name: 'Priya Sharma', email: 'priya@example.com', role: 'admin' },
    { name: 'Arjun Sharma', email: 'arjun@example.com', role: 'member' },
    { name: 'Kavya Sharma', email: 'kavya@example.com', role: 'member' },
  ];
  const users: User[] = demoPeople.map((person) => {
    const id = newId();
    return { id, name: person.name, email: person.email, avatarColor: pickAvatarColor(id), createdAt: now, updatedAt: now };
  });
  const [priya, arjun, kavya] = users.map((user) => user.id) as [string, string, string];
  const memberships: HouseholdMembership[] = users.map((user, index) => ({
    id: newId(),
    householdId,
    userId: user.id,
    role: demoPeople[index]!.role,
    createdAt: stamp(-120),
    updatedAt: stamp(-120),
  }));
  const everyone = [ownerId, priya, arjun, kavya];

  /* ---------------- Inventory ---------------- */
  const category = (name: string) => taxonomy.categories.find((entry) => entry.name === name)!.id;
  const location = (name: string) => taxonomy.locations.find((entry) => entry.name === name)!.id;

  type ItemSeed = Omit<InventoryItem, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'archived'> & {
    /** Daily consumption history to seed (quantity per use, days apart). */
    usage?: { amount: number; every: number; times: number };
  };
  const itemSeeds: ItemSeed[] = [
    { name: 'Basmati rice', categoryId: category('Grains & staples'), locationId: location('Pantry'), quantity: 4, unit: 'kg', minQuantity: 2, purchasePriceMinor: rupees(560), purchaseDate: day(-20), usage: { amount: 0.5, every: 3, times: 6 } },
    { name: 'Toor dal', categoryId: category('Grains & staples'), locationId: location('Pantry'), quantity: 0.5, unit: 'kg', minQuantity: 1, purchasePriceMinor: rupees(165), purchaseDate: day(-26), usage: { amount: 0.25, every: 4, times: 5 } },
    { name: 'Whole wheat atta', categoryId: category('Grains & staples'), locationId: location('Pantry'), quantity: 8, unit: 'kg', minQuantity: 3, purchasePriceMinor: rupees(420), purchaseDate: day(-10) },
    { name: 'Milk', categoryId: category('Dairy & eggs'), locationId: location('Refrigerator'), quantity: 1, unit: 'L', minQuantity: 2, purchasePriceMinor: rupees(68), purchaseDate: day(-1), expiryDate: day(1), usage: { amount: 1, every: 1, times: 10 } },
    { name: 'Eggs', categoryId: category('Dairy & eggs'), locationId: location('Refrigerator'), quantity: 4, unit: 'pcs', minQuantity: 6, purchasePriceMinor: rupees(90), purchaseDate: day(-5), expiryDate: day(9), usage: { amount: 2, every: 1, times: 4 } },
    { name: 'Paneer', categoryId: category('Dairy & eggs'), locationId: location('Refrigerator'), quantity: 200, unit: 'g', minQuantity: 0, purchasePriceMinor: rupees(95), purchaseDate: day(-2), expiryDate: day(2) },
    { name: 'Greek yogurt', categoryId: category('Dairy & eggs'), locationId: location('Refrigerator'), quantity: 400, unit: 'g', minQuantity: 0, purchasePriceMinor: rupees(120), purchaseDate: day(-8), expiryDate: day(-1) },
    { name: 'Tomatoes', categoryId: category('Fruits & vegetables'), locationId: location('Refrigerator'), quantity: 1, unit: 'kg', minQuantity: 0.5, purchasePriceMinor: rupees(40), purchaseDate: day(-3), expiryDate: day(3) },
    { name: 'Bananas', categoryId: category('Fruits & vegetables'), locationId: location('Kitchen cabinet'), quantity: 6, unit: 'pcs', minQuantity: 4, purchasePriceMinor: rupees(60), purchaseDate: day(-2), expiryDate: day(2) },
    { name: 'Frozen green peas', categoryId: category('Fruits & vegetables'), locationId: location('Freezer'), quantity: 500, unit: 'g', minQuantity: 0, purchasePriceMinor: rupees(110), purchaseDate: day(-30), expiryDate: day(90) },
    { name: 'Olive oil', categoryId: category('Kitchen supplies'), locationId: location('Kitchen cabinet'), quantity: 1, unit: 'bottle', minQuantity: 1, purchasePriceMinor: rupees(899), purchaseDate: day(-40), expiryDate: day(240) },
    { name: 'Coffee beans', categoryId: category('Beverages'), locationId: location('Kitchen cabinet'), quantity: 250, unit: 'g', minQuantity: 200, purchasePriceMinor: rupees(650), purchaseDate: day(-12), expiryDate: day(60), usage: { amount: 30, every: 2, times: 5 } },
    { name: 'Green tea', categoryId: category('Beverages'), locationId: location('Kitchen cabinet'), quantity: 1, unit: 'box', minQuantity: 1, purchasePriceMinor: rupees(275), purchaseDate: day(-35), expiryDate: day(300) },
    { name: 'Digestive biscuits', categoryId: category('Snacks'), locationId: location('Pantry'), quantity: 3, unit: 'pack', minQuantity: 2, purchasePriceMinor: rupees(70), purchaseDate: day(-9), expiryDate: day(70) },
    { name: 'Dish soap', categoryId: category('Cleaning supplies'), locationId: location('Kitchen cabinet'), quantity: 0, unit: 'bottle', minQuantity: 1, purchasePriceMinor: rupees(199), purchaseDate: day(-45), usage: { amount: 0.25, every: 10, times: 4 } },
    { name: 'Laundry detergent', categoryId: category('Cleaning supplies'), locationId: location('Laundry room'), quantity: 1.5, unit: 'kg', minQuantity: 1, purchasePriceMinor: rupees(475), purchaseDate: day(-25) },
    { name: 'Floor cleaner', categoryId: category('Cleaning supplies'), locationId: location('Storage room'), quantity: 1, unit: 'bottle', minQuantity: 1, purchasePriceMinor: rupees(189), purchaseDate: day(-18) },
    { name: 'Garbage bags', categoryId: category('Cleaning supplies'), locationId: location('Storage room'), quantity: 1, unit: 'box', minQuantity: 1, purchasePriceMinor: rupees(145), purchaseDate: day(-15) },
    { name: 'Toilet paper', categoryId: category('Paper products'), locationId: location('Bathroom'), quantity: 4, unit: 'roll', minQuantity: 6, purchasePriceMinor: rupees(340), purchaseDate: day(-21), usage: { amount: 1, every: 3, times: 6 } },
    { name: 'Paper towels', categoryId: category('Paper products'), locationId: location('Kitchen cabinet'), quantity: 2, unit: 'roll', minQuantity: 2, purchasePriceMinor: rupees(180), purchaseDate: day(-14) },
    { name: 'Toothpaste', categoryId: category('Toiletries'), locationId: location('Bathroom'), quantity: 2, unit: 'pcs', minQuantity: 1, purchasePriceMinor: rupees(110), purchaseDate: day(-28), expiryDate: day(400) },
  ];

  const inventoryItems: InventoryItem[] = [];
  const movements: InventoryMovement[] = [];
  for (const seed of itemSeeds) {
    const { usage, ...fields } = seed;
    const id = newId();
    const createdOffset = -45;
    inventoryItems.push({ ...fields, id, archived: false, ...meta(createdOffset), updatedAt: stamp(-1) });
    // Movement history ends at the current quantity: initial stock, then periodic consumption.
    const consumed = usage ? usage.amount * usage.times : 0;
    const initial = Math.round((seed.quantity + consumed) * 1000) / 1000;
    movements.push({
      id: newId(),
      ...meta(createdOffset),
      itemId: id,
      type: 'initial',
      delta: initial,
      quantityAfter: initial,
      actorId: ownerId,
      occurredAt: stamp(createdOffset),
      note: 'Opening stock',
    });
    if (usage) {
      let quantity = initial;
      for (let index = usage.times; index >= 1; index -= 1) {
        quantity = Math.round((quantity - usage.amount) * 1000) / 1000;
        const offset = -index * usage.every;
        movements.push({
          id: newId(),
          ...meta(offset),
          itemId: id,
          type: 'consume',
          delta: -usage.amount,
          quantityAfter: quantity,
          actorId: everyone[index % everyone.length]!,
          occurredAt: stamp(offset, 19),
        });
      }
    }
  }

  /* ---------------- Shopping ---------------- */
  const weekly: ShoppingList = { id: newId(), ...meta(-14), name: 'Weekly Groceries', archived: false, createdBy: ownerId, lastActivityAt: stamp(0, 8) };
  const monthly: ShoppingList = { id: newId(), ...meta(-40), name: 'Monthly Essentials', archived: false, createdBy: priya, lastActivityAt: stamp(-2) };
  const pharmacy: ShoppingList = { id: newId(), ...meta(-20), name: 'Pharmacy & Toiletries', archived: false, createdBy: priya, lastActivityAt: stamp(-4) };
  let order = 0;
  const shop = (
    list: ShoppingList,
    name: string,
    quantity: number,
    unit: string,
    extra: Partial<ShoppingItem> = {},
  ): ShoppingItem => {
    order += 1;
    const inventory = inventoryItems.find((item) => item.name === name);
    return {
      id: newId(),
      ...meta(-2),
      listId: list.id,
      name,
      quantity,
      unit,
      categoryId: inventory?.categoryId,
      inventoryItemId: inventory?.id,
      priority: 'normal',
      purchased: false,
      addedBy: ownerId,
      sortOrder: order,
      ...extra,
    };
  };
  const shoppingItems: ShoppingItem[] = [
    shop(weekly, 'Milk', 2, 'L', { estimatedPriceMinor: rupees(136), priority: 'high', addedBy: priya }),
    shop(weekly, 'Eggs', 12, 'pcs', { estimatedPriceMinor: rupees(84) }),
    shop(weekly, 'Tomatoes', 1, 'kg', { estimatedPriceMinor: rupees(40) }),
    shop(weekly, 'Coriander', 1, 'bag', { categoryId: category('Fruits & vegetables'), estimatedPriceMinor: rupees(15), addedBy: kavya }),
    shop(weekly, 'Brown bread', 1, 'pack', { categoryId: category('Grains & staples'), estimatedPriceMinor: rupees(55), notes: 'Multigrain if available' }),
    shop(weekly, 'Bananas', 6, 'pcs', {
      estimatedPriceMinor: rupees(60),
      actualPriceMinor: rupees(60),
      purchased: true,
      purchasedAt: stamp(-2, 18),
      purchasedBy: arjun,
      receivedAt: stamp(-2, 18),
    }),
    shop(monthly, 'Toilet paper', 12, 'roll', { estimatedPriceMinor: rupees(560), addedBy: priya }),
    shop(monthly, 'Dish soap', 2, 'bottle', { estimatedPriceMinor: rupees(398), priority: 'high' }),
    shop(monthly, 'Laundry detergent', 2, 'kg', { estimatedPriceMinor: rupees(620) }),
    shop(pharmacy, 'Toothpaste', 2, 'pcs', { estimatedPriceMinor: rupees(220), addedBy: priya }),
    shop(pharmacy, 'Hand wash refill', 1, 'pack', { categoryId: category('Toiletries'), estimatedPriceMinor: rupees(149) }),
  ];

  /* ---------------- Tasks ---------------- */
  const task = (fields: Partial<Task> & Pick<Task, 'title' | 'category'>, createdOffset = -10): Task => ({
    id: newId(),
    ...meta(createdOffset),
    priority: 'medium',
    status: 'not_started',
    checklist: [],
    comments: [],
    boardOrder: 0,
    createdBy: ownerId,
    ...fields,
  });
  const recyclingSeries = newId();
  const plantsSeries = newId();
  const bathroomSeries = newId();
  const sheetsSeries = newId();
  const chimneySeries = newId();
  const tasks: Task[] = [
    task({ title: 'Take out recycling', category: 'Cleaning', assigneeId: arjun, dueDate: day(0), dueTime: '20:00', recurrence: { frequency: 'weekly', interval: 1, byWeekday: [1, 4] }, seriesId: recyclingSeries, priority: 'low', boardOrder: 1 }),
    task({ title: 'Water the balcony plants', category: 'Outdoor', assigneeId: kavya, dueDate: day(0), dueTime: '08:00', recurrence: { frequency: 'daily', interval: 2 }, seriesId: plantsSeries, priority: 'low', boardOrder: 2 }),
    task({ title: 'Plan meals for the week', category: 'Kitchen', assigneeId: ownerId, dueDate: day(0), dueTime: '18:00', priority: 'medium', boardOrder: 3, checklist: [
      { id: newId(), text: 'Check what’s expiring', done: true },
      { id: newId(), text: 'Pick 5 dinners', done: false },
      { id: newId(), text: 'Update shopping list', done: false },
    ] }),
    task({ title: 'Fix the leaking kitchen tap', category: 'Admin', assigneeId: arjun, dueDate: day(1), priority: 'high', status: 'in_progress', boardOrder: 1, description: 'Washer is worn out. Plumber visit is booked if the DIY fix fails.', comments: [
      { id: newId(), authorId: priya, text: 'Spare washers are in the storage room toolbox.', createdAt: stamp(-1, 21) },
    ] }),
    task({ title: 'Clean bathrooms', category: 'Cleaning', assigneeId: priya, dueDate: day(2), recurrence: { frequency: 'weekly', interval: 1 }, seriesId: bathroomSeries, priority: 'medium', boardOrder: 4 }),
    task({ title: 'Change bed sheets', category: 'Laundry', assigneeId: kavya, dueDate: day(3), recurrence: { frequency: 'weekly', interval: 1 }, seriesId: sheetsSeries, boardOrder: 5 }),
    task({ title: 'Degrease kitchen chimney filter', category: 'Kitchen', assigneeId: ownerId, dueDate: day(-2), recurrence: { frequency: 'monthly', interval: 1 }, seriesId: chimneySeries, priority: 'high', boardOrder: 6 }),
    task({ title: 'Renew car parking sticker', category: 'Errands', assigneeId: priya, dueDate: day(6), priority: 'medium', boardOrder: 7 }),
    task({ title: 'Book pest control visit', category: 'Admin', dueDate: day(9), priority: 'low', boardOrder: 8 }),
  ];
  // Completion history (previous occurrences) so the workload view has real data.
  const done = (title: string, category: string, assigneeId: string, offset: number, seriesId?: string) =>
    task({ title, category, assigneeId, dueDate: day(offset), status: 'completed', completedAt: stamp(offset, 19), completedBy: assigneeId, seriesId }, offset - 3);
  tasks.push(
    done('Clean bathrooms', 'Cleaning', priya, -5, bathroomSeries),
    done('Clean bathrooms', 'Cleaning', arjun, -12, bathroomSeries),
    done('Change bed sheets', 'Laundry', kavya, -4, sheetsSeries),
    done('Change bed sheets', 'Laundry', ownerId, -11, sheetsSeries),
    done('Take out recycling', 'Cleaning', arjun, -3, recyclingSeries),
    done('Take out recycling', 'Cleaning', arjun, -7, recyclingSeries),
    done('Water the balcony plants', 'Outdoor', kavya, -2, plantsSeries),
    done('Water the balcony plants', 'Outdoor', kavya, -4, plantsSeries),
    done('Vacuum the living room', 'Cleaning', ownerId, -1),
    done('Sort the recycling bins', 'Cleaning', priya, -6),
    done('Return library books', 'Errands', kavya, -8),
    done('Clean refrigerator shelves', 'Kitchen', ownerId, -9),
  );

  /* ---------------- Bills & expenses ---------------- */
  const anchor = (dayOfMonth: number, monthsBack = 6) => {
    const start = addMonthsISO(`${today.slice(0, 7)}-01`, -monthsBack);
    return addDaysISO(start, dayOfMonth - 1);
  };
  const bill = (fields: Omit<Bill, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'active'>): Bill => ({
    id: newId(),
    ...meta(-180),
    active: true,
    ...fields,
  });
  const bills: Bill[] = [
    bill({ name: 'Apartment rent', category: 'Rent', amountMinor: rupees(28000), startDate: anchor(5), recurrence: { frequency: 'monthly', interval: 1 }, payerId: ownerId }),
    bill({ name: 'Society maintenance', category: 'Society maintenance', amountMinor: rupees(3500), startDate: anchor(10), recurrence: { frequency: 'monthly', interval: 1 }, payerId: priya }),
    bill({ name: 'Electricity', category: 'Electricity', amountMinor: rupees(2340), startDate: anchor(18), recurrence: { frequency: 'monthly', interval: 1 }, payerId: ownerId, notes: 'Amount varies with usage; update each month.' }),
    bill({ name: 'Fibre internet', category: 'Internet', amountMinor: rupees(1179), startDate: anchor(12), recurrence: { frequency: 'monthly', interval: 1 }, payerId: arjun }),
    bill({ name: 'Water', category: 'Water', amountMinor: rupees(1450), startDate: anchor(25, 9), recurrence: { frequency: 'quarterly', interval: 1 }, payerId: priya }),
    bill({ name: 'Streaming subscription', category: 'Subscriptions', amountMinor: rupees(649), startDate: anchor(22), recurrence: { frequency: 'monthly', interval: 1 }, payerId: ownerId }),
    bill({ name: 'Home insurance', category: 'Insurance', amountMinor: rupees(8900), startDate: addDaysISO(today, 24), recurrence: { frequency: 'yearly', interval: 1 }, payerId: ownerId }),
  ];

  const expenses: Expense[] = [];
  const billOccurrences: BillOccurrence[] = [];
  const historyStart = addDaysISO(today, -110);
  for (const entry of bills) {
    if (!entry.recurrence) continue;
    const past = occurrencesBetween(entry.recurrence, entry.startDate, historyStart, addDaysISO(today, -1));
    for (const date of past) {
      // Most recent electricity bill is still unpaid and now overdue.
      const unpaid = entry.category === 'Electricity' && date === past[past.length - 1] && date >= addDaysISO(today, -12);
      const variance = entry.category === 'Electricity' ? Math.round((random() - 0.5) * 60000) : 0;
      const amount = entry.amountMinor + variance;
      const id = billOccurrenceId(entry.id, date);
      if (unpaid) {
        billOccurrences.push({ id, householdId, billId: entry.id, originalDate: date, dueDate: date, amountMinor: amount, state: 'open', createdAt: at(date, 9), updatedAt: at(date, 9) });
        continue;
      }
      const paidOn = addDaysISO(date, -1 - Math.floor(random() * 3));
      const expenseId = newId();
      billOccurrences.push({ id, householdId, billId: entry.id, originalDate: date, dueDate: date, amountMinor: amount, state: 'paid', paidAt: paidOn, paidAmountMinor: amount, paidBy: entry.payerId, expenseId, createdAt: at(date, 9), updatedAt: at(paidOn, 20) });
      expenses.push({
        id: expenseId,
        householdId,
        description: entry.name,
        amountMinor: amount,
        date: paidOn,
        category: BILL_TO_EXPENSE_CATEGORY[entry.category] ?? 'Other',
        payerId: entry.payerId ?? ownerId,
        paymentMethod: 'Net banking',
        source: 'bill',
        sourceId: id,
        createdAt: at(paidOn, 20),
        updatedAt: at(paidOn, 20),
      });
    }
  }

  const splitEqually = (amountMinor: number, userIds: string[]) => {
    const shares = allocateEvenly(amountMinor, userIds.length);
    return { method: 'equal' as const, shares: userIds.map((userId, index) => ({ userId, shareMinor: shares[index]! })) };
  };
  const addExpense = (offset: number, description: string, category: string, amount: number, payerId: string, extra: Partial<Expense> = {}) => {
    const date = day(offset);
    expenses.push({
      id: newId(),
      householdId,
      description,
      amountMinor: amount,
      date,
      category,
      payerId,
      paymentMethod: 'UPI',
      source: 'manual',
      createdAt: at(date, 18),
      updatedAt: at(date, 18),
      ...extra,
    });
  };
  // Weekly grocery runs, household supplies, dining and transport over ~4 months.
  for (let offset = -108; offset <= -1; offset += 7) {
    const amount = rupees(1800 + Math.round(random() * 1400));
    const payer = [ownerId, priya, arjun][Math.floor(random() * 3)]!;
    addExpense(offset, 'Weekly groceries', 'Groceries', amount, payer, { split: splitEqually(amount, [ownerId, priya, arjun]) });
  }
  for (let offset = -100; offset <= -1; offset += 15) {
    addExpense(offset, 'Household supplies run', 'Household supplies', rupees(450 + Math.round(random() * 700)), [ownerId, priya][Math.floor(random() * 2)]!);
  }
  for (let offset = -95; offset <= -1; offset += 12) {
    const amount = rupees(900 + Math.round(random() * 1600));
    addExpense(offset, ['Family dinner out', 'Weekend brunch', 'Pizza night'][Math.floor(random() * 3)]!, 'Dining out', amount, [ownerId, arjun][Math.floor(random() * 2)]!, {
      split: splitEqually(amount, [ownerId, priya, arjun]),
      paymentMethod: 'Credit card',
    });
  }
  for (let offset = -90; offset <= -1; offset += 20) {
    addExpense(offset, 'Cab rides', 'Transport', rupees(300 + Math.round(random() * 500)), [priya, arjun][Math.floor(random() * 2)]!);
  }
  addExpense(-33, 'Pharmacy — first aid restock', 'Health', rupees(780), priya);
  addExpense(-3, 'Bananas', 'Groceries', rupees(60), arjun, { source: 'shopping', sourceId: shoppingItems.find((item) => item.name === 'Bananas')!.id });

  const settlements: Settlement[] = [
    { id: newId(), ...meta(-20), fromUserId: arjun, toUserId: ownerId, amountMinor: rupees(1200), date: day(-20), note: 'UPI transfer' },
  ];

  const budget: Budget = {
    id: householdId,
    householdId,
    overallMinor: rupees(75000),
    warningPercent: 80,
    categories: [
      { category: 'Groceries', limitMinor: rupees(12000) },
      { category: 'Dining out', limitMinor: rupees(4000) },
      { category: 'Utilities', limitMinor: rupees(5000) },
      { category: 'Household supplies', limitMinor: rupees(2500) },
      { category: 'Transport', limitMinor: rupees(2000) },
    ],
    createdAt: stamp(-90),
    updatedAt: stamp(-90),
  };

  /* ---------------- Maintenance ---------------- */
  const asset = (fields: Omit<Asset, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'archived'>): Asset => ({
    id: newId(),
    ...meta(-200),
    archived: false,
    ...fields,
  });
  const ac = asset({ name: 'Bedroom split AC', category: 'Air conditioner', manufacturer: 'Daikin', model: 'FTKF50', serialNumber: 'DK50-88213', purchaseDate: day(-400), purchasePriceMinor: rupees(46500), warrantyExpiry: day(330), location: 'Master bedroom' });
  const fridge = asset({ name: 'Refrigerator', category: 'Refrigerator', manufacturer: 'Samsung', model: 'RT37 345L', serialNumber: 'SM345-11902', purchaseDate: day(-710), purchasePriceMinor: rupees(38990), warrantyExpiry: day(20), location: 'Kitchen' });
  const washer = asset({ name: 'Front-load washing machine', category: 'Washing machine', manufacturer: 'LG', model: 'FHM1207', serialNumber: 'LG7-55410', purchaseDate: day(-790), purchasePriceMinor: rupees(32500), warrantyExpiry: day(-60), location: 'Laundry room' });
  const purifier = asset({ name: 'RO water purifier', category: 'Water purifier', manufacturer: 'Kent', model: 'Grand Plus', purchaseDate: day(-215), purchasePriceMinor: rupees(17500), warrantyExpiry: day(150), location: 'Kitchen' });
  const heater = asset({ name: 'Bathroom water heater', category: 'Water heater', manufacturer: 'Racold', model: 'Omnis 25L', purchaseDate: day(-1200), location: 'Main bathroom', notes: 'Warranty card not found.' });
  const sofa = asset({ name: 'Living room sofa', category: 'Furniture', manufacturer: 'Urban Ladder', purchaseDate: day(-950), purchasePriceMinor: rupees(54000), location: 'Living room' });
  const assets = [ac, fridge, washer, purifier, heater, sofa];

  const maintenanceTask = (fields: Omit<MaintenanceTask, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'status' | 'documentIds'>): MaintenanceTask => ({
    id: newId(),
    ...meta(-60),
    status: 'scheduled',
    documentIds: [],
    ...fields,
  });
  const maintenanceTasks: MaintenanceTask[] = [
    maintenanceTask({ name: 'AC wet service', assetId: ac.id, description: 'Filter wash, coil cleaning and gas pressure check.', dueDate: day(6), recurrence: { frequency: 'monthly', interval: 6 }, seriesId: newId(), priority: 'medium', assigneeId: ownerId, provider: 'CoolCare Services', estimatedCostMinor: rupees(1200) }),
    maintenanceTask({ name: 'Replace RO filters', assetId: purifier.id, dueDate: day(-3), recurrence: { frequency: 'quarterly', interval: 1 }, seriesId: newId(), priority: 'high', assigneeId: priya, provider: 'Kent service centre', estimatedCostMinor: rupees(2500) }),
    maintenanceTask({ name: 'Drum clean cycle', assetId: washer.id, dueDate: day(12), recurrence: { frequency: 'monthly', interval: 1 }, seriesId: newId(), priority: 'low', assigneeId: kavya }),
    maintenanceTask({ name: 'Descale water heater', assetId: heater.id, dueDate: day(40), recurrence: { frequency: 'yearly', interval: 1 }, seriesId: newId(), priority: 'medium', provider: 'Local plumber', estimatedCostMinor: rupees(800) }),
  ];
  const record = (fields: Omit<MaintenanceRecord, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'documentIds' | 'recordedBy'>): MaintenanceRecord => ({
    id: newId(),
    householdId,
    documentIds: [],
    recordedBy: ownerId,
    createdAt: at(fields.completedDate, 17),
    updatedAt: at(fields.completedDate, 17),
    ...fields,
  });
  const maintenanceRecords: MaintenanceRecord[] = [
    record({ assetId: ac.id, completedDate: day(-176), workPerformed: 'Wet service and filter cleaning', provider: 'CoolCare Services', actualCostMinor: rupees(1100) }),
    record({ assetId: purifier.id, completedDate: day(-95), workPerformed: 'Replaced sediment and carbon filters', provider: 'Kent service centre', actualCostMinor: rupees(2400) }),
    record({ assetId: fridge.id, completedDate: day(-200), workPerformed: 'Door gasket replaced', provider: 'Samsung care', actualCostMinor: rupees(650), notes: 'Covered parts warranty; paid labour only.' }),
    record({ assetId: washer.id, completedDate: day(-140), workPerformed: 'Drain pump cleaned', provider: 'LG service', actualCostMinor: rupees(450) }),
  ];

  /* ---------------- Calendar ---------------- */
  const event = (fields: Omit<CalendarEvent, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'createdBy'>): CalendarEvent => ({
    id: newId(),
    ...meta(-5),
    createdBy: ownerId,
    ...fields,
  });
  const events: CalendarEvent[] = [
    event({ title: 'Plumber visit', category: 'appointment', date: day(1), allDay: false, startTime: '09:00', endTime: '10:00', memberIds: [arjun], description: 'Kitchen tap — only if the DIY fix doesn’t work.', reminderMinutesBefore: 60 }),
    event({ title: 'Parent–teacher meeting', category: 'appointment', date: day(3), allDay: false, startTime: '10:30', endTime: '11:30', location: 'School auditorium', memberIds: [ownerId, priya] }),
    event({ title: 'Dinner with the neighbours', category: 'social', date: day(5), allDay: false, startTime: '19:30', memberIds: everyone }),
    event({ title: 'Grandma visiting', category: 'household', date: day(14), endDate: day(17), allDay: true, memberIds: everyone, description: 'Prepare the guest room.' }),
    event({ title: 'Society general meeting', category: 'household', date: day(10), allDay: false, startTime: '18:00', memberIds: [priya], recurrence: { frequency: 'monthly', interval: 1 } }),
  ];

  /* ---------------- Documents ---------------- */
  const textBlob = (text: string) => new Blob([text], { type: 'text/plain' });
  const warrantyText = `Samsung Refrigerator RT37 — Warranty card\nSerial: SM345-11902\nPurchased: ${fridge.purchaseDate}\nComprehensive warranty valid until: ${fridge.warrantyExpiry}\nCompressor warranty: 10 years\n\n(Sample document created for the HomeHub demo.)\n`;
  const agreementText = `Rental agreement — Maple Street Home\nTerm: 11 months\nMonthly rent: ₹28,000\nSecurity deposit: ₹84,000\n\n(Sample document created for the HomeHub demo.)\n`;
  const warrantyBlob = textBlob(warrantyText);
  const agreementBlob = textBlob(agreementText);
  const documents: HouseholdDocument[] = [
    { id: newId(), ...meta(-30), title: 'Refrigerator warranty card', category: 'Warranty', fileName: 'refrigerator-warranty.txt', mimeType: 'text/plain', size: warrantyBlob.size, expiryDate: fridge.warrantyExpiry, links: [{ type: 'asset', id: fridge.id }], archived: false, uploadedBy: ownerId },
    { id: newId(), ...meta(-60), title: 'Rental agreement', category: 'Agreement', fileName: 'rental-agreement.txt', mimeType: 'text/plain', size: agreementBlob.size, expiryDate: day(200), links: [{ type: 'bill', id: bills[0]!.id }], archived: false, uploadedBy: priya, notes: 'Renewal due before the expiry date.' },
  ];
  const blobs: DocumentBlob[] = [
    { id: documents[0]!.id, householdId, blob: warrantyBlob },
    { id: documents[1]!.id, householdId, blob: agreementBlob },
  ];

  /* ---------------- Activity ---------------- */
  const activity = (offset: number, hour: number, actorId: string, entity: ActivityLog['entity'], message: string): ActivityLog => ({
    id: newId(),
    householdId,
    actorId,
    entity,
    message,
    createdAt: stamp(offset, hour),
    updatedAt: stamp(offset, hour),
  });
  const activityLog: ActivityLog[] = [
    activity(0, 8, priya, 'shopping', 'Added “Milk” to Weekly Groceries'),
    activity(-1, 21, priya, 'task', 'Commented on “Fix the leaking kitchen tap”'),
    activity(-1, 19, ownerId, 'task', 'Completed “Vacuum the living room”'),
    activity(-2, 18, arjun, 'shopping', 'Bought “Bananas” from Weekly Groceries'),
    activity(-2, 19, kavya, 'task', 'Completed “Water the balcony plants”'),
    activity(-3, 20, arjun, 'task', 'Completed “Take out recycling”'),
    activity(-4, 10, ownerId, 'inventory', 'Updated stock of “Toilet paper”'),
    activity(-5, 19, priya, 'task', 'Completed “Clean bathrooms”'),
  ];

  const changes: ChangeSet = {
    put: {
      ...base.put,
      users,
      preferences: users.map((user) => defaultPreferences(user.id, now)),
      memberships: [...(base.put?.memberships ?? []), ...memberships],
      inventoryItems,
      inventoryMovements: movements,
      shoppingLists: [weekly, monthly, pharmacy],
      shoppingItems,
      tasks,
      bills,
      billOccurrences,
      expenses,
      settlements,
      budgets: [budget],
      assets,
      maintenanceTasks,
      maintenanceRecords,
      events,
      documents,
      activity: activityLog,
    },
  };
  return { householdId, changes, blobs };
}

/**
 * Creates the sample household for the active profile and opens it. Demo members are created
 * as additional local profiles so roles and assignments can be explored.
 */
export function createDemoHousehold() {
  return async (dispatch: AppDispatch, getState: () => RootState): Promise<string> => {
    const userId = getState().session.activeUserId;
    if (!userId) throw new Error('Choose a profile first.');
    const { householdId, changes, blobs } = buildDemoHousehold(userId);
    await writeChanges(changes, { blobs: { put: blobs } });
    dispatch(changesApplied({ put: { users: changes.put?.users, preferences: changes.put?.preferences, households: changes.put?.households, memberships: changes.put?.memberships } }));
    broadcastChange({ kind: 'global' });
    await dispatch(switchHousehold(householdId));
    return householdId;
  };
}

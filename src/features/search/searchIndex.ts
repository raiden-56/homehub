import type { Tables } from '@/store/dataSlice';
import { paths } from '@/app/paths';
import { formatDate } from '@/lib/dates';

export type SearchGroup =
  | 'Inventory'
  | 'Shopping'
  | 'Tasks'
  | 'Bills'
  | 'Expenses'
  | 'Assets'
  | 'Maintenance'
  | 'Documents'
  | 'Calendar';

export interface SearchResult {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  to: string;
  score: number;
}

export const SEARCH_GROUP_ORDER: SearchGroup[] = [
  'Inventory',
  'Shopping',
  'Tasks',
  'Bills',
  'Expenses',
  'Assets',
  'Maintenance',
  'Documents',
  'Calendar',
];

function normalise(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** 3 = title starts with query, 2 = a word in the title starts with it, 1 = matched elsewhere. */
function score(query: string, title: string, ...other: (string | undefined)[]): number {
  const t = normalise(title);
  if (t.startsWith(query)) return 3;
  if (t.split(/[\s\-–—/,.()]+/).some((word) => word.startsWith(query))) return 2;
  if (t.includes(query)) return 1.5;
  return other.some((value) => value && normalise(value).includes(query)) ? 1 : 0;
}

/**
 * Searches the active household's records in the store (which never contains other households'
 * data). Each result links to the specific record.
 */
export function searchHousehold(data: Tables, rawQuery: string, today: string, perGroup = 5): SearchResult[] {
  const query = normalise(rawQuery.trim());
  if (query.length < 2) return [];
  const results: SearchResult[] = [];
  const push = (result: Omit<SearchResult, 'score'>, value: number) => {
    if (value > 0) results.push({ ...result, score: value });
  };

  const categories = data.inventoryCategories;
  const locations = data.inventoryLocations;
  for (const item of Object.values(data.inventoryItems)) {
    const category = categories[item.categoryId]?.name;
    const location = locations[item.locationId]?.name;
    push(
      {
        id: item.id,
        group: 'Inventory',
        title: item.name,
        subtitle: [`${item.quantity} ${item.unit}`, location, item.archived ? 'Archived' : undefined].filter(Boolean).join(' · '),
        to: paths.inventoryItem(item.id),
      },
      score(query, item.name, item.barcode, item.notes, category, location),
    );
  }

  for (const list of Object.values(data.shoppingLists)) {
    push(
      { id: list.id, group: 'Shopping', title: list.name, subtitle: list.archived ? 'Archived list' : 'Shopping list', to: paths.shoppingList(list.id) },
      score(query, list.name),
    );
  }
  for (const item of Object.values(data.shoppingItems)) {
    const list = data.shoppingLists[item.listId];
    if (!list) continue;
    push(
      {
        id: item.id,
        group: 'Shopping',
        title: item.name,
        subtitle: `${item.purchased ? 'Bought' : 'To buy'} · ${list.name}`,
        to: paths.shoppingList(list.id),
      },
      score(query, item.name, item.notes),
    );
  }

  for (const task of Object.values(data.tasks)) {
    const assignee = task.assigneeId ? data.users[task.assigneeId]?.name : undefined;
    push(
      {
        id: task.id,
        group: 'Tasks',
        title: task.title,
        subtitle: [task.status === 'completed' ? 'Completed' : task.dueDate ? `Due ${formatDate(task.dueDate, 'd MMM')}` : 'No due date', assignee].filter(Boolean).join(' · '),
        to: paths.task(task.id),
      },
      score(query, task.title, task.description, task.category, task.notes, assignee),
    );
  }

  const occurrencesByBill = new Map<string, { id: string; dueDate: string; state: string }[]>();
  for (const occurrence of Object.values(data.billOccurrences)) {
    const list = occurrencesByBill.get(occurrence.billId) ?? [];
    list.push(occurrence);
    occurrencesByBill.set(occurrence.billId, list);
  }
  for (const bill of Object.values(data.bills)) {
    const occurrences = (occurrencesByBill.get(bill.id) ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    // Open the next unpaid occurrence, or the most recent one.
    const target =
      occurrences.find((occurrence) => occurrence.state === 'open' && occurrence.dueDate >= today) ??
      occurrences.find((occurrence) => occurrence.state === 'open') ??
      occurrences[occurrences.length - 1];
    push(
      {
        id: bill.id,
        group: 'Bills',
        title: bill.name,
        subtitle: target ? `${bill.category} · due ${formatDate(target.dueDate, 'd MMM')}` : bill.category,
        to: target ? paths.billOccurrence(target.id) : paths.bills(),
      },
      score(query, bill.name, bill.category, bill.notes),
    );
  }

  for (const expense of Object.values(data.expenses)) {
    push(
      {
        id: expense.id,
        group: 'Expenses',
        title: expense.description,
        subtitle: `${expense.category} · ${formatDate(expense.date, 'd MMM yyyy')}`,
        to: paths.expense(expense.id),
      },
      score(query, expense.description, expense.category, expense.notes),
    );
  }

  for (const asset of Object.values(data.assets)) {
    push(
      {
        id: asset.id,
        group: 'Assets',
        title: asset.name,
        subtitle: [asset.manufacturer, asset.model, asset.location].filter(Boolean).join(' · ') || asset.category,
        to: paths.asset(asset.id),
      },
      score(query, asset.name, asset.manufacturer, asset.model, asset.serialNumber, asset.category, asset.location),
    );
  }

  for (const task of Object.values(data.maintenanceTasks)) {
    const asset = task.assetId ? data.assets[task.assetId]?.name : undefined;
    push(
      {
        id: task.id,
        group: 'Maintenance',
        title: task.name,
        subtitle: [asset, task.status === 'completed' ? 'Completed' : `Due ${formatDate(task.dueDate, 'd MMM')}`].filter(Boolean).join(' · '),
        to: paths.maintenanceTask(task.id),
      },
      score(query, task.name, task.provider, task.description, asset),
    );
  }
  for (const record of Object.values(data.maintenanceRecords)) {
    const asset = record.assetId ? data.assets[record.assetId] : undefined;
    push(
      {
        id: record.id,
        group: 'Maintenance',
        title: record.workPerformed,
        subtitle: [asset?.name, `Done ${formatDate(record.completedDate, 'd MMM yyyy')}`].filter(Boolean).join(' · '),
        to: asset ? paths.asset(asset.id) : paths.maintenance(),
      },
      score(query, record.workPerformed, record.provider, record.notes),
    );
  }

  for (const document of Object.values(data.documents)) {
    push(
      {
        id: document.id,
        group: 'Documents',
        title: document.title,
        subtitle: `${document.category} · ${document.fileName}`,
        to: paths.document(document.id),
      },
      score(query, document.title, document.fileName, document.category, document.notes),
    );
  }

  for (const event of Object.values(data.events)) {
    push(
      {
        id: event.id,
        group: 'Calendar',
        title: event.title,
        subtitle: [formatDate(event.date, 'EEE d MMM'), event.location].filter(Boolean).join(' · '),
        to: paths.calendarEvent(event.id),
      },
      score(query, event.title, event.description, event.location),
    );
  }

  const grouped = new Map<SearchGroup, SearchResult[]>();
  for (const result of results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))) {
    const list = grouped.get(result.group) ?? [];
    if (list.length < perGroup) list.push(result);
    grouped.set(result.group, list);
  }
  return SEARCH_GROUP_ORDER.flatMap((group) => grouped.get(group) ?? []);
}

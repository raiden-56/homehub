/**
 * Route builders. Every link to a record goes through these so search results, notifications,
 * dashboard cards and calendar entries open the right record with the right filters.
 */
type Query = Record<string, string | number | boolean | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== false) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const paths = {
  overview: () => '/',

  inventory: (query?: { stock?: 'low' | 'out'; expiry?: 'soon' | 'expired'; location?: string; category?: string; q?: string; archived?: boolean }) =>
    withQuery('/inventory', query),
  inventoryItem: (itemId: string) => `/inventory/item/${itemId}`,

  shopping: () => '/shopping',
  shoppingList: (listId: string, query?: { add?: boolean }) => withQuery(`/shopping/${listId}`, query),
  shoppingHistory: () => '/shopping/history',

  tasks: (query?: { view?: 'list' | 'board' | 'calendar'; status?: 'open' | 'overdue' | 'completed'; due?: 'today' | 'week'; assignee?: string; q?: string }) =>
    withQuery('/tasks', query),
  task: (taskId: string) => `/tasks/${taskId}`,

  finance: () => '/finance',
  bills: (query?: { status?: 'upcoming' | 'due-soon' | 'overdue' | 'paid' | 'cancelled' }) => withQuery('/finance/bills', query),
  billOccurrence: (occurrenceId: string) => `/finance/bills/${occurrenceId}`,
  expenses: (query?: { category?: string; month?: string; q?: string }) => withQuery('/finance/expenses', query),
  expense: (expenseId: string) => `/finance/expenses/${expenseId}`,
  budget: () => '/finance/budget',
  balances: () => '/finance/balances',
  reports: (query?: { range?: string }) => withQuery('/finance/reports', query),

  maintenance: (query?: { due?: 'upcoming' | 'overdue' }) => withQuery('/maintenance', query),
  maintenanceTask: (taskId: string) => `/maintenance/tasks/${taskId}`,
  assets: (query?: { warranty?: 'active' | 'expiring' | 'expired' }) => withQuery('/maintenance/assets', query),
  asset: (assetId: string) => `/maintenance/assets/${assetId}`,

  calendar: (query?: { view?: 'month' | 'week' | 'agenda'; date?: string }) => withQuery('/calendar', query),
  calendarEvent: (eventId: string) => `/calendar/event/${eventId}`,

  documents: (query?: { category?: string; q?: string }) => withQuery('/documents', query),
  document: (documentId: string) => `/documents/${documentId}`,

  members: () => '/members',
  settings: (section?: 'profile' | 'household' | 'appearance' | 'notifications' | 'data') =>
    section ? `/settings/${section}` : '/settings',

  welcome: () => '/welcome',
  onboarding: () => '/onboarding',
  invite: (token: string) => `/invite/${token}`,
};

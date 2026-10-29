# HomeHub

**Everything your home needs, organized in one place.**

HomeHub is a household management app for individuals, couples, families and roommates. Inventory,
shopping, chores, bills, expenses, maintenance, documents and calendar share one data model, so a
purchase can restock the pantry and record the expense, a paid bill becomes an expense, and every
deadline shows up on one calendar.

> **Local mode.** This version runs entirely in the browser. Data is stored in IndexedDB and survives
> reloads, but it is **not synchronised between devices** and **profiles have no passwords**. The app
> says this in the sidebar, on the welcome screen and in Settings. See [Limitations](#limitations).

## Quick start

Requirements: Node.js 20.19+ (tested with Node 24) and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

On first launch, create a profile. Then either **set up your own household** or choose **Explore
with sample data**, which creates "Maple Street Home" with realistic, internally consistent demo
records. The demo household is labelled as such and can be deleted in Settings → Household.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (strict) and production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript project references build, no emit |
| `npm test` | Unit and component tests (Vitest + Testing Library, fake IndexedDB) |
| `npm run test:e2e` | Playwright end-to-end tests against the production build (desktop + Pixel 7) |

Before the first e2e run, install the browser: `npx playwright install chromium`.

### Environment variables

None are required in local mode. There are no secrets, API keys or remote endpoints. A future backend
would need `DATABASE_URL` and a session secret (see `docs/backend-schema.prisma`).

## Features

- **Overview dashboard.** Answers "What needs my attention today?". It shows six summary cards, each
  linking to the right module with filters applied, and widgets for today's tasks, shopping, bills due,
  inventory alerts, maintenance, a spending chart (3/6/12 months), deterministic insights and recent
  activity. You can reorder widgets by drag-and-drop (keyboard accessible, with move buttons as an
  alternative), hide them, switch them between half and full width on desktop, and reset the layout.
  The layout is saved per user and household.
- **Inventory.** Categories and locations (built-in and custom), search, URL-synced filters, sorting,
  grid/list views, pagination, bulk actions and CSV export. Every quantity change is recorded as a
  movement in the item's history. Low-stock and expiry alerts use your own warning window. A run-out
  estimate appears once there is enough usage history, and is explicitly labelled as a suggestion.
- **Shopping.** Multiple lists; quick add that parses entries like "2 kg rice" and suggests items;
  add several at once; drag-to-reorder; group by category; purchase history. **Record purchase**
  updates inventory and records the expense in one atomic, idempotent write. A confirmation summary
  shows exactly what will change first.
- **Chores and tasks.** List, Kanban (drag-and-drop, or a "Move to…" menu) and calendar views. Tasks
  have checklists, comments and recurrence. Completing a recurring task creates exactly one next
  occurrence. The fair-workload view uses neutral wording.
- **Bills and expenses.** Recurring bills generate occurrences idempotently. Statuses (upcoming, due
  soon, overdue, paid, cancelled) are derived, not stored. You can edit one occurrence or the whole
  series. Marking a bill paid optionally records an expense. Expenses can be split equally, by
  percentage or by exact amounts. Balances come with a transfer-minimising settlement suggestion.
  Budgets have warning thresholds. Reports use accessible charts with data tables.
- **Maintenance.** Assets, warranty status, scheduled and recurring service, and a completion log
  that can record an expense. Each asset has a timeline and its lifetime maintenance spending, taken
  from recorded costs only.
- **Calendar.** Month, week and agenda views. One aggregation layer shows events, tasks, bills and
  maintenance without duplicating any records.
- **Documents.** Private storage in IndexedDB; uploads up to 10 MB (PDF, PNG, JPEG, WebP, TXT, with
  MIME type and extension both checked). In-browser preview and download; links to assets, bills,
  expenses and maintenance; expiry tracking. There is no OCR, and the app says so.
- **Members and permissions.** Roles are Owner, Admin, Member and Viewer. Invitations use single-use
  links with 256-bit CSPRNG tokens, expire, can be revoked, and are re-validated on acceptance.
  Multiple households are supported, with a switcher.
- **Global search** (Ctrl/⌘ K). Searches the active household, groups results by type, is keyboard
  operable and opens the specific record. Quick actions appear when the search box is empty.
- **In-app notifications** for bills, overdue tasks, low stock, expiring items, maintenance, warranty
  expiry and invitations. Lead times are configurable, and read and dismissed state is persisted.
- **Settings.** Profile, household (currency, time zone, module visibility), light/dark/system
  theme, reduced motion, notification preferences, and data. The data section offers JSON and CSV
  exports, a full backup including files, and a validated restore with a preview and row-level
  errors. You can delete a household (owner, after typing its name) or delete your profile.

## Architecture

```
src/
  app/            App, router (lazy routes and guards), store, typed hooks, paths, theme provider
  components/
    layout/       AppShell, Sidebar, TopBar, MobileNav, HouseholdSwitcher, QuickAddMenu…
    ui/           PageHeader, SectionCard, StatCard, StatusChip, EmptyState, ErrorState,
                  FormDialog, DetailDrawer, Money, MemberAvatar, SearchField, Skeletons, motion
    form/         React Hook Form field wrappers (money, date, member, recurrence…)
    feedback/     Toasts (with Undo), confirm dialogs, error boundary
  data/           IndexedDB access (db.ts), the single write path (actions.ts), sync, errors
  features/<module>/
                  pages, components, hooks, pure logic (logic.ts / logic/*), __tests__
  lib/            money, dates, recurrence, permissions, validation, ids, csv/download
  store/          Redux slices (data tables, session, ui) and selectors
  theme/          design tokens and MUI theme (light and dark)
  types/models.ts the domain model
docs/backend-schema.prisma   relational schema design for the future full-stack version
e2e/              Playwright workflows
```

**Data flow.** IndexedDB is the source of truth. On login or household switch, only the active
household's records are loaded into Redux. Every change goes through `commitChanges` in
`src/data/actions.ts`, which:

1. checks the acting member's **role** for the requested action, plus extra rules for memberships
   and invitations (for example, admins can't grant admin and nobody can demote the owner);
2. checks **tenant ownership**: every record must belong to the active household. Inside the
   IndexedDB transaction, `db.ts` also refuses to overwrite or delete a record owned by another
   household, even if the ids match;
3. writes the whole change set in **one IndexedDB transaction** (atomic). An optional **idempotency
   key** guards purchases, bill payments and maintenance completions against double submits;
4. appends activity-log entries, updates the store, and notifies other open tabs through
   `BroadcastChannel`.

**Conventions.**
- Money is integer minor units, parsed from strings without floating-point arithmetic.
- Date-only values are `YYYY-MM-DD`, interpreted in the household's time zone.
- Derived states (overdue, low stock, due soon) are computed, never stored.
- Generated occurrences use deterministic ids, so regenerating them can't create duplicates.

**Design system.** The palette is forest green #355E3B (deep #24452D), sage #DCE8D5, ivory
#F7F5EF, charcoal text, amber, terracotta and red. The typeface is Plus Jakarta Sans, bundled
locally. Chart colours are a separate categorical set that was validated by script for lightness,
chroma and colour-vision-deficiency separation in both themes.

**Security headers.** Production builds inject a strict Content Security Policy (`'self'` only, no
inline scripts; `blob:` is allowed for document previews) and `referrer: no-referrer`. CSV exports
neutralise spreadsheet formulas. Backups exclude invitation tokens.

## Testing

- **Unit and component tests** (`npm test`): 30 files, 205 tests. They cover:
  - quantity, low-stock and expiry rules, and consumption estimates;
  - recurrence; bill status and occurrence generation; budgets;
  - expense splitting and settlement minimisation; currency formatting and parsing;
  - permissions, membership rules and invitations;
  - duplicate prevention and idempotency, transaction atomicity and tenant isolation;
  - notifications, dashboard summaries and insights, backup round-trips;
  - forms and validation, shopping and purchase flows, completing chores, marking bills paid,
    and empty, loading and confirmation states.
- **End-to-end tests** (`npm run test:e2e`): 11 tests. They cover:
  - creating a household and persistence after a reload;
  - inventory → shopping list → bought → recorded cost, then a check that inventory and expenses
    were updated exactly once;
  - creating a bill and paying it;
  - a recurring chore;
  - appliance maintenance;
  - uploading a document, previewing it and reloading;
  - an invitation accepted by a new profile, viewer restrictions, and single-use links;
  - blocking profiles without a membership, and rejecting invalid tokens;
  - household switching isolation;
  - keyboard search;
  - mobile navigation, plus a no-horizontal-overflow check across 11 pages at phone width.

## Limitations

- **There is no server.** Authentication, cross-device sync, server-side authorization, private
  cloud file storage, rate limiting and real push or email notifications all require the backend
  described in `docs/backend-schema.prisma`, which is a design document and is not implemented. In
  local mode, profiles are a convenience for sharing one device, not a security boundary. Permission
  checks are enforced by the app's data layer, but anyone with access to the browser profile can read
  IndexedDB.
- **Invite links** only work in the browser that created them.
- **Reminders** are in-app only. Nothing fires at a reminder time while the app is closed.
- **Recurring events and maintenance.** Edits to a recurring calendar event apply to the whole
  series. Edits to a scheduled maintenance task apply to that occurrence.
- **Inventory units.** There is no unit conversion between shopping and inventory. The receive
  dialog warns when units differ.
- **Settlements** are tracked as household-level balances, not per expense participant. The
  transfer suggestion is greedy: at most n−1 transfers, not always the absolute minimum.
- **Not implemented** (from the optional §17 list): CSV import and meal planning.
- **Secondary text colour.** The brand's secondary-text colour #777970 is just under the 4.5:1 AA
  contrast ratio for small text on ivory, so body text uses a slightly darker #6A6C63. The brand
  token is kept in `src/theme/tokens.ts`.

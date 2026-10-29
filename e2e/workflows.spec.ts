import { expect, test } from '@playwright/test';
import { createProfile, isoDate, newUserWithHousehold, quickAdd, selectOption } from './helpers';

test.describe('household workflows', () => {
  test('creates a household and keeps it after a reload', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await expect(page.getByText('Lakeview Flat').first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Asha');
    await expect(page.getByText('Lakeview Flat').first()).toBeVisible();
  });

  test('inventory → shopping list → purchase updates inventory and expenses exactly once', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');

    // 2. Add an inventory item that is below its minimum.
    await page.goto('/inventory');
    await quickAdd(page, 'Add inventory item');
    const dialog = page.getByRole('dialog', { name: 'Add inventory item' });
    await dialog.getByLabel('Name').fill('Olive oil');
    await dialog.getByLabel('Quantity').fill('1');
    await dialog.getByLabel('Minimum stock').fill('2');
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await expect(dialog).toBeHidden();

    // 3. Add it to a shopping list from its details.
    await page.getByText('Olive oil').first().click();
    await page.getByRole('button', { name: 'Add to shopping list' }).click();
    await expect(page.getByText(/Added “Olive oil” to Shopping list/)).toBeVisible();

    // Adding again is detected as a duplicate.
    await page.getByRole('button', { name: 'Add to shopping list' }).click();
    await expect(page.getByText('Already on Shopping list')).toBeVisible();

    // 4. Mark it bought.
    await page.goto('/shopping');
    await page.getByText('Shopping list', { exact: true }).first().click();
    await page.getByRole('checkbox', { name: 'Mark Olive oil as bought' }).click();

    // 5. Record its cost, updating inventory and expenses.
    await page.getByRole('button', { name: 'Record 1 purchase' }).click();
    const receive = page.getByRole('dialog');
    await receive.getByLabel('Price paid (total)').fill('450');
    await receive.getByLabel('Quantity received').fill('2');
    await receive.getByRole('button', { name: 'Confirm & record' }).click();
    await page.getByRole('button', { name: /Bought/ }).click();
    await expect(page.getByText('Recorded').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Record (1 )?purchase/ })).toHaveCount(0);

    // 6. Inventory shows 1 + 2 = 3 and one ₹450 expense exists.
    await page.goto('/inventory');
    await page.getByText('Olive oil').first().click();
    await expect(page.getByRole('dialog').getByText('3 pcs').first()).toBeVisible();
    await page.goto('/finance/expenses');
    await expect(page.getByText('Olive oil')).toHaveCount(1);
    await expect(page.getByText('₹450.00').first()).toBeVisible();
  });

  test('creates a bill and marks it paid', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await page.goto('/finance/bills');
    await quickAdd(page, 'Add bill');
    const dialog = page.getByRole('dialog', { name: 'Add bill' });
    await dialog.getByLabel('Bill name').fill('Gym membership');
    await dialog.getByLabel('Expected amount').fill('1499');
    await dialog.getByLabel(/due date/i).fill(isoDate(2));
    await dialog.getByRole('button', { name: 'Add bill' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Mark paid' }).first().click();
    const pay = page.getByRole('dialog', { name: /Mark “Gym membership” as paid/ });
    await pay.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(pay).toBeHidden();
    await expect(page.getByText('Paid').first()).toBeVisible();

    await page.goto('/finance/expenses');
    await expect(page.getByText('Gym membership')).toBeVisible();
    await expect(page.getByText('₹1,499.00').first()).toBeVisible();
  });

  test('completing a recurring chore schedules the next occurrence once', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await page.goto('/tasks');
    await quickAdd(page, 'Create task');
    const dialog = page.getByRole('dialog', { name: 'New task' });
    await dialog.getByLabel('Title').fill('Water the plants');
    await dialog.getByLabel('Due date').fill(isoDate(0));
    await selectOption(page, 'Repeat', 'Daily');
    await dialog.getByRole('button', { name: 'Create task' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Mark “Water the plants” complete' }).first().click();
    // The next day's occurrence is now open.
    await expect(page.getByRole('button', { name: 'Mark “Water the plants” complete' })).toHaveCount(1);
    await expect(page.getByText('Tomorrow').first()).toBeVisible();
    await page.goto('/tasks?status=completed');
    await expect(page.getByText('Water the plants')).toHaveCount(1);
  });

  test('schedules appliance maintenance', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await page.goto('/maintenance');
    await quickAdd(page, 'Schedule maintenance');
    const dialog = page.getByRole('dialog', { name: 'Schedule maintenance' });
    await dialog.getByLabel('Task name').fill('AC servicing');
    await dialog.getByLabel('Due date').fill(isoDate(5));
    await dialog.getByLabel('Service provider').fill('CoolCare');
    await dialog.getByRole('button', { name: 'Schedule' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('AC servicing').first()).toBeVisible();
    await page.goto('/calendar?view=agenda');
    await expect(page.getByText('AC servicing').first()).toBeVisible();
  });

  test('uploads and previews a document', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await page.goto('/documents');
    await page.getByRole('button', { name: /Upload/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Upload document' });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'washer-manual.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Use the drum clean cycle monthly.'),
    });
    await dialog.getByLabel('Title').fill('Washer manual');
    await dialog.getByRole('button', { name: 'Upload' }).click();
    await expect(dialog).toBeHidden();
    await page.getByText('Washer manual').first().click();
    await expect(page.getByText('Use the drum clean cycle monthly.')).toBeVisible();

    // Persists across reloads, including the file.
    await page.reload();
    await expect(page.getByText('Use the drum clean cycle monthly.')).toBeVisible();
  });

  test('invites a member who joins with a new profile; viewers cannot edit', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Lakeview Flat');
    await page.goto('/members');
    await page.getByRole('button', { name: 'Invite', exact: true }).click();
    await selectOption(page, 'Role', 'Viewer');
    await page.getByRole('button', { name: 'Create invite link' }).click();
    const link = await page.getByRole('textbox', { name: 'Invite link' }).inputValue();
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
    await page.getByRole('button', { name: 'Done' }).click();

    // A second person opens the link on this device and creates their profile.
    await page.getByRole('button', { name: /Account menu/ }).first().click();
    await page.getByRole('menuitem', { name: /Switch profile/ }).click();
    await page.goto(new URL(link).pathname);
    await expect(page).toHaveURL(/\/welcome\?next=/);
    await page.getByRole('button', { name: 'Create a new profile' }).click();
    await page.getByLabel('Your name').fill('Ravi Kumar');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Join Lakeview Flat' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(page.getByText('Lakeview Flat').first()).toBeVisible();

    // Viewers cannot add records.
    await page.goto('/inventory');
    await expect(page.getByRole('button', { name: 'Add new' }).first()).toBeDisabled();

    // The link is single-use.
    await page.goto(new URL(link).pathname);
    await expect(page.getByText(/already a member|already used/)).toBeVisible();
  });

  test('profiles without a membership cannot reach household data; bad tokens are rejected', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'Private Home');
    await page.goto('/inventory');
    await quickAdd(page, 'Add inventory item');
    const dialog = page.getByRole('dialog', { name: 'Add inventory item' });
    await dialog.getByLabel('Name').fill('Secret saffron');
    await dialog.getByLabel('Quantity').fill('1');
    await dialog.getByRole('button', { name: 'Add item' }).click();

    await page.getByRole('button', { name: /Account menu/ }).first().click();
    await page.getByRole('menuitem', { name: /Switch profile/ }).click();
    await createProfile(page, 'Mallory');
    await expect(page).toHaveURL(/\/onboarding/);
    // Deep links into household pages redirect to setup — no household is open.
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText('Secret saffron')).toHaveCount(0);

    await page.goto(`/invite/${'A'.repeat(43)}`);
    await expect(page.getByText('This invitation isn’t valid')).toBeVisible();
  });

  test('switching households keeps their data isolated', async ({ page }) => {
    await newUserWithHousehold(page, 'Asha Rao', 'City Flat');
    await page.goto('/inventory');
    await quickAdd(page, 'Add inventory item');
    let dialog = page.getByRole('dialog', { name: 'Add inventory item' });
    await dialog.getByLabel('Name').fill('Alpha rice');
    await dialog.getByLabel('Quantity').fill('2');
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByText('Alpha rice').first()).toBeVisible();

    // Create a second household from the switcher.
    await page.getByRole('button', { name: /Household: City Flat/ }).click();
    await page.getByRole('menuitem', { name: 'Create a household' }).click();
    await page.getByRole('button', { name: 'Set up my household' }).click();
    await page.getByLabel('Household name').fill('Beach House');
    await page.getByRole('button', { name: 'Create household' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'Go to my dashboard' }).click();

    await page.goto('/inventory');
    await expect(page.getByText('No inventory items yet.')).toBeVisible();
    await expect(page.getByText('Alpha rice')).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await page.getByRole('combobox', { name: 'Search household' }).fill('Alpha');
    await expect(page.getByText(/No results for/)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Household: Beach House/ }).click();
    await page.getByRole('menuitem', { name: /City Flat/ }).click();
    await page.goto('/inventory');
    await expect(page.getByText('Alpha rice').first()).toBeVisible();
  });

  test('global search is keyboard operable and opens the record', async ({ page }) => {
    await createProfile(page, 'Asha Rao');
    await page.getByRole('button', { name: 'Explore with sample data' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Asha');
    await page.getByRole('button', { name: 'Search household' }).waitFor();
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: 'Search household' });
    await input.fill('refrig');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/(inventory\/item|maintenance\/assets|documents|tasks)\/[^/]+$/);
  });
});

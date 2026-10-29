import { expect, type Page } from '@playwright/test';

/** Today's date as YYYY-MM-DD in Asia/Kolkata (the time zone used by test households). */
export function isoDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Creates a local profile on the welcome screen. */
export async function createProfile(page: Page, name: string) {
  await page.goto('/welcome');
  const heading = page.getByRole('heading', { name: /Who’s using HomeHub|Create your profile/ });
  await heading.waitFor();
  if ((await heading.textContent())?.startsWith('Who')) await page.getByRole('button', { name: 'Create a new profile' }).click();
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Runs onboarding: creates a household and skips the optional steps. */
export async function createHousehold(page: Page, householdName: string) {
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Set up my household' }).click();
  await page.getByLabel('Household name').fill(householdName);
  await page.getByRole('combobox', { name: 'Time zone' }).click();
  await page.getByRole('option', { name: 'Asia/Kolkata' }).click();
  await page.getByRole('button', { name: 'Create household' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // modules
  await page.getByRole('button', { name: 'Skip for now' }).click(); // members
  await page.getByRole('button', { name: 'Skip' }).click(); // starter items
  await page.getByRole('button', { name: 'Go to my dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
}

export async function newUserWithHousehold(page: Page, userName: string, householdName: string) {
  await createProfile(page, userName);
  await createHousehold(page, householdName);
}

/** Opens the header's "Add new" menu (on pages other than the overview) and picks an action. */
export async function quickAdd(page: Page, action: string) {
  const addNew = page.getByRole('button', { name: 'Add new' }).first();
  await addNew.click();
  await page.getByRole('menuitem', { name: action }).click();
}

export async function selectOption(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

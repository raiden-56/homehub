import type { DocumentLink, HouseholdDocument, ISODate } from '@/types/models';
import type { Tables } from '@/store/dataSlice';
import { paths } from '@/app/paths';
import { daysBetween, formatDate } from '@/lib/dates';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;
/** Text previews show at most this many bytes. */
export const TEXT_PREVIEW_BYTES = 200 * 1024;

/** Allowed MIME types and the file extensions that may carry them. */
export const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/webp': ['webp'],
  'text/plain': ['txt'],
};

export const ACCEPT_ATTRIBUTE = [
  ...Object.keys(ALLOWED_DOCUMENT_TYPES),
  ...Object.values(ALLOWED_DOCUMENT_TYPES)
    .flat()
    .map((extension) => `.${extension}`),
].join(',');

export const SUPPORTED_TYPES_LABEL = 'PDF, PNG, JPEG, WebP or plain-text (.txt)';

export type FileValidation = { ok: true; mimeType: string } | { ok: false; error: string };

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
}

/**
 * Checks size, extension and MIME type. Both must agree with the allow-list; files with no MIME
 * type (some systems omit it for .txt) are accepted only when the extension is allowed.
 */
export function validateDocumentFile(file: Pick<File, 'name' | 'size' | 'type'>): FileValidation {
  if (file.size === 0) return { ok: false, error: `“${file.name}” is empty.` };
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: `“${file.name}” is ${formatFileSize(file.size)}. Files must be 10 MB or smaller.` };
  }
  const extension = extensionOf(file.name);
  const extensionType = Object.entries(ALLOWED_DOCUMENT_TYPES).find(([, extensions]) => extensions.includes(extension))?.[0];
  if (!extensionType) {
    return { ok: false, error: `“${file.name}” isn’t a supported file. Upload a ${SUPPORTED_TYPES_LABEL} file.` };
  }
  const type = file.type.toLowerCase();
  if (!type) return { ok: true, mimeType: extensionType };
  const allowedExtensions = ALLOWED_DOCUMENT_TYPES[type];
  if (!allowedExtensions) {
    return { ok: false, error: `“${file.name}” has an unsupported file type (${type}). Upload a ${SUPPORTED_TYPES_LABEL} file.` };
  }
  if (!allowedExtensions.includes(extension)) {
    return { ok: false, error: `“${file.name}” has a .${extension} extension but its content type is ${type}. Rename or re-export the file.` };
  }
  return { ok: true, mimeType: type };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Untitled document';
}

export type DocumentKind = 'pdf' | 'image' | 'text' | 'other';

export function documentKind(mimeType: string): DocumentKind {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'text/plain') return 'text';
  return 'other';
}

export type DocumentExpiryStatus = 'expired' | 'expiring' | 'valid' | 'none';

export function documentExpiryStatus(
  document: Pick<HouseholdDocument, 'expiryDate'>,
  today: ISODate,
  warningDays = DOCUMENT_EXPIRY_WARNING_DAYS,
): DocumentExpiryStatus {
  if (!document.expiryDate) return 'none';
  const days = daysBetween(today, document.expiryDate);
  if (days < 0) return 'expired';
  if (days <= warningDays) return 'expiring';
  return 'valid';
}

export function documentExpiryLabel(document: Pick<HouseholdDocument, 'expiryDate'>, today: ISODate): string | null {
  const status = documentExpiryStatus(document, today);
  if (status === 'none') return null;
  const date = formatDate(document.expiryDate!, 'd MMM yyyy');
  if (status === 'expired') return `Expired ${date}`;
  if (status === 'expiring') return `Expiring soon · ${date}`;
  return `Valid until ${date}`;
}

export function sameLink(a: DocumentLink, b: DocumentLink): boolean {
  return a.type === b.type && a.id === b.id;
}

export function hasLink(document: Pick<HouseholdDocument, 'links'>, link: DocumentLink): boolean {
  return document.links.some((entry) => sameLink(entry, link));
}

export const LINK_TYPE_LABELS: Record<DocumentLink['type'], string> = {
  asset: 'Asset',
  bill: 'Bill',
  expense: 'Expense',
  maintenance: 'Maintenance',
};

export interface LinkTarget extends DocumentLink {
  label: string;
  secondary?: string;
  to: string;
}

/** Resolves a link to a display label and a route, or `null` if the record no longer exists. */
export function resolveLink(link: DocumentLink, data: Tables, today: ISODate): LinkTarget | null {
  switch (link.type) {
    case 'asset': {
      const asset = data.assets[link.id];
      return asset ? { ...link, label: asset.name, secondary: asset.category, to: paths.asset(asset.id) } : null;
    }
    case 'bill': {
      const bill = data.bills[link.id];
      if (!bill) return null;
      const occurrences = Object.values(data.billOccurrences)
        .filter((occurrence) => occurrence.billId === bill.id)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const target =
        occurrences.find((occurrence) => occurrence.state === 'open' && occurrence.dueDate >= today) ??
        occurrences[occurrences.length - 1];
      return { ...link, label: bill.name, secondary: bill.category, to: target ? paths.billOccurrence(target.id) : paths.bills() };
    }
    case 'expense': {
      const expense = data.expenses[link.id];
      return expense
        ? { ...link, label: expense.description, secondary: formatDate(expense.date, 'd MMM yyyy'), to: paths.expense(expense.id) }
        : null;
    }
    case 'maintenance': {
      const task = data.maintenanceTasks[link.id];
      return task
        ? { ...link, label: task.name, secondary: `Due ${formatDate(task.dueDate, 'd MMM yyyy')}`, to: paths.maintenanceTask(task.id) }
        : null;
    }
  }
}

/** Every record a document can be linked to, for pickers. Expenses are limited to the most recent 300. */
export function linkTargets(data: Tables, today: ISODate): LinkTarget[] {
  const assets = Object.values(data.assets)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((asset) => resolveLink({ type: 'asset', id: asset.id }, data, today));
  const bills = Object.values(data.bills)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bill) => resolveLink({ type: 'bill', id: bill.id }, data, today));
  const expenses = Object.values(data.expenses)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 300)
    .map((expense) => resolveLink({ type: 'expense', id: expense.id }, data, today));
  const tasks = Object.values(data.maintenanceTasks)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .map((task) => resolveLink({ type: 'maintenance', id: task.id }, data, today));
  return [...assets, ...bills, ...expenses, ...tasks].filter((target): target is LinkTarget => target !== null);
}

/** Text searched by the document list: metadata plus the names of linked records. */
export function documentSearchText(document: HouseholdDocument, data: Tables, today: ISODate): string {
  const linked = document.links.map((link) => resolveLink(link, data, today)?.label ?? '');
  return [document.title, document.fileName, document.category, document.notes ?? '', ...linked].join(' ').toLocaleLowerCase();
}

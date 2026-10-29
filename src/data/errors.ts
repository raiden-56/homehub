/** Errors raised by the data layer carry a message that is safe to show to users. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The same operation (identified by its idempotency key) was already applied. */
export class DuplicateOperationError extends AppError {}

/** The acting member's role does not allow the attempted change. */
export class PermissionError extends AppError {}

/** A write referenced a household other than the active one. */
export class TenantIsolationError extends AppError {}

/** Input failed a business-rule check that form validation could not catch. */
export class BusinessRuleError extends AppError {}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return 'Something went wrong while saving. Your previous data is unchanged — please try again.';
}

import { isValidObjectId } from '../common/object-id';

export const FORM_ACCESS_PATH_PARAM_KEYS = ['id', 'formId'] as const;

/**
 * Resolve the owning user id from a form's `createdBy`, whether it is still an
 * ObjectId or has been populated to `{ _id, email, ... }`.
 */
export function getFormOwnerId(createdBy: unknown): string {
  if (createdBy && typeof createdBy === 'object' && '_id' in createdBy) {
    const populatedId = (createdBy as { _id?: unknown })._id;
    if (populatedId !== undefined && populatedId !== null) {
      return String(populatedId);
    }
  }
  return String(createdBy);
}

export function isValidFormId(formId: string): boolean {
  return isValidObjectId(formId);
}

export function extractFormIdFromRequest(request: {
  params?: Record<string, string | undefined>;
  query?: Record<string, unknown>;
}): string | undefined {
  const params = request.params ?? {};
  for (const key of FORM_ACCESS_PATH_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  const queryFormId = request.query?.formId;
  if (typeof queryFormId === 'string' && queryFormId.length > 0) {
    return queryFormId;
  }

  return undefined;
}

const OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

/**
 * Strict 24-character hex check. Mongoose's `ObjectId.isValid` also accepts
 * 12-character strings, which then throw CastError when queried as `_id`.
 */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_HEX.test(value);
}

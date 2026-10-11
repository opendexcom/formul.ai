/**
 * Product/admin logs identify people by userId only.
 * Emails stay in security/auth logs (login, password reset, verification, lockout).
 */
export function actorUserId(
  user: { _id?: unknown; id?: unknown } | null | undefined,
): string {
  const id = user?._id ?? user?.id;
  if (id === undefined || id === null || String(id).length === 0) {
    return 'unknown';
  }
  return String(id);
}

export function logFormRequest(
  event: string,
  user: { _id?: unknown; id?: unknown; email?: unknown },
  extra: Record<string, unknown> = {},
): void {
  console.log(event, {
    userId: actorUserId(user),
    ...extra,
  });
}

export function serializeLogArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

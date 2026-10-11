interface QuotaErrorBody {
  type?: 'tokens' | 'forms';
  message?: string;
}

export async function parseQuotaErrorFromResponse(
  response: Response,
): Promise<string | null> {
  if (response.status !== 429) return null;
  try {
    const body = (await response.json()) as QuotaErrorBody;
    if (body.type === 'tokens') {
      return (
        body.message ||
        'Monthly token quota exceeded. Upgrade your plan to continue using AI features.'
      );
    }
    if (body.type === 'forms') {
      return (
        body.message ||
        'Form limit exceeded for your plan. Upgrade to create more forms.'
      );
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function parseQuotaErrorFromAxios(error: unknown): string | null {
  const axiosError = error as {
    response?: { status?: number; data?: QuotaErrorBody };
  };
  if (axiosError.response?.status !== 429) return null;
  const body = axiosError.response.data;
  if (body?.type === 'tokens') {
    return (
      body.message ||
      'Monthly token quota exceeded. Upgrade your plan to continue using AI features.'
    );
  }
  if (body?.type === 'forms') {
    return (
      body.message ||
      'Form limit exceeded for your plan. Upgrade to create more forms.'
    );
  }
  return null;
}

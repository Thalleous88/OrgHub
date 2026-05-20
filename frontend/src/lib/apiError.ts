export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface DRFErrorPayload {
  detail?: string;
  non_field_errors?: string[];
  [key: string]: unknown;
}

export async function buildApiError(response: Response, fallback: string): Promise<ApiError> {
  let payload: DRFErrorPayload | null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const fieldErrors: Record<string, string[]> = {};
  let primary = fallback;

  if (payload && typeof payload === 'object') {
    if (typeof payload.detail === 'string') {
      primary = payload.detail;
    } else if (Array.isArray(payload.non_field_errors) && payload.non_field_errors.length) {
      primary = payload.non_field_errors[0];
    } else {
      for (const [key, value] of Object.entries(payload)) {
        if (Array.isArray(value)) {
          fieldErrors[key] = value.filter((v): v is string => typeof v === 'string');
          if (primary === fallback && fieldErrors[key]?.[0]) {
            primary = fieldErrors[key][0];
          }
        } else if (typeof value === 'string' && primary === fallback) {
          primary = value;
        }
      }
    }
  }

  return new ApiError(response.status, primary, fieldErrors);
}

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Unable to reach the server. Make sure the backend is running.';
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

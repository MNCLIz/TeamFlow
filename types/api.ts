export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function errorResponse(message: string, status = 400): { response: ApiResponse; status: number } {
  return { response: { success: false, error: message }, status };
}

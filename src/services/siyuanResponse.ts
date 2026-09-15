import type { IWebSocketData } from "siyuan";

export class SiyuanApiError extends Error {
  readonly code: number;

  constructor(message: string, code = -1) {
    super(message);
    this.name = "SiyuanApiError";
    this.code = code;
  }
}

export function assertSiyuanData<T>(
  response?: IWebSocketData,
  fallbackMessage = "SiYuan request failed",
): T {
  if (!response || response.code !== 0) {
    throw new SiyuanApiError(response?.msg || fallbackMessage, response?.code ?? -1);
  }

  if (response.data === undefined || response.data === null) {
    throw new SiyuanApiError(fallbackMessage, response.code);
  }

  return response.data as T;
}

export function assertSiyuanSuccess(
  response?: IWebSocketData,
  fallbackMessage = "SiYuan request failed",
): void {
  if (!response || response.code !== 0) {
    throw new SiyuanApiError(response?.msg || fallbackMessage, response?.code ?? -1);
  }
}

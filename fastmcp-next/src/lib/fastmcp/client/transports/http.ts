/**
 * HTTP Transport — Connect to MCP servers via HTTP/JSON-RPC.
 *
 * Sends JSON-RPC 2.0 requests over HTTP POST.
 * Mirrors Python's StreamableHttpTransport.
 */

import type { ClientTransport } from "../client";

export interface HttpTransportOptions {
  /** Base URL of the MCP server endpoint */
  url: string;
  /** Custom headers to send with each request */
  headers?: Record<string, string>;
  /** Bearer token for authentication */
  bearerToken?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

export class HttpTransport implements ClientTransport {
  readonly name = "http";
  private url: string;
  private headers: Record<string, string>;
  private timeoutMs: number;
  private connected = false;
  private requestId = 0;

  constructor(options: HttpTransportOptions | string) {
    if (typeof options === "string") {
      this.url = options;
      this.headers = {};
      this.timeoutMs = 30_000;
    } else {
      this.url = options.url;
      this.headers = { ...(options.headers ?? {}) };
      this.timeoutMs = options.timeoutMs ?? 30_000;
      if (options.bearerToken) {
        this.headers["Authorization"] = `Bearer ${options.bearerToken}`;
      }
    }
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async request(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.connected) {
      throw new Error("Transport is not connected");
    }

    this.requestId++;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: this.requestId,
          method,
          params: params ?? {},
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        result?: unknown;
        error?: { code: number; message: string; data?: unknown };
      };

      if (data.error) {
        const err = new Error(data.error.message);
        (err as Error & { code: number }).code = data.error.code;
        throw err;
      }

      return data.result;
    } finally {
      clearTimeout(timeout);
    }
  }
}

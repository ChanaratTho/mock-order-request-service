import { NextRequest } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.API_BASE_URL; // e.g., https://xxxx.execute-api.ap-southeast-1.amazonaws.com/prod
const API_PATH = process.env.API_PATH || "/order";

if (!API_BASE_URL) {
  console.warn("[/api/order] Missing API_BASE_URL env (will require URL in request body)");
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 20000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function retry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

type ProxyBody = { url?: string; payload?: unknown } | unknown;

export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json()) as ProxyBody;

    // Allow two shapes:
    // 1) { url, payload }
    // 2) raw payload + use env URL
    let targetUrl: string | undefined;
    let payload: unknown;

    if (incoming && typeof incoming === "object" && "url" in incoming) {
      const b = incoming as { url?: string; payload?: unknown };
      targetUrl = b.url;
      payload = b.payload;
    } else {
      payload = incoming;
      if (API_BASE_URL) {
        const url = new URL(API_PATH, API_BASE_URL);
        targetUrl = url.toString();
      }
    }

    if (!targetUrl) {
      return Response.json({ error: "Missing target URL: provide 'url' in body or set API_BASE_URL" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    const doCall = () =>
      fetchWithTimeout(targetUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        timeoutMs: 20000,
      }).then(async (res) => {
        const requestId = res.headers.get("x-amzn-requestid") || res.headers.get("x-amz-request-id");
        const text = await res.text();
        if (!res.ok) {
          const errShape = { status: res.status, requestId, upstream: safeJson(text) };
          throw new Error(JSON.stringify(errShape));
        }
        return new Response(text, {
          status: res.status,
          headers: {
            "content-type": res.headers.get("content-type") || "application/json",
            "x-upstream-request-id": requestId || "",
          },
        });
      });

    const response = await retry(doCall, 2);
    return response;
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string } | undefined;
    const isAbort = err?.name === "AbortError";
    let detail: unknown = err?.message || String(e);
    try {
      detail = err?.message ? JSON.parse(err.message) : detail;
    } catch {
      // keep as text
    }
    return Response.json(
      {
        error: "UPSTREAM_CALL_FAILED",
        reason: isAbort ? "timeout" : "upstream_error",
        detail,
      },
      { status: 502 }
    );
  }
}

function safeJson(txt: string) {
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

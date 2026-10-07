import { QlooClient, TastePilotError, runAgent, validateBrief } from "./qloo.ts";
export type RuntimeEnv = { QLOO_API_KEY?: string; QLOO_API_URL?: string };
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export async function handlePlan(request: Request, runtime: RuntimeEnv, fetcher: typeof fetch = fetch) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Please send requests from TastePilot.", code: "invalid_origin" }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return Response.json({ error: "Send a JSON request.", code: "invalid_body" }, { status: 415, headers });
  try {
    if (Number(request.headers.get("content-length")) > 12_000) throw new TastePilotError("invalid_body", "This request is too large.", 413);
    const raw = await request.text();
    if (raw.length > 12_000) throw new TastePilotError("invalid_body", "This request is too large.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new TastePilotError("invalid_body", "This request could not be read.", 400); }
    const brief = validateBrief(body);
    const client = new QlooClient(runtime.QLOO_API_KEY ?? "", runtime.QLOO_API_URL, fetcher);
    return Response.json(await runAgent(brief, client), { headers });
  } catch (e) {
    const error = e instanceof TastePilotError ? e : new TastePilotError("unexpected_error", "The plan could not be completed. Please try again.");
    return Response.json({ error: error.message, code: error.code }, { status: error.status, headers });
  }
}

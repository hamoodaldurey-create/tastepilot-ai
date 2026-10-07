import { env } from "cloudflare:workers";
export function GET() {
  const runtime = env as unknown as { QLOO_API_KEY?: string };
  return Response.json({ status: "ok", qlooConfigured: Boolean(runtime.QLOO_API_KEY), service: "TastePilot AI" }, { headers: { "Cache-Control": "no-store" } });
}

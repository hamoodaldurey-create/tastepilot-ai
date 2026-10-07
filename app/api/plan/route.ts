import { env } from "cloudflare:workers";
import { handlePlan, type RuntimeEnv } from "@/lib/plan-handler";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handlePlan(request, env as unknown as RuntimeEnv);
}

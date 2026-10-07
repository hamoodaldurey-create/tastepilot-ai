import test from "node:test";
import assert from "node:assert/strict";
import { QlooClient, runAgent, validateBrief, safeUrl, TastePilotError } from "../lib/qloo.ts";
import { handlePlan } from "../lib/plan-handler.ts";
const A = "00000000-0000-4000-8000-000000000001", B = "00000000-0000-4000-8000-000000000002", C = "00000000-0000-4000-8000-000000000003";
const input = { favorites: [{ name: "Interstellar", type: "movie" }], city: "Muscat", priceLevel: 3, categories: ["dining", "travel", "entertainment"], likedIds: [], excludedIds: [] };
const entity = { entity_id: A, name: "Interstellar", types: ["urn:entity:movie"] };
function mockQloo(calls: URL[], failCategory = ""): typeof fetch {
  return async (url, init) => {
    const u = new URL(String(url)); calls.push(u);
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "test-only-key");
    assert.equal(u.searchParams.has("api_key"), false);
    if (u.pathname === "/search") return Response.json({ results: [entity] });
    if (u.pathname === "/v2/tags") return Response.json({ results: { tags: [{ id: "urn:tag:category:place:restaurant", name: "Restaurant" }] } });
    if (u.searchParams.get("filter.type")?.endsWith(failCategory) && failCategory) return Response.json({ internal: "upstream diagnostic" }, { status: 500 });
    return Response.json({ results: { entities: [{ entity_id: B, name: "A real recommendation", properties: { image: { url: "https://images.qloo.com/example.jpg" }, description: "Qloo metadata" }, query: { affinity: 0.6 } }] } });
  };
}
test("agent resolves named tastes, uses cross-domain Qloo calls, and keeps dining local", async () => {
  const calls: URL[] = []; const result = await runAgent(validateBrief(input), new QlooClient("test-only-key", undefined, mockQloo(calls)));
  assert.equal(result.resolved[0].id, A); assert.equal(result.recommendations.length, 3); assert.equal(result.mode, "live");
  const queries = calls.filter(u => u.pathname === "/v2/insights"); assert.equal(queries.length, 3);
  const dining = queries.find(u => u.searchParams.get("filter.type") === "urn:entity:place")!;
  assert.equal(dining.searchParams.get("filter.location.query"), "Muscat"); assert.equal(dining.searchParams.get("filter.price_level.max"), "3"); assert.ok(dining.searchParams.get("filter.tags")?.includes("restaurant"));
  assert.equal(queries.find(u => u.searchParams.get("filter.type") === "urn:entity:movie")?.searchParams.has("filter.location.query"), false);
  assert.ok(result.steps.some(s => s.tool === "Curate")); assert.equal(JSON.stringify(result).includes("test-only-key"), false);
});
test("feedback changes signals and exclusions, including when Qloo returns an excluded result", async () => {
  const calls: URL[] = []; const brief = validateBrief({ ...input, likedIds: [C], excludedIds: [B] });
  const result = await runAgent(brief, new QlooClient("test-only-key", undefined, mockQloo(calls)));
  assert.equal(result.recommendations.length, 0);
  for (const u of calls.filter(u => u.pathname === "/v2/insights")) {
    assert.ok(u.searchParams.get("signal.interests.entities")?.includes(C)); assert.ok(u.searchParams.get("filter.exclude.entities")?.includes(B));
  }
});
test("a category failure preserves successful results and surfaces a warning", async () => {
  const result = await runAgent(validateBrief(input), new QlooClient("test-only-key", undefined, mockQloo([], "destination")));
  assert.equal(result.recommendations.length, 2); assert.ok(result.warnings.some(w => w.startsWith("travel:")));
});
test("unmatched tastes return an actionable error instead of invented results", async () => {
  const fetcher: typeof fetch = async () => Response.json({ results: [] });
  await assert.rejects(runAgent(validateBrief(input), new QlooClient("test-only-key", undefined, fetcher)), (e: unknown) => e instanceof TastePilotError && e.code === "no_matches");
});
test("malformed briefs, large favorite lists, bad IDs and conflicting feedback are rejected", () => {
  for (const invalid of [null, { ...input, favorites: [] }, { ...input, priceLevel: 9 }, { ...input, categories: ["bogus"] }, { ...input, favorites: [null] }, { ...input, likedIds: ["malformed"] }, { ...input, likedIds: [A], excludedIds: [A] }]) assert.throws(() => validateBrief(invalid), TastePilotError);
});
test("upstream error bodies and authentication secrets never reach the HTTP response", async () => {
  const fetcher: typeof fetch = async () => Response.json({ key: "test-only-key", error: "sensitive upstream response" }, { status: 401 });
  const response = await handlePlan(new Request("https://tastepilot.test/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }), { QLOO_API_KEY: "test-only-key" }, fetcher);
  assert.equal(response.status, 503); const body = await response.text(); assert.equal(body.includes("test-only-key"), false); assert.equal(body.includes("sensitive"), false); assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("HTTP handler validates media type, origin, JSON, body size and missing runtime configuration", async () => {
  const req = (body: string, headers: Record<string,string> = {}) => new Request("https://tastepilot.test/api/plan", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
  assert.equal((await handlePlan(req("{}", { Origin: "https://other.test" }), {})).status, 403);
  assert.equal((await handlePlan(req("{}", { "Content-Type": "text/plain" }), {})).status, 415);
  assert.equal((await handlePlan(req("{bad"), {})).status, 400);
  assert.equal((await handlePlan(req(" ".repeat(12_001)), {})).status, 413);
  assert.equal((await handlePlan(req(JSON.stringify(input)), {})).status, 503);
});
test("external URLs require HTTPS and Qloo hosts are restricted before transmitting a credential", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined); assert.equal(safeUrl("https://user:pass@example.com"), undefined);
  assert.equal(safeUrl("https://example.com/"), "https://example.com/");
  assert.throws(() => new QlooClient("test-only-key", "https://untrusted.test"), TastePilotError);
});

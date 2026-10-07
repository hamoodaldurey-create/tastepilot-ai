import type { AgentStep, Brief, Category, PlanResult, Recommendation } from "./tastepilot-types.ts";

type Entity = { entity_id?: string; name?: string; subtype?: string; type?: string; types?: string[]; properties?: Record<string, unknown>; tags?: { id?: string; name?: string }[]; query?: { affinity?: number }; affinity?: number };
type QlooResponse = { results?: { entities?: Entity[]; tags?: { id?: string; name?: string; type?: string }[] } | Entity[]; success?: boolean };
export class TastePilotError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 502) { super(message); this.code = code; this.status = status; }
}

export function validateBrief(value: unknown): Brief {
  if (!value || typeof value !== "object") throw new TastePilotError("invalid_brief", "Enter your favorite things to begin.", 400);
  const b = value as Record<string, unknown>;
  const types = ["movie", "artist", "brand", "book", "place"];
  const categories = ["dining", "travel", "entertainment"];
  if (!Array.isArray(b.favorites) || b.favorites.length < 1 || b.favorites.length > 3) throw new TastePilotError("invalid_brief", "Add between one and three favorites.", 400);
  const favorites = b.favorites.map((f: Record<string, unknown>) => {
    if (!f || typeof f.name !== "string" || !f.name.trim() || f.name.trim().length > 100 || !types.includes(String(f.type))) throw new TastePilotError("invalid_brief", "Each favorite needs a name and category.", 400);
    return { name: f.name.trim(), type: f.type as Brief["favorites"][number]["type"] };
  });
  if (typeof b.city !== "string" || b.city.trim().length > 100 || !b.city.trim()) throw new TastePilotError("invalid_brief", "Enter a city for dining recommendations.", 400);
  if (!Number.isInteger(b.priceLevel) || Number(b.priceLevel) < 1 || Number(b.priceLevel) > 4) throw new TastePilotError("invalid_brief", "Choose a dining price level.", 400);
  if (!Array.isArray(b.categories) || !b.categories.length || b.categories.length > 3 || b.categories.some(c => !categories.includes(c))) throw new TastePilotError("invalid_brief", "Choose at least one recommendation category.", 400);
  const ids = (v: unknown) => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > 20 || v.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))) throw new TastePilotError("invalid_brief", "Feedback contains an invalid recommendation.", 400);
    return [...new Set(v)] as string[];
  };
  const likedIds = ids(b.likedIds), excludedIds = ids(b.excludedIds);
  if (likedIds.some(id => excludedIds.includes(id))) throw new TastePilotError("invalid_brief", "A recommendation cannot be liked and hidden together.", 400);
  return { favorites, city: b.city.trim(), priceLevel: Number(b.priceLevel), categories: [...new Set(b.categories)] as Category[], likedIds, excludedIds };
}

export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
const text = (v: unknown) => typeof v === "string" ? v.slice(0, 1200) : "";
const entities = (r: QlooResponse): Entity[] => Array.isArray(r.results) ? r.results : r.results?.entities ?? [];

export class QlooClient {
  private base: string;
  private key: string;
  private fetcher: typeof fetch;
  constructor(key: string, base = "https://hackathon.api.qloo.com", fetcher: typeof fetch = fetch) {
    if (!key) throw new TastePilotError("not_configured", "Live recommendations are being configured. Please try again shortly.", 503);
    if (!["https://hackathon.api.qloo.com", "https://api.qloo.com"].includes(base.replace(/\/$/, ""))) throw new TastePilotError("configuration_error", "The recommendation service needs attention.", 503);
    this.base = base.replace(/\/$/, "");
    // Worker fetch must be called without the QlooClient as its receiver.
    // Calling a stored native fetch as this.fetcher() throws Illegal invocation.
    this.key = key; this.fetcher = (input, init) => fetcher(input, init);
  }
  async get(path: "/search" | "/v2/insights" | "/v2/tags", params: Record<string, string>): Promise<QlooResponse> {
    const url = new URL(path, this.base);
    url.search = new URLSearchParams(params).toString();
    let response: Response;
    // Workers support manual redirects. Never forward the key to a redirect.
    try { response = await this.fetcher(url, { headers: { "X-Api-Key": this.key, Accept: "application/json" }, signal: AbortSignal.timeout(12_000), redirect: "manual" }); }
    catch { throw new TastePilotError("service_unavailable", "Qloo could not be reached. Please try again."); }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new TastePilotError("authentication_required", "The Qloo connection needs attention.", 503);
      if (response.status === 429) throw new TastePilotError("rate_limited", "Qloo is busy. Please wait a moment and try again.", 429);
      throw new TastePilotError("query_failed", response.status === 400 ? "Qloo could not match this search. Try another city or favorite." : "Qloo could not complete this search.");
    }
    try { const r = await response.json() as QlooResponse; if (r.success === false) throw new Error(); return r; }
    catch { throw new TastePilotError("invalid_response", "Qloo returned an unreadable response. Please try again."); }
  }
}

export async function runAgent(brief: Brief, client: QlooClient): Promise<PlanResult> {
  const steps: AgentStep[] = [], warnings: string[] = [];
  steps.push({ tool: "Plan", status: "complete", detail: `Find ${brief.categories.join(", ")} recommendations. Dining stays in ${brief.city}; destinations are worldwide.` });
  const matches = await Promise.allSettled(brief.favorites.map(async favorite => {
    const results = entities(await client.get("/search", { query: favorite.name, types: `urn:entity:${favorite.type}`, take: "5" }));
    const sameType = results.filter(e => (e.subtype ?? e.type) === `urn:entity:${favorite.type}` || e.types?.includes(`urn:entity:${favorite.type}`));
    const match = sameType.find(e => e.name?.toLowerCase() === favorite.name.toLowerCase()) ?? sameType[0];
    if (!match?.entity_id || !match.name) throw new TastePilotError("no_match", `No ${favorite.type} match for “${favorite.name}”. Try a more specific name.`, 422);
    return { input: favorite.name, name: match.name, id: match.entity_id, type: favorite.type };
  }));
  const resolved: PlanResult["resolved"] = [];
  for (const match of matches) {
    if (match.status === "fulfilled") resolved.push(match.value);
    else {
      if (match.reason instanceof TastePilotError && ["authentication_required", "rate_limited", "service_unavailable"].includes(match.reason.code)) throw match.reason;
      warnings.push(match.reason instanceof TastePilotError ? match.reason.message : "A favorite could not be matched.");
    }
  }
  if (!resolved.length) throw new TastePilotError("no_matches", warnings[0] || "No favorites matched. Try another title or artist.", 422);
  steps.push({ tool: "Resolve tastes · Qloo Search", status: warnings.length ? "warning" : "complete", detail: resolved.map(r => `${r.input} → ${r.name} (${r.type})`).join("; ") });
  const signalIds = [...new Set([...resolved.map(r => r.id), ...brief.likedIds])].filter(id => !brief.excludedIds.includes(id));
  if (!signalIds.length) throw new TastePilotError("no_matches", "Keep at least one favorite or liked recommendation.", 422);
  if (brief.likedIds.length || brief.excludedIds.length) steps.push({ tool: "Refine", status: "complete", detail: `${brief.likedIds.length} liked results added as taste signals; ${brief.excludedIds.length} hidden results excluded.` });
  // Verified against Qloo Tags on 2026-10-07. This stable taxonomy ID avoids
  // making every recommendation depend on an additional discovery request.
  const restaurantTag = "urn:tag:category:place:restaurant";
  const types: Record<Category, string> = { dining: "place", travel: "destination", entertainment: "movie" };
  const jobs = await Promise.allSettled(brief.categories.map(async category => {
    const params: Record<string, string> = { "filter.type": `urn:entity:${types[category]}`, "signal.interests.entities": signalIds.join(","), "filter.exclude.entities": [...new Set([...signalIds, ...brief.excludedIds])].join(","), take: "6", "feature.explainability": "true" };
    if (category === "dining") Object.assign(params, { "filter.location.query": brief.city, "filter.location.radius": "0", "filter.price_level.max": String(brief.priceLevel), "filter.tags": restaurantTag! });
    const list = entities(await client.get("/v2/insights", params));
    const items = list.filter(e => e.entity_id && e.name && !signalIds.includes(e.entity_id) && !brief.excludedIds.includes(e.entity_id)).map(e => {
      const p = e.properties ?? {};
      const score = e.query?.affinity ?? e.affinity;
      return { id: e.entity_id!, name: e.name!, category, description: text(p.description), image: safeUrl((p.image as {url?:string})?.url), url: safeUrl((p.websites as string[])?.[0] ?? p.website), address: text(p.address), tags: (e.tags ?? []).map(t => text(t.name)).filter(Boolean).slice(0, 4), affinity: typeof score === "number" && Number.isFinite(score) ? score : undefined, priceLevel: typeof p.price_level === "number" ? p.price_level : undefined, reason: `Qloo ranked this using your combined tastes: ${resolved.map(r => r.name).join(", ")}${brief.likedIds.length ? " and your liked recommendations" : ""}.` } satisfies Recommendation;
    });
    return { category, items: [...new Map(items.map(i => [i.id, i])).values()] };
  }));
  const recommendations: Recommendation[] = [];
  jobs.forEach((job, i) => {
    const category = brief.categories[i];
    if (job.status === "fulfilled") {
      recommendations.push(...job.value.items);
      steps.push({ tool: `${category} · Qloo Insights`, status: job.value.items.length ? "complete" : "warning", detail: `${job.value.items.length} recommendations${category === "dining" ? ` in ${brief.city}, up to price level ${brief.priceLevel}` : ""}.` });
      if (!job.value.items.length) warnings.push(`No ${category} results matched this search. Adjust your tastes${category === "dining" ? ", city, or price level" : ""}.`);
    } else {
      if (job.reason instanceof TastePilotError && job.reason.code === "authentication_required") throw job.reason;
      const message = job.reason instanceof TastePilotError ? job.reason.message : "This category could not be loaded.";
      warnings.push(`${category}: ${message}`);
      steps.push({ tool: `${category} · Qloo Insights`, status: "warning", detail: message });
    }
  });
  steps.push({ tool: "Curate", status: recommendations.length ? "complete" : "warning", detail: `Returned ${recommendations.length} real Qloo entities. No bookings, availability, or travel times are inferred.` });
  return { recommendations, resolved, steps, warnings: [...new Set(warnings)], city: brief.city, generatedAt: new Date().toISOString(), mode: "live" };
}

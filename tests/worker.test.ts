import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

test("native Worker fetch returns travel results and refuses credential-bearing redirects", async () => {
  const require = createRequire(import.meta.url);
  const roots = [require.resolve("wrangler")];
  const { Miniflare, Response: WorkerResponse } = await import(require.resolve("miniflare", { paths: roots }));
  const { build } = await import(require.resolve("esbuild", { paths: roots }));
  const bundle = await build({
    stdin: {
      contents: `import { handlePlan } from './lib/plan-handler.ts';
        export default { fetch(request) { return handlePlan(request, { QLOO_API_KEY: 'worker-test-only' }); } };`,
      resolveDir: fileURLToPath(new URL("../", import.meta.url)),
    },
    bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
  });
  let calls = 0, redirect = false;
  const worker = new Miniflare({
    modules: true, compatibilityDate: "2026-05-15", script: bundle.outputFiles[0].text,
    outboundService: async (request: Request) => {
      calls++;
      const url = new URL(request.url);
      assert.equal(url.origin, "https://hackathon.api.qloo.com");
      assert.equal(request.headers.get("X-Api-Key"), "worker-test-only");
      if (redirect) return new WorkerResponse(null, { status: 302, headers: { Location: "https://example.com/" } });
      const body = url.pathname === "/search"
        ? { results: [{ entity_id: "00000000-0000-4000-8000-000000000001", name: "Interstellar", types: ["urn:entity:movie"] }] }
        : { results: { entities: [{ entity_id: "00000000-0000-4000-8000-000000000002", name: "Test destination" }] } };
      return new WorkerResponse(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    },
  });
  const request = () => worker.dispatchFetch("http://localhost/api/plan", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorites: [{ name: "Interstellar", type: "movie" }], city: "Muscat", priceLevel: 3, categories: ["travel"] }),
  });
  try {
    const response = await request(), result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.equal(result.recommendations.length, 1);
    assert.equal(result.recommendations[0].category, "travel");
    assert.equal(JSON.stringify(result).includes("worker-test-only"), false);
    redirect = true; calls = 0;
    const rejected = await request();
    assert.equal(rejected.status, 422);
    assert.equal(calls, 1, "redirect must not forward the credential to another host");
  } finally {
    await worker.dispose();
  }
});

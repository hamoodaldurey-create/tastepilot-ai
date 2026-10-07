# TastePilot AI

TastePilot connects films, artists, brands, books, and places you love to dining, travel, and film recommendations using Qloo's Taste Graph. Built by Hamood Al Durey for the Qloo Agentic Hackathon.

## What it does

- Resolves up to three named favorites to real Qloo entities, displaying what matched.
- Searches three domains: restaurants in your chosen city, worldwide destinations, and films.
- Applies dining location and relative price limits using Qloo's verified restaurant category.
- Uses liked recommendations as new taste signals and excludes hidden results on the next search.
- Displays the agent's tool steps, partial failures, and genuine empty states.
- Renders Qloo metadata and images, with direct or search links for further research.

The current agent uses deterministic orchestration around Qloo's AI recommendations. It does **not** use an LLM, invent venue descriptions, verify opening hours, make bookings, or claim model affinity scores are probabilities. Destination ideas are worldwide rather than a locally scheduled itinerary. This is a working first version; a final hackathon submission has not been made.

## Architecture

React 19 + TypeScript, Vinext/Vite, and a Cloudflare Worker-compatible server. The browser calls `POST /api/plan`; the Worker alone authenticates with Qloo:

1. Plan the requested categories and dining constraints.
2. Resolve typed favorite names with `GET /search`.
3. Apply the restaurant category verified against `GET /v2/tags` on 2026-10-07.
4. Fetch cross-domain recommendations with `GET /v2/insights`.
5. Deduplicate and exclude feedback IDs, preserve Qloo ranking, and return a trace.
6. Refine the next query using explicit feedback.

`GET /api/health` reports readiness without returning any credential. Preferences and feedback remain in the current page session; there is no stored user profile. Searches send favorites and feedback entity IDs to Qloo.

## Run locally

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Set QLOO_API_KEY in .dev.vars using your local editor.
pnpm dev
```

`.dev.vars` is ignored by Git. Keep the key in a runtime secret or environment variable. Never place it in browser code, a `VITE_*` or `NEXT_PUBLIC_*` variable, the hosting manifest, a URL, or a committed file. `.env.example` and `.dev.vars.example` contain empty placeholders only.

The API defaults to `https://hackathon.api.qloo.com`. `QLOO_API_URL` may also use the official `https://api.qloo.com` service; arbitrary hosts are rejected to prevent transmitting the credential elsewhere.

## Validate

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:smoke
pnpm check:secrets
```

The test suite covers typed entity resolution, cross-domain calls, local dining filters, feedback, upstream failures, unmatched tastes, invalid input, HTTP validation, secret-safe errors, and URL restrictions. The smoke check starts the built Worker, verifies server-rendered content and API behavior, then stops it. CI runs type checking, tests, the build, and credential scanning without a real API key.

## Deployment

The app is configured for Sites hosting in `.openai/hosting.json`. The hosted Qloo key is a secret runtime binding configured separately from source; no credential is included in Git or in the deployment archive. Deploying this repository elsewhere requires an equivalent Worker runtime and secret bindings. Do not deploy this as a static-only site: the Qloo credential belongs on the server.

Deployment starts private. Making the app available to hackathon judges requires changing access deliberately. Add platform-level abuse controls before wider public use. API calls have timeouts, bounded input, restricted destinations, and no automatic background searches.

## Demo flow

1. Use **The film lover** example, or enter your own favorite titles and artists.
2. Choose a dining city and price level, then select **Find my discoveries**.
3. Inspect the matched tastes and the category tabs.
4. Like or hide a result, then select **Update my discoveries**.
5. Open **How your discoveries came together** to inspect the Qloo tool trace.

Qloo coverage varies by location. A lack of restaurant results is reported honestly; the app does not substitute invented venues or silently change the city.

## License

MIT; see [LICENSE](LICENSE). Qloo data and images remain subject to Qloo's applicable terms.

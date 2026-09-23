# Integrations and providers

How to pick infrastructure, and how to wire any external provider (email, storage, AI, payments, …)
so it can be swapped later. Adding a binding or secret: [recipes.md](recipes.md#worker-binding-var-or-secret).

## Cloudflare first

Reach for the Cloudflare primitive before a third-party service. It runs next to the Worker, is
configured in `wrangler.jsonc`, and needs no extra vendor account or secret.

| Need                                        | Default                                          |
| ------------------------------------------- | ------------------------------------------------ |
| Relational data                             | Postgres via Hyperdrive (already in place)       |
| Files, uploads, exports                     | R2                                               |
| Small, read-heavy config or cache           | KV (eventually consistent; never for auth state) |
| Background or retryable work                | Queues                                           |
| Multi-step, long-running, durable processes | Workflows                                        |
| Per-entity state, realtime, coordination    | Durable Objects                                  |
| Scheduled jobs                              | Cron Triggers                                    |
| Rate limiting                               | Rate Limiting binding or a Durable Object        |
| Bot protection on public forms              | Turnstile                                        |
| LLM calls: routing, caching, logs, limits   | AI Gateway in front of every provider            |
| Hosted models, embeddings                   | Workers AI                                       |
| AI agents (stateful, realtime, scheduled)   | Agents SDK on Durable Objects                    |
| Vector search                               | Vectorize                                        |
| Logs and traces                             | Workers Logs / Traces (`observability` is on)    |

Use a third party only when Cloudflare has no real equivalent or it's clearly worse for the job,
and say why in the PR. Current approved exceptions:

| Need                        | Provider                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| Error tracking, performance | Sentry (`@sentry/cloudflare`; installed, not wired until there's a DSN) |
| Auth                        | Better Auth (Google)                                                    |
| Postgres hosting            | PlanetScale                                                             |

Anything new is added to this table in the same PR that introduces it.

Workers constraints to check before adding any SDK: it must run on workerd with `nodejs_compat`
(no native modules, no filesystem, no long-lived sockets across requests), and it must not do I/O
at module scope.

## Ports and adapters for every provider

Application code depends on an interface we own (the **port**), never on a vendor SDK. Each vendor
gets one **adapter** that implements the port. Swapping a provider means writing a new adapter and
changing one factory line; no call site changes.

Layout, per capability (see "The `services/` layer" below):

```
src/services/email/
  email.ts                # Port: interface + domain types. No vendor imports.
  email.server.ts         # getEmail(): picks and caches the adapter for this request.
  cloudflare.server.ts    # Adapter: Cloudflare email binding
  resend.server.ts        # Adapter: another provider, same interface
```

```ts
// src/services/email/email.ts
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
```

```ts
// src/services/email/email.server.ts
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";

import { createCloudflareEmail } from "#/services/email/cloudflare.server";
import type { EmailSender } from "#/services/email/email";

const senders = new WeakMap<Request, EmailSender>();

/** The email sender for the current request. Server-only. */
export function getEmail(): EmailSender {
  const request = getRequest();
  let sender = senders.get(request);
  if (!sender) {
    // The only line that names a vendor. Swap providers here (or switch on an env var).
    sender = createCloudflareEmail(env.EMAIL);
    senders.set(request, sender);
  }
  return sender;
}
```

Rules:

- The port uses our domain types. Vendor types, errors, and response shapes never cross it;
  adapters translate them.
- Adapters that hold I/O objects (sockets, clients with connections) are created per request
  through a `get<Capability>()` accessor, like `getDb()`. Adapters over a Worker binding (`env.AI`,
  `env.BUCKET`) hold no sockets and can be created per call, like `getModel()`. Never at module
  scope either way.
- Keep ports small and shaped by what the app needs today, not by everything the vendor offers.
  Add methods when a caller needs them.
- Don't wrap what already abstracts the provider: Drizzle (the database), Better Auth (identity),
  and the AI SDK's `LanguageModel` (LLMs) are already ports. Wrapping them again adds indirection
  with no new swap point.
- Flexibility applies at seams (providers, I/O, external APIs). Inside the app, prefer plain
  functions and concrete types; no interface with one implementation and no second caller.

### The `services/` layer

`src/services/<capability>/` holds ports and adapters. It sits between `auth/` and `db/`:
`functions/`, `middleware/`, and `auth/` may call services; services may use `db/` and `lib/`.
Client code (`components/`, `hooks/`) may not import services at all; it reaches them through
server functions. `.oxlintrc.json` enforces both.

## AI features

AI runs entirely on Cloudflare. Everything below is installed; `env.AI` is bound in both
environments.

| Need                                         | Use                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| One-shot calls: generate, extract, summarize | AI SDK (`ai`) `generateText` / `streamText` with `getModel()`                                                  |
| Models                                       | Workers AI through `workers-ai-provider` (`@cf/...` ids)                                                       |
| Logs, caching, rate limits, spend controls   | AI Gateway (`AI_GATEWAY_ID`)                                                                                   |
| Stateful agents: memory, tools, realtime     | Agents SDK (`agents`): an `Agent` class is a Durable Object with SQLite; `useAgent` (`agents/react`) in the UI |
| Chat UI backed by an agent                   | `AIChatAgent` (`@cloudflare/ai-chat`) + `useAgentChat` (`@cloudflare/ai-chat/react`)                           |
| Scheduled or long-running agent work         | The agent's `this.schedule(...)`, or Workflows for multi-step durable jobs                                     |
| Embeddings, retrieval                        | Workers AI embedding models + Vectorize                                                                        |
| Structured output                            | `generateText` with `output: Output.object({ schema })` (Zod); not the deprecated `generateObject`             |

Why this shape: the Agents SDK and `AIChatAgent` are built on the AI SDK, so one model interface
(`LanguageModel`) serves both one-shot calls and agents. `workers-ai-provider` implements it over
the `env.AI` binding: no API keys, and AI Gateway is one option away.

### Models: `getModel()`

`src/services/ai/model.server.ts` is the only place that builds a model. `AI_MODEL` and
`AI_GATEWAY_ID` in `wrangler.jsonc` configure it, so changing model or gateway is a config change.

```ts
import { generateText } from "ai";

import { getModel } from "#/services/ai/model.server";

const { text } = await generateText({ model: getModel(), prompt, maxOutputTokens: 500 });
```

Third-party models (`"anthropic/..."`, `"openai/..."`) can route through the same binding and AI
Gateway, but `workers-ai-provider` marks that path experimental. Stay on `@cf/...` models unless a
feature needs one Workers AI doesn't host, and ask first.

### Agents

An agent is a class in `src/agents/<name>-agent.ts` extending `Agent` (or `AIChatAgent`). Each
instance is a Durable Object with its own SQLite state, reached at
`/agents/<agent-name>/<instance-name>` over WebSocket or HTTP. `src/server.ts` routes those URLs
before the app. Adding one: [recipes.md](recipes.md#ai-agent).

**Access control.** Agent URLs don't go through server functions or `authMiddleware`.
`src/server.ts` runs `authorizeAgentRequest` (`src/auth/agent-access.server.ts`) on every agent
connection and request: the caller must be signed in, and the instance name must be their user id
or start with `<userId>:` (`u123:chat-42`). Name instances that way; never name an instance
something a client can guess for another user. Inside the agent, still scope every DB query by that
owner id.

`bun run dev` needs `wrangler login`, because the AI binding is always remote. Tests never call it:
the `workers` test project turns remote bindings off, and tests pass a fake `AI` binding
(`src/services/ai/model.worker.test.ts`).

### Rules

- Build models only with `getModel()`. Model ids and gateway come from `wrangler.jsonc` vars.
- Set `AI_GATEWAY_ID` in every deployed environment so calls are logged, cached, and rate-limited.
- Prompts are versioned files in `src/services/ai/prompts/`, not strings inlined in handlers.
- Validate model output with a Zod schema. Treat it as untrusted input: never execute it, never
  interpolate it into SQL or HTML, and give tools only the access the calling user already has.
- Stream responses to the UI. Work that can outlast a request goes to the agent's scheduler, Queues,
  or Workflows, never an unawaited promise.
- Set `maxOutputTokens` and an abort timeout on every call. Log token usage and latency.
- Agents' `@callable()` methods are public RPC for whoever holds the connection: validate their
  arguments with Zod.

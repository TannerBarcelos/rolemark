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

Layout, per capability (created with the first capability; see "Adding `src/services/`" below):

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
- Adapters are created per request through a `get<Capability>()` accessor, same as `getDb()`.
  Never at module scope.
- Keep ports small and shaped by what the app needs today, not by everything the vendor offers.
  Add methods when a caller needs them.
- Don't wrap what already abstracts the provider: Drizzle (the database), Better Auth (identity),
  and LangChain chat models (LLMs) are already ports. Wrapping them again adds indirection with no
  new swap point.
- Flexibility applies at seams (providers, I/O, external APIs). Inside the app, prefer plain
  functions and concrete types; no interface with one implementation and no second caller.

### Adding `src/services/`

It's a new layer: `functions/` and `middleware/` call services, services may use `db/` and `lib/`,
and `auth/` may use services (for example, to send verification email). Place it between `auth/`
and `db/`:

`routes → components/hooks → functions → middleware → auth → services → db → lib`

When you create it, in the same PR: add an `src/services/**` override to `.oxlintrc.json`
forbidding imports from every layer above it, add `#/services/*` to the forbidden list of the
`db/` override, add a `components/hooks` restriction on `#/services/**/*.server`, and add the row
to the layer table in [architecture.md](architecture.md#layers).

## AI features

Use the LangChain JS ecosystem for orchestration and Cloudflare for everything under it. LangChain
gives one model interface across providers, structured output, tool calling, retrieval, and agent
orchestration. Cloudflare supplies Workers AI as one provider among several, AI Gateway in front of
all of them, and Vectorize, Queues, and Workflows around them. All packages in the table are
installed.

| Need                                 | Use                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Chat model, provider-agnostic        | `initChatModel` from `langchain`, typed as `BaseChatModel`              |
| Cloudflare-hosted models             | `ChatCloudflareWorkersAI` from `@langchain/cloudflare`                  |
| Provider packages                    | `@langchain/anthropic`, `@langchain/openai`, `@langchain/cloudflare`, … |
| Structured output                    | `model.withStructuredOutput(zodSchema)`                                 |
| Agents, multi-step or stateful flows | LangGraph (`@langchain/langgraph`)                                      |
| Embeddings / vector store            | `@langchain/cloudflare` (Workers AI embeddings, Vectorize)              |

Layout: `src/services/ai/` holds model setup (`ai.server.ts` with `getChatModel()`), prompts, and
chains/graphs. Server functions call into it; nothing AI-related runs in the browser.

```ts
// src/services/ai/ai.server.ts
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "cloudflare:workers";
import { initChatModel } from "langchain";

/**
 * Model ids live in config ("<provider>:<model-id>"), so changing provider or model is a config
 * change. Point the provider's base URL at AI Gateway; the option name differs per provider
 * package, so check it in the package's docs.
 */
export async function getChatModel(): Promise<BaseChatModel> {
  return initChatModel(env.AI_MODEL, { temperature: 0 });
}
```

Rules:

- Code depends on `BaseChatModel` / runnables, never on a provider class. The model id and gateway
  URL come from `wrangler.jsonc` vars, not code.
- Route every provider call through AI Gateway.
- Prompts are versioned files in `src/services/ai/prompts/`, not strings inlined in handlers.
- Validate model output with a Zod schema (`withStructuredOutput`). Treat it as untrusted input:
  never execute it, never interpolate it into SQL or HTML, and give tools only the access the
  calling user already has (queries scoped by `context.user.id`).
- Stream responses to the UI. Anything that can outlast a request (batch jobs, long agent runs)
  goes to Queues or Workflows.
- Log token usage and latency per call; set timeouts and a max-token budget on every call.

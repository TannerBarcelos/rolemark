import type { LanguageModel } from "ai";
import { env } from "cloudflare:workers";
import { createWorkersAI } from "workers-ai-provider";

export type ModelConfig = {
  /** Workers AI model id, e.g. "@cf/zai-org/glm-4.7-flash". */
  modelId: string;
  /** AI Gateway to route calls through (logs, caching, rate limits). Omit to call Workers AI directly. */
  gatewayId?: string;
};

/** Typed as plain strings: typegen narrows vars to their current literal values. */
type AiBindings = { AI: Ai; AI_MODEL: string; AI_GATEWAY_ID: string };

/** A chat model on the given Workers AI binding. */
export function createModel(binding: Ai, { modelId, gatewayId }: ModelConfig): LanguageModel {
  const workersAi = createWorkersAI({
    binding,
    ...(gatewayId ? { gateway: { id: gatewayId } } : {}),
  });
  return workersAi(modelId);
}

/**
 * The app's chat model, configured by `AI_MODEL` and `AI_GATEWAY_ID` in wrangler.jsonc, so
 * changing model or gateway is a config change. Server-only.
 */
export function getModel(bindings: AiBindings = env): LanguageModel {
  return createModel(bindings.AI, {
    modelId: bindings.AI_MODEL,
    gatewayId: bindings.AI_GATEWAY_ID,
  });
}

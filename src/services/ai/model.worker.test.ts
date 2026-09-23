import { generateText } from "ai";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { createModel, getModel } from "#/services/ai/model.server";

/** Stands in for the remote-only `env.AI` binding; returns a canned chat completion. */
function fakeAi(response = "Hello from Workers AI") {
  const run = vi.fn(async (_model: string, _inputs: object, _options?: object) => ({ response }));
  return { binding: { run } as unknown as Ai, run };
}

describe("createModel", () => {
  it("builds a Workers AI model for the configured id", () => {
    const { binding } = fakeAi();
    const model = createModel(binding, { modelId: "@cf/test/model" });

    expect(model).toMatchObject({ provider: "workersai.chat", modelId: "@cf/test/model" });
  });

  it("generates text through the AI binding", async () => {
    const { binding, run } = fakeAi("Hi there");

    const { text } = await generateText({
      model: createModel(binding, { modelId: "@cf/test/model" }),
      prompt: "Say hi",
    });

    expect(text).toBe("Hi there");
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("@cf/test/model", expect.any(Object), expect.any(Object));
  });

  it("routes calls through the AI Gateway when one is configured", async () => {
    const { binding, run } = fakeAi();

    await generateText({
      model: createModel(binding, { modelId: "@cf/test/model", gatewayId: "rolemark" }),
      prompt: "Say hi",
    });

    expect(run).toHaveBeenCalledWith(
      "@cf/test/model",
      expect.any(Object),
      expect.objectContaining({ gateway: { id: "rolemark" } }),
    );
  });
});

describe("getModel", () => {
  it("reads the Worker's own bindings when called with no arguments", () => {
    expect(getModel()).toMatchObject({ provider: "workersai.chat", modelId: env.AI_MODEL });
  });

  it("uses the model id from wrangler.jsonc by default", () => {
    const { binding } = fakeAi();
    const model = getModel({ ...env, AI: binding });

    expect(env.AI_MODEL).toMatch(/^@cf\//);
    expect(model).toMatchObject({ modelId: env.AI_MODEL });
  });

  it("reads the model and gateway from the given bindings", async () => {
    const { binding, run } = fakeAi();

    await generateText({
      model: getModel({ AI: binding, AI_MODEL: "@cf/other/model", AI_GATEWAY_ID: "gw" }),
      prompt: "Say hi",
    });

    expect(run).toHaveBeenCalledWith(
      "@cf/other/model",
      expect.any(Object),
      expect.objectContaining({ gateway: { id: "gw" } }),
    );
  });

  it("skips the gateway when AI_GATEWAY_ID is empty", async () => {
    const { binding, run } = fakeAi();

    await generateText({
      model: getModel({ AI: binding, AI_MODEL: "@cf/other/model", AI_GATEWAY_ID: "" }),
      prompt: "Say hi",
    });

    expect(run.mock.calls[0]?.[2]).toMatchObject({ gateway: undefined });
  });
});

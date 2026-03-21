/**
 * Tests for the Prompt module.
 */
import { describe, it, expect } from "vitest";
import {
  FunctionPrompt,
  createPrompt,
  message,
  userMessage,
  assistantMessage,
} from "@/lib/fastmcp/prompts";
import { PromptError } from "@/lib/fastmcp/exceptions";

describe("FunctionPrompt", () => {
  it("should create a prompt with basic options", () => {
    const prompt = createPrompt({
      name: "test",
      description: "A test prompt",
      handler: () => "Hello",
    });

    expect(prompt.name).toBe("test");
    expect(prompt.description).toBe("A test prompt");
  });

  it("should render a string result as user message", async () => {
    const prompt = createPrompt({
      name: "simple",
      handler: () => "Analyze this data",
    });

    const result = await prompt.render({});

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[0].content[0]).toEqual({
      type: "text",
      text: "Analyze this data",
    });
  });

  it("should render message array results", async () => {
    const prompt = createPrompt({
      name: "conversation",
      handler: () => [
        userMessage("What is 2+2?"),
        assistantMessage("4"),
        userMessage("And 3+3?"),
      ],
    });

    const result = await prompt.render({});

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[2].role).toBe("user");
  });

  it("should render PromptResult directly", async () => {
    const prompt = createPrompt({
      name: "full_result",
      handler: () => ({
        messages: [userMessage("test")],
        description: "A prompt result",
      }),
    });

    const result = await prompt.render({});

    expect(result.messages).toHaveLength(1);
    expect(result.description).toBe("A prompt result");
  });

  it("should handle arguments", async () => {
    const prompt = createPrompt({
      name: "greet",
      arguments: [
        { name: "name", required: true },
        { name: "style", required: false },
      ],
      handler: (args) =>
        `Hello, ${args.name}! Style: ${args.style ?? "default"}`,
    });

    const result = await prompt.render({ name: "Alice" });

    expect(result.messages).toHaveLength(1);
    expect(
      (result.messages[0].content[0] as { type: "text"; text: string })
        .text
    ).toBe("Hello, Alice! Style: default");
  });

  it("should throw on missing required arguments", async () => {
    const prompt = createPrompt({
      name: "strict",
      arguments: [{ name: "data", required: true }],
      handler: () => "ignored",
    });

    await expect(prompt.render({})).rejects.toThrow(PromptError);
  });

  it("should handle async handlers", async () => {
    const prompt = createPrompt({
      name: "async_prompt",
      handler: async (args) => {
        return `Processed: ${args.input}`;
      },
    });

    const result = await prompt.render({ input: "test data" });

    expect(result.messages).toHaveLength(1);
  });
});

describe("Message helpers", () => {
  it("should create user messages", () => {
    const msg = userMessage("Hello");
    expect(msg.role).toBe("user");
    expect(msg.content).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("should create assistant messages", () => {
    const msg = assistantMessage("Hi there");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toEqual([
      { type: "text", text: "Hi there" },
    ]);
  });

  it("should create messages with custom role", () => {
    const msg = message("Custom", "assistant");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toEqual([
      { type: "text", text: "Custom" },
    ]);
  });
});

/**
 * Tests for the Resource module.
 */
import { describe, it, expect } from "vitest";
import {
  FunctionResource,
  TextResource,
  ResourceTemplate,
  createResource,
  createResourceTemplate,
} from "@/lib/fastmcp/resources";
import { ResourceError } from "@/lib/fastmcp/exceptions";

describe("FunctionResource", () => {
  it("should create a resource with basic options", () => {
    const resource = new FunctionResource({
      name: "test",
      uri: "data://test",
      handler: () => "hello",
    });

    expect(resource.name).toBe("test");
    expect(resource.uri).toBe("data://test");
    expect(resource.mimeType).toBe("text/plain");
  });

  it("should read string content", async () => {
    const resource = createResource({
      name: "greeting",
      uri: "data://greeting",
      handler: () => "Hello, world!",
    });

    const result = await resource.read({});

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("data://greeting");
    expect(result.contents[0].text).toBe("Hello, world!");
  });

  it("should read JSON content", async () => {
    const resource = createResource({
      name: "config",
      uri: "data://config",
      mimeType: "application/json",
      handler: () => ({ key: "value", count: 42 }),
    });

    const result = await resource.read({});

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe("application/json");
    const parsed = JSON.parse(result.contents[0].text!);
    expect(parsed).toEqual({ key: "value", count: 42 });
  });

  it("should handle async handlers", async () => {
    const resource = createResource({
      name: "async",
      uri: "data://async",
      handler: async () => {
        return "async result";
      },
    });

    const result = await resource.read({});
    expect(result.contents[0].text).toBe("async result");
  });

  it("should wrap handler errors in ResourceError", async () => {
    const resource = createResource({
      name: "error",
      uri: "data://error",
      handler: () => {
        throw new Error("handler failed");
      },
    });

    await expect(resource.read({})).rejects.toThrow(ResourceError);
  });
});

describe("TextResource", () => {
  it("should serve static text", async () => {
    const resource = new TextResource({
      name: "readme",
      uri: "data://readme",
      text: "# Hello\n\nThis is a readme.",
    });

    const result = await resource.read({});

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].text).toBe(
      "# Hello\n\nThis is a readme."
    );
    expect(result.contents[0].mimeType).toBe("text/plain");
  });
});

describe("ResourceTemplate", () => {
  it("should match URIs against template", () => {
    const template = createResourceTemplate({
      name: "user",
      uriTemplate: "data://users/{id}",
      handler: () => null,
    });

    expect(template.matches("data://users/123")).toBe(true);
    expect(template.matches("data://users/abc")).toBe(true);
    expect(template.matches("data://posts/123")).toBe(false);
    expect(template.matches("data://users/123/posts")).toBe(false);
  });

  it("should extract parameters from URI", () => {
    const template = createResourceTemplate({
      name: "post",
      uriTemplate: "data://users/{userId}/posts/{postId}",
      handler: () => null,
    });

    const params = template.extractParams(
      "data://users/42/posts/100"
    );

    expect(params).toEqual({ userId: "42", postId: "100" });
  });

  it("should return null for non-matching URI", () => {
    const template = createResourceTemplate({
      name: "user",
      uriTemplate: "data://users/{id}",
      handler: () => null,
    });

    const params = template.extractParams("data://posts/123");
    expect(params).toBeNull();
  });

  it("should read with extracted parameters", async () => {
    const template = createResourceTemplate({
      name: "user",
      uriTemplate: "data://users/{id}",
      handler: (params) => ({
        userId: params.id,
        name: `User ${params.id}`,
      }),
    });

    const result = await template.read({ id: "42" });

    expect(result.contents).toHaveLength(1);
    const parsed = JSON.parse(result.contents[0].text!);
    expect(parsed).toEqual({ userId: "42", name: "User 42" });
  });
});

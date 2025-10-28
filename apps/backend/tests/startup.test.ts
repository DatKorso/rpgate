import { describe, it, expect } from "vitest";
import { createApp } from "../src/app";

describe("Server Startup", () => {
  it("should create app successfully", async () => {
    // This test verifies the app can be created without errors
    const app = await createApp();
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();

    // Clean up
    await app.close();
  });
});

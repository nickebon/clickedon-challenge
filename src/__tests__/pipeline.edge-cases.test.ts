import { describe, expect, it } from "vitest";
import { generate } from "../lib/pipeline";

describe("edge cases", () => {
  it("handles transient stream failures before a delayed review pass", async () => {
    const res = await generate({
      behavior: "transient-429-twice",
      advanceToNextStage: async () => {
        /* hand-off succeeds */
      },
      reviewPasses: (attempt) => attempt === 2,
    });

    expect(res.status).toBe("ok");
    expect(res.attempts).toBe(2);
  });
});

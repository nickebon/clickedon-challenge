import { extractJson } from "./extract-json";
import { mockStream, type MockBehavior, type MockState } from "./anthropic-mock";

export interface GenerateInput {
  /** Drives the mock streaming client (see anthropic-mock.ts). */
  behavior: MockBehavior;
  /** Hands the finished draft to the next pipeline stage. May reject. */
  advanceToNextStage: () => Promise<void>;
  /** Returns true once the draft passes review. Scripted by callers/tests. */
  reviewPasses: (attempt: number) => boolean;
}

export interface GenerateResult {
  status: "ok" | "error";
  attempts: number;
}

const MAX_REVISIONS = 3;

/**
 * Runs one content-generation pass: stream a draft, extract it, revise until it
 * passes review, then hand off to the next stage.
 *
 * This is a faithful (stripped-down) reproduction of the real pipeline — and it
 * ships with three real bugs from that pipeline. Your job is to fix them so the
 * test suite passes. See the README for the symptoms. (Do not edit the tests.)
 */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const state: MockState = { calls: 0 };

  // The model call can fail transiently (rate limits) or return a truncated
  // stream. Right now a single hiccup takes down the whole run.
  let text: string | undefined;

    //bug 2 resolved: retry < 2 to recover from transient errors 
  for (let retry = 0; retry < 2; retry += 1) {
    try {
      const candidate = await mockStream(input.behavior, state);
      extractJson(candidate);
      text = candidate;
      break;
    } catch {
      if (retry === 1) {
        throw new Error("Unable to extract JSON from model response");
      }
    }
  }

  if (text === undefined) {
    throw new Error("Unable to extract JSON from model response");
  }

  // Revise until the draft passes review.
  let attempt = 0;

  //Bug - attempt < 50 is too high, should be MAX_REVISIONS
  while (!input.reviewPasses(attempt) && attempt < MAX_REVISIONS) {
    attempt += 1;
  }

  // bug 1 resolved: void -> await to catch errors & return status: "error" when advanceToNextStage rejects
  try {
    await input.advanceToNextStage();
  } catch {
    return { status: "error", attempts: attempt };
  }

  return { status: "ok", attempts: attempt };
}

export { MAX_REVISIONS };

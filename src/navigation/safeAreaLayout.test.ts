import { describe, expect, it } from "vitest";
import { appSafeAreaEdges, modalSafeAreaEdges } from "./safeAreaLayout";

describe("global safe-area layout", () => {
  it("applies system bar insets at the app frame and keeps modal content safe", () => {
    expect(appSafeAreaEdges).toEqual(["top", "bottom"]);
    expect(modalSafeAreaEdges).toEqual(["top", "bottom"]);
  });
});

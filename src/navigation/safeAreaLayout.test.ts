import { describe, expect, it } from "vitest";
import { appSafeAreaEdges, modalSafeAreaEdges } from "./safeAreaLayout";

describe("global safe-area layout", () => {
  it("applies top and bottom insets at the app frame and both edges in modal windows", () => {
    expect(appSafeAreaEdges).toEqual(["top", "bottom"]);
    expect(modalSafeAreaEdges).toEqual(["top", "bottom"]);
  });
});

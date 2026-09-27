import { describe, expect, it } from "vitest";
import { appSafeAreaEdges, modalSafeAreaEdges } from "./safeAreaLayout";

describe("global safe-area layout", () => {
  it("applies the top inset once at the app frame and leaves the tab bar bottom inset to navigation", () => {
    expect(appSafeAreaEdges).toEqual(["top"]);
    expect(modalSafeAreaEdges).toEqual(["top", "bottom"]);
  });
});

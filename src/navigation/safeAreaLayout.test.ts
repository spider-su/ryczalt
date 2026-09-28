import { describe, expect, it } from "vitest";
import { appSafeAreaEdges, BASE_TAB_BAR_HEIGHT, fallbackSafeAreaEdges, modalSafeAreaEdges, TAB_BAR_MIN_BOTTOM_PADDING, tabBarSafeAreaStyle } from "./safeAreaLayout";

describe("global safe-area layout", () => {
  it("lets the app own the top inset while standalone and modal screens own both", () => {
    expect(appSafeAreaEdges).toEqual(["top"]);
    expect(fallbackSafeAreaEdges).toEqual(["top", "bottom"]);
    expect(modalSafeAreaEdges).toEqual(["top", "bottom"]);
  });

  it("keeps a minimum bottom padding when no system inset is present", () => {
    expect(tabBarSafeAreaStyle(0)).toEqual({ height: BASE_TAB_BAR_HEIGHT, paddingBottom: TAB_BAR_MIN_BOTTOM_PADDING });
  });

  it("adds a positive system bottom inset once to tab height and padding", () => {
    expect(tabBarSafeAreaStyle(24)).toEqual({ height: BASE_TAB_BAR_HEIGHT + 24, paddingBottom: 24 });
  });

  it("uses the system inset on iOS without adding a second navigator-owned inset", () => {
    expect(tabBarSafeAreaStyle(34)).toEqual({ height: BASE_TAB_BAR_HEIGHT + 34, paddingBottom: 34 });
  });
});

/** Hidden tab bars cannot consume the bottom inset; the app frame owns both edges. */
export const appSafeAreaEdges = ["top", "bottom"] as const;
/** Standalone loading/recovery screens have no navigator to consume the bottom inset. */
export const fallbackSafeAreaEdges = ["top", "bottom"] as const;
export const modalSafeAreaEdges = ["top", "bottom"] as const;

export const BASE_TAB_BAR_HEIGHT = 56;
export const TAB_BAR_MIN_BOTTOM_PADDING = 6;

export function tabBarSafeAreaStyle(bottomInset: number) {
  const inset = Math.max(0, bottomInset);
  return {
    height: BASE_TAB_BAR_HEIGHT + inset,
    paddingBottom: Math.max(inset, TAB_BAR_MIN_BOTTOM_PADDING),
  };
}

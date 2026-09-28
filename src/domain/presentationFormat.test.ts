import { describe, expect, it } from "vitest";
import { formatPolishCount } from "./presentationFormat";

describe("Polish count formatting", () => {
  it("handles singular, paucal, plural, and 12–14 exceptions", () => {
    const forms = ["okres", "okresy", "okresów"] as const;
    expect(formatPolishCount(1, forms)).toBe("1 okres");
    expect(formatPolishCount(2, forms)).toBe("2 okresy");
    expect(formatPolishCount(5, forms)).toBe("5 okresów");
    expect(formatPolishCount(12, forms)).toBe("12 okresów");
    expect(formatPolishCount(22, forms)).toBe("22 okresy");
  });
});

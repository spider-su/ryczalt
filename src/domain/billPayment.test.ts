import { describe, expect, it } from "vitest";
import { makeBillPayment } from "./billPayment";

describe("bill payment period and date", () => {
  it("keeps the selected task month separate from the actual payment date", () => {
    expect(makeBillPayment("payment-1", "power", "2026-08", "600.00", "2026-09-15"))
      .toEqual({ id: "payment-1", billId: "power", period: "2026-08", paidAt: "2026-09-15", amount: "600.00" });
  });
});

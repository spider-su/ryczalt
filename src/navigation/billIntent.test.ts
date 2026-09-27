import { describe, expect, it } from "vitest";
import { recurringBillTaskIntent } from "./billIntent";

describe("recurring bill task navigation", () => {
  it("passes the bill obligation period into Settings", () => {
    expect(recurringBillTaskIntent("power", "2026-08"))
      .toEqual({ screen: "Ustawienia", params: { billId: "power", period: "2026-08" } });
  });
});

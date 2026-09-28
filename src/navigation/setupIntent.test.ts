import { describe, expect, it } from "vitest";
import { setupActionField, setupActionIntent } from "./setupIntent";

describe("guided setup navigation intents", () => {
  it("opens the existing Settings property editor and carries the target apartment", () => {
    expect(setupActionIntent("payment-day", "p2")).toEqual({
      screen: "Ustawienia",
      params: { setupAction: "payment-day", propertyId: "p2" },
    });
  });

  it("opens the existing new-apartment editor without a property id", () => {
    expect(setupActionIntent("apartment")).toEqual({ screen: "Ustawienia", params: { setupAction: "apartment" } });
  });

  it("maps each guided action to a field in the existing editor", () => {
    expect(["apartment", "rent", "payment-day", "tenant", "agreement-end", "administrator-portal"].map((action) => setupActionField(action as Parameters<typeof setupActionField>[0]))).toEqual([
      "address", "ownerRent", "paymentDay", "tenantName", "leaseEndDate", "administrationName",
    ]);
  });
});

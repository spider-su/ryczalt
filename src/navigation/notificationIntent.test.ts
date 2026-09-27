import { describe, expect, it } from "vitest";
import { notificationDataToIntent } from "./notificationIntent";

describe("notificationDataToIntent", () => {
  it("maps each task notification to its contextual destination", () => {
    expect(notificationDataToIntent({ category: "rent", propertyId: "p1", period: "2026-09", expectedAmount: "1200.00" }))
      .toEqual({ screen: "Przychód", params: { quickAdd: true, propertyId: "p1", rentalMonth: "2026-09", expectedAmount: "1200.00" } });
    expect(notificationDataToIntent({ category: "tax", period: "2026-Q3" })).toEqual({ screen: "Podatek", params: { period: "2026-Q3" } });
    expect(notificationDataToIntent({ category: "bill", billId: "b1", propertyId: "p1" })).toEqual({ screen: "Ustawienia", params: { billId: "b1" } });
    expect(notificationDataToIntent({ category: "agreement", propertyId: "p1" })).toEqual({ screen: "Ustawienia", params: { propertyId: "p1" } });
    expect(notificationDataToIntent({ category: "custom", taskId: "CUSTOM_REMINDER:r1" })).toEqual({ screen: "Pulpit", params: { taskId: "CUSTOM_REMINDER:r1" } });
  });

  it("ignores malformed or unknown notification payloads", () => {
    expect(notificationDataToIntent({ category: "rent", propertyId: "p1" })).toBeNull();
    expect(notificationDataToIntent({ category: "rent", propertyId: " ", period: "2026-13" })).toBeNull();
    expect(notificationDataToIntent({ category: "tax", period: "2026-Q5" })).toBeNull();
    expect(notificationDataToIntent({ category: "bill", billId: "" })).toBeNull();
    expect(notificationDataToIntent({ category: "agreement", propertyId: "" })).toBeNull();
    expect(notificationDataToIntent({ category: "custom", taskId: "" })).toBeNull();
    expect(notificationDataToIntent({ category: "rent", propertyId: "p1", period: "2026-09", expectedAmount: "<script>" }))
      .toEqual({ screen: "Przychód", params: { quickAdd: true, propertyId: "p1", rentalMonth: "2026-09" } });
    expect(notificationDataToIntent({ category: "unknown" })).toBeNull();
  });
});

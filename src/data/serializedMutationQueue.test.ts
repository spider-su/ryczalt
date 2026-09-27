import { describe, expect, it } from "vitest";
import { createSerializedMutationQueue } from "./serializedMutationQueue";
import { persistRentalMutation } from "./persistRentalMutation";
import { emptyDocument } from "./localRentalStore";

describe("serialized mutation queue", () => {
  it("applies concurrent mutations in submission order and continues after failure", async () => {
    const queue = createSerializedMutationQueue();
    let value = 0;
    const first = queue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      value += 1;
      return value;
    });
    const second = queue(async () => {
      value += 10;
      return value;
    });
    await expect(Promise.all([first, second])).resolves.toEqual([1, 11]);
    await expect(
      queue(async () => {
        throw new Error("storage failed");
      }),
    ).rejects.toThrow("storage failed");
    await expect(
      queue(async () => {
        value += 100;
        return value;
      }),
    ).resolves.toBe(111);
  });

  it("does not publish a changed document when persistence fails", async () => {
    const current = emptyDocument();
    current.properties.push({ id: "p1", name: "Before" });
    const persist = async () => { throw new Error("disk full"); };
    await expect(persistRentalMutation(current, (document) => ({
      ...document,
      properties: document.properties.map((property) => ({ ...property, name: "After" })),
    }), persist)).rejects.toThrow("disk full");
    expect(current.properties[0]?.name).toBe("Before");
  });
});

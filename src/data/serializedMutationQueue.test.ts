import { describe, expect, it } from "vitest";
import { createSerializedMutationQueue } from "./serializedMutationQueue";

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
});

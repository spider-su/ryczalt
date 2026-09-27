import type { RentalDocument } from "../model/rental";

export async function persistRentalMutation(
  current: RentalDocument,
  change: (document: RentalDocument) => RentalDocument,
  persist: (document: RentalDocument) => Promise<void>,
): Promise<RentalDocument> {
  const next = change(current);
  await persist(next);
  return next;
}

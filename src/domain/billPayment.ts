import type { BillPayment } from "../model/rental";
import { localIso } from "./tasks";

export function makeBillPayment(id: string, billId: string, period: string, amount: string, paidAt = localIso(new Date())): BillPayment {
  return { id, billId, period, paidAt, amount };
}

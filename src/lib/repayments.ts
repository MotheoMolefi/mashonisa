/**
 * Repayment helpers used across user + admin UIs.
 *
 * "Overdue" is computed from calendar dates (not the DB `late` flag): if the
 * borrower still owes money after the due date, we show Overdue in the UI.
 */
import { startOfDay } from "date-fns";

/** True if this row is fully settled (status or amounts agree). */
export function isRepaymentFullyPaid(rep: {
  status: string;
  amount_due: number;
  amount_paid: number;
}): boolean {
  return (
    rep.status === "paid" || Number(rep.amount_paid) >= Number(rep.amount_due)
  );
}

/**
 * True when the repayment is not fully paid and the due date (calendar day) is before today.
 */
export function isRepaymentOverdue(rep: {
  due_date: string;
  status: string;
  amount_due: number;
  amount_paid: number;
}): boolean {
  if (isRepaymentFullyPaid(rep)) return false;
  const due = startOfDay(new Date(rep.due_date + "T12:00:00"));
  const today = startOfDay(new Date());
  return due < today;
}

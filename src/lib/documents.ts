import type { DocumentType } from "@/types/database";

/** Same three types as the apply flow; all must be verified before a loan can be approved. */
export const REQUIRED_LOAN_DOCUMENT_TYPES = [
  "id_doc",
  "payslip",
  "bank_statement",
] as const satisfies readonly DocumentType[];

export type RequiredLoanDocumentType = (typeof REQUIRED_LOAN_DOCUMENT_TYPES)[number];

function isVerifiedStatus(status: string): boolean {
  return String(status).toLowerCase() === "verified";
}

/** True only when ID, payslip, and bank statement each have at least one verified row. */
export function areAllRequiredLoanDocumentsVerified(
  docs: { type: string; status: string }[]
): boolean {
  return REQUIRED_LOAN_DOCUMENT_TYPES.every((t) =>
    docs.some((d) => d.type === t && isVerifiedStatus(d.status))
  );
}

export function missingVerifiedLoanDocuments(
  docs: { type: string; status: string }[]
): RequiredLoanDocumentType[] {
  return REQUIRED_LOAN_DOCUMENT_TYPES.filter(
    (t) => !docs.some((d) => d.type === t && isVerifiedStatus(d.status))
  );
}

export function requiredLoanDocumentLabel(type: RequiredLoanDocumentType): string {
  switch (type) {
    case "id_doc":
      return "ID document";
    case "payslip":
      return "Payslip";
    case "bank_statement":
      return "Bank statement";
    default:
      return type;
  }
}

/**
 * TypeScript mirrors of Supabase tables and enums. Keep in sync with supabase/schema.sql.
 */
export type UserRole = "user" | "admin";

export type DocumentType =
  | "id_doc"
  | "payslip"
  | "bank_statement"
  | "contract"
  | "other";

export type DocumentStatus = "uploaded" | "verified" | "rejected";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "disbursed"
  | "cancelled";

export type LoanStatus = "active" | "settled" | "in_arrears" | "written_off";

export type RepaymentStatus = "due" | "paid" | "partial" | "late";

export interface Profile {
  id: string;
  role: UserRole;
  company_id: string | null;
  full_name: string;
  phone: string | null;
  id_number: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  type: DocumentType;
  storage_path: string;
  file_name: string;
  status: DocumentStatus;
  notes: string | null;
  created_at: string;
}

export interface AffordabilityResult {
  disposable_income: number;
  total_repayment?: number;
  max_installment?: number;
  estimated_installment?: number;
  eligible: boolean;
  reasons: string[];
}

export interface LoanApplication {
  id: string;
  user_id: string;
  amount_requested: number;
  term_months: number;
  monthly_income: number;
  monthly_expenses: number;
  existing_debt: number;
  affordability_result: AffordabilityResult | null;
  status: ApplicationStatus;
  admin_notes: string | null;
  next_pay_date: string | null;
  created_at: string;
  submitted_at: string | null;
  // Joined fields
  profiles?: Profile;
}

export interface Loan {
  id: string;
  application_id: string;
  user_id: string;
  principal: number;
  interest_rate: number;
  fees: number;
  admin_fee?: number;
  vat_amount?: number;
  interest_amount?: number;
  total_payable: number;
  start_date: string | null;
  status: LoanStatus;
  created_at: string;
  // Joined fields
  profiles?: Profile;
  loan_applications?: LoanApplication;
}

export interface Repayment {
  id: string;
  loan_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  paid_at: string | null;
  status: RepaymentStatus;
}

export interface Tier {
  id: string;
  name: string;
  min_successful_repayments: number;
  max_loan: number;
  interest_rate: number;
  rules: Record<string, unknown> | null;
}

export interface UserTierHistory {
  id: string;
  user_id: string;
  tier_id: string;
  effective_from: string;
  effective_to: string | null;
  // Joined
  tiers?: Tier;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  // Joined
  profiles?: Profile;
}

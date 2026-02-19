# Mashonisa

A micro-lending web portal where users apply for loans, upload verification documents, and track repayments. Admins review applications, manage disbursements, and monitor the loan book.

## Features

- **User Portal** — Apply for loans, upload ID & payslip, view loan status, track repayments
- **Admin Dashboard** — Review applications, manage active loans, monitor late repayments, view audit logs
- **Tier System** — Users progress from Basic → Silver → Gold → Platinum with increasing loan limits and decreasing interest rates
- **Affordability Checks** — Real-time calculation based on income, expenses, and existing debt (30% disposable income rule)
- **Document Management** — Secure upload and verification of ID documents, payslips, bank statements, and contracts
- **Audit Logging** — Full trail of all system actions

## Tech Stack

- **Framework:** Next.js 16 (App Router, Server Components)
- **Language:** TypeScript
- **Auth & Database:** Supabase (PostgreSQL, Row Level Security, Storage)
- **UI:** shadcn/ui, Tailwind CSS, Lucide Icons
- **Forms:** React Hook Form + Zod validation
- **Notifications:** Sonner (toast notifications)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/MotheoMolefi/mashonisa.git
   cd mashonisa
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the database schema in your Supabase SQL Editor:
   ```
   See supabase/schema.sql
   ```

5. In Supabase → Authentication → URL Configuration, add:
   - Site URL: `http://localhost:3001`
   - Redirect URL: `http://localhost:3001/auth/callback`

6. Start the dev server:
   ```bash
   bun dev
   ```

7. Open [http://localhost:3001](http://localhost:3001)

## Project Structure

```
src/
├── app/
│   ├── admin/          # Admin dashboard & management
│   ├── auth/callback/  # Supabase auth callback handler
│   ├── employee/       # User portal (dashboard, apply, loans, etc.)
│   ├── login/          # Login page
│   ├── signup/         # Signup with OTP verification
│   └── page.tsx        # Landing page
├── components/
│   ├── layout/         # Sidebar navigation
│   └── ui/             # shadcn/ui components
├── lib/
│   ├── supabase/       # Supabase client, server & middleware helpers
│   ├── audit.ts        # Audit logging utility
│   └── utils.ts        # General utilities
├── types/
│   └── database.ts     # TypeScript types for all DB tables
└── middleware.ts        # Auth & role-based route protection
```

## Loan Tiers

| Tier     | Min Months | Max Loan  | Interest Rate |
|----------|-----------|-----------|---------------|
| Basic    | 0         | R1,000    | 5.0% p.m.     |
| Silver   | 3         | R15,000   | 4.0% p.m.     |
| Gold     | 6         | R30,000   | 3.0% p.m.     |
| Platinum | 12        | R50,000   | 2.5% p.m.     |

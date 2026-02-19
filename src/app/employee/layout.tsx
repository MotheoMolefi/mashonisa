export const dynamic = "force-dynamic";

import { SidebarNav } from "@/components/layout/sidebar-nav";

const employeeNav = [
  { title: "Dashboard", href: "/employee", icon: "📊" },
  { title: "Upload Documents", href: "/employee/documents", icon: "📄" },
  { title: "Apply for Loan", href: "/employee/apply", icon: "💰" },
  { title: "My Loans", href: "/employee/loans", icon: "📋" },
  { title: "Repayments", href: "/employee/repayments", icon: "💳" },
  { title: "Settings", href: "/employee/settings", icon: "⚙️" },
];

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav items={employeeNav} title="Employee" />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
    </div>
  );
}

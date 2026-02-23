export const dynamic = "force-dynamic";

import { SidebarNav } from "@/components/layout/sidebar-nav";

const userNav = [
  { title: "Dashboard", href: "/user", icon: "📊" },
  { title: "Upload Documents", href: "/user/documents", icon: "📄" },
  { title: "Apply for Loan", href: "/user/apply", icon: "💰" },
  { title: "My Loans", href: "/user/loans", icon: "📋" },
  { title: "Repayments", href: "/user/repayments", icon: "💳" },
  { title: "Settings", href: "/user/settings", icon: "⚙️" },
];

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav items={userNav} title="User" />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
    </div>
  );
}

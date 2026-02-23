export const dynamic = "force-dynamic";

import { SidebarNav } from "@/components/layout/sidebar-nav";

const adminNav = [
  { title: "Dashboard", href: "/admin", icon: "📊" },
  { title: "Applications", href: "/admin/applications", icon: "📝" },
  { title: "Loans", href: "/admin/loans", icon: "💰" },
  { title: "Documents", href: "/admin/documents", icon: "📄" },
  { title: "Audit Log", href: "/admin/audit", icon: "🔍" },
  { title: "Exports", href: "/admin/exports", icon: "📤" },
  { title: "Settings", href: "/admin/settings", icon: "⚙️" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav items={adminNav} title="Admin" />
      <main className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {children}
      </main>
    </div>
  );
}

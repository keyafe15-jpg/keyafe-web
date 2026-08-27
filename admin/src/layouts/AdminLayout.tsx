import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/nav/Sidebar";
import { TopBar } from "@/components/nav/TopBar";
import { useAdminAuth } from "@/store/adminAuth";

export function AdminLayout() {
  const user = useAdminAuth((s) => s.user);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={mobileNavOpen} />

      {/* Mobile sidebar backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileNavOpen((o) => !o)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

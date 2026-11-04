"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Bell, ChevronDown, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Monitor } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() { await fetch("/api/auth/login", { method: "DELETE" }); router.push("/login"); router.refresh(); }
  const active = (href: string) => path === href || (href !== "/dashboard" && path.startsWith(href));
  return <div className="app-shell">
    <aside className="sidebar"><Link className="sidebar-brand" href="/dashboard"><span className="brand-mark"><Activity size={19} /></span><span>pc<span className="brand-light">monitor</span></span></Link>
      <div className="workspace-pill"><div className="workspace-avatar">M</div><div><strong>Monitoring PC</strong><small>Workspace utama</small></div><ChevronDown size={14} /></div>
      <div className="nav-caption">MENU UTAMA</div><nav className="side-nav"><Link className={active("/dashboard") ? "nav-item active" : "nav-item"} href="/dashboard"><LayoutDashboard size={18} />Overview</Link><Link className={active("/dashboard/devices") ? "nav-item active" : "nav-item"} href="/dashboard/devices"><Monitor size={18} />Perangkat</Link><Link className={active("/dashboard/audit-logs") ? "nav-item active" : "nav-item"} href="/dashboard/audit-logs"><ClipboardList size={18} />Audit log</Link></nav>
      <div className="sidebar-bottom"><div className="nav-caption">BANTUAN & AKUN</div><Link className={active("/dashboard/help") ? "nav-item active" : "nav-item"} href="/dashboard/help"><CircleHelp size={18} />Pusat bantuan</Link><div className="sidebar-profile"><div className="profile-avatar">A</div><div className="profile-copy"><strong>Administrator</strong><small>Admin</small></div><button className="logout-button" onClick={logout} aria-label="Keluar"><LogOut size={16} /></button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{path.includes("devices/") ? "Detail perangkat" : path.includes("devices") ? "Perangkat" : path.includes("audit-logs") ? "Audit log" : path.includes("help") ? "Pusat bantuan" : "Overview"}</strong></div><div className="topbar-right"><div className="system-indicator"><span className="live-dot" />Sistem aktif</div><button className="top-icon" aria-label="Notifikasi"><Bell size={18} /><i /></button><div className="top-avatar">A</div></div></header><div className="page-content">{children}</div></main>
  </div>;
}

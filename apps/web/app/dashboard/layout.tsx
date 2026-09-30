"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Server, 
  Terminal, 
  Settings, 
  LogOut, 
  Activity, 
  Wifi, 
  WifiOff, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * DashboardLayout
 * Layout หลักของหน้าต่างแดชบอร์ด
 * - ตรวจสอบ Auth Session หากไม่มีจะ redirect ไป /login ทันที
 * - Sidebar เมนูนำทาง พร้อมรายละเอียดผู้ใช้
 * - Topbar แสดงสถานะการเชื่อมต่อ WebSocket แบบ Real-Time (🟢 เชื่อมต่อแล้ว / 🔴 ขาดการเชื่อมต่อ)
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { isConnected, connectionError } = useSocket();

  // ตรวจสอบสิทธิ์การเข้าใช้งาน
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // ขณะกำลังโหลด Auth State ให้แสดง Skeleton ก่อน
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wide">กำลังยืนยันตัวตนความปลอดภัย...</p>
      </div>
    );
  }

  const navItems = [
    {
      label: "แดชบอร์ดหลัก",
      href: "/dashboard",
      icon: Server,
      active: pathname === "/dashboard",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* ── แถบ Sidebar ด้านซ้าย ────────────────────────────── */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl flex flex-col justify-between shrink-0">
        <div>
          {/* ส่วนหัว Sidebar: โลโก้และชื่อโปรแกรม */}
          <div className="p-6 border-b border-zinc-800/60 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Server className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <Link href="/dashboard" className="font-bold text-base tracking-wide text-zinc-100 flex items-center gap-1.5">
                MINECRAFT <span className="text-emerald-400 font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">CORE</span>
              </Link>
              <p className="text-[11px] text-zinc-500 font-mono">Windows Host Panel</p>
            </div>
          </div>

          {/* รายการเมนูนำทาง */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    item.active
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.active && <ChevronRight className="w-4 h-4 text-emerald-400" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ส่วนท้าย Sidebar: ข้อมูลโปรไฟล์ผู้ใช้และปุ่ม Logout */}
        <div className="p-4 border-t border-zinc-800/60">
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs uppercase shrink-0">
                  {user?.username.slice(0, 2)}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-zinc-200 truncate">{user?.displayName || user?.username}</div>
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {user?.role}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800/80 hover:border-red-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* ── พื้นที่เนื้อหาหลักด้านขวา ────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar แถบแจ้งเตือนสถานะด้านบน */}
        <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>ระบบจัดการเบื้องหลัง:</span>
            <span className="text-zinc-200">Online 1.21.x Multi-Process</span>
          </div>

          {/* ป้ายแสดงสถานะการเชื่อมต่อ WebSocket */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wifi className="w-3.5 h-3.5" />
                <span>Socket Connected</span>
              </div>
            ) : (
              <div
                title={connectionError || "กำลังพยายามเชื่อมต่อใหม่..."}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <WifiOff className="w-3.5 h-3.5" />
                <span>Socket Disconnected</span>
              </div>
            )}
          </div>
        </header>

        {/* พื้นที่ Content ย่อย */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

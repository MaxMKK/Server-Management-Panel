"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Terminal, Shield, Server, Activity, ArrowRight, CheckCircle2, User, LogOut, ShieldAlert } from "lucide-react";

interface UserProfile {
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // ตรวจสอบสถานะการเข้าสู่ระบบจาก LocalStorage และ API
  useEffect(() => {
    const savedProfile = localStorage.getItem("user_profile");
    if (savedProfile) {
      try {
        setCurrentUser(JSON.parse(savedProfile));
      } catch (_e) {
        // ignore
      }
    }

    const token = localStorage.getItem("session_token");
    if (token) {
      fetch("http://localhost:4000/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setCurrentUser(data.data);
            localStorage.setItem("user_profile", JSON.stringify(data.data));
          } else {
            // โทเค็นหมดอายุ
            setCurrentUser(null);
            localStorage.removeItem("session_token");
            localStorage.removeItem("user_profile");
          }
        })
        .catch(() => {
          // หาก backend ขัดข้อง ให้ใช้ข้อมูล cache เดิม
        });
    }
  }, []);

  // ฟังก์ชันออกจากระบบ
  const handleLogout = () => {
    const token = localStorage.getItem("session_token");
    if (token) {
      fetch("http://localhost:4000/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("session_token");
    localStorage.removeItem("user_profile");
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 md:p-12 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* ส่วนหัวของหน้าเว็บ (Header) */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Server className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide text-zinc-100 flex items-center gap-2">
              MINECRAFT <span className="text-emerald-400 font-mono text-sm px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">PANEL</span>
            </h1>
            <p className="text-xs text-zinc-500">Multi-Instance Windows Management Core</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Operational
          </span>

          {/* ตรวจสอบว่าเข้าสู่ระบบแล้วหรือยัง */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="font-semibold text-zinc-200">{currentUser.username}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors border border-zinc-800"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-medium px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700/50"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* เนื้อหาหลักของหน้าเว็บ (Hero Section) */}
      <main className="max-w-6xl w-full mx-auto my-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6 text-left">
          {/* Badge แสดงสถานะ Session ล่าสุด */}
          {currentUser ? (
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-300 bg-emerald-950/60 border border-emerald-600/50 px-3.5 py-1.5 rounded-md shadow-sm">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Authenticated Session Active: {currentUser.role} Access (28 Permissions)
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-md">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Guest Session — Please Sign In
            </div>
          )}

          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            High-Performance Control for Multiple <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Paper Servers</span>
          </h2>

          <p className="text-zinc-400 text-base md:text-lg max-w-xl leading-relaxed">
            Engineered natively for Windows host environments. Real-time RCON socket streaming, 
            granular child process telemetry, zero-trust RBAC, and automated scheduler pipelines.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-semibold shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                Access Server Controls
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-semibold shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5"
              >
                Sign In to Control
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            <a
              href="http://localhost:4000/api/health"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 font-medium border border-zinc-800 transition-colors"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              API Health Node
            </a>
          </div>

          {/* สถิติและจุดเด่นหลักของระบบ */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/60 max-w-lg">
            <div>
              <div className="text-2xl font-bold font-mono text-zinc-100">0.0ms</div>
              <div className="text-xs text-zinc-500">Pipe Latency</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-emerald-400">Multi</div>
              <div className="text-xs text-zinc-500">Instance Sandbox</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-cyan-400">RBAC</div>
              <div className="text-xs text-zinc-500">SQLite Database</div>
            </div>
          </div>
        </div>

        {/* การ์ดจำลองหน้าจอ Console (Dark Gaming UI) */}
        <div className="lg:col-span-5 w-full">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="text-xs text-zinc-400 font-mono ml-2">daemon://windows-service</span>
              </div>
              <Terminal className="w-4 h-4 text-zinc-500" />
            </div>

            <div className="p-5 font-mono text-xs space-y-2 text-zinc-400 bg-black/40">
              <p className="text-emerald-400">✓ Monorepo Architecture: Turborepo + npm workspaces</p>
              <p className="text-zinc-300">✓ Fastify Core API: Port 4000 (Active)</p>
              <p className="text-zinc-300">✓ Next.js 15 Web Core: Port 3000 (Active)</p>
              <p className="text-zinc-300">✓ Database: SQLite (dev.db synchronized via Prisma)</p>
              <p className="text-zinc-500">------------------------------------------</p>
              <p className="text-cyan-400 flex items-center gap-1">
                <Shield className="w-3 h-3 inline" /> 
                {currentUser ? `Active Operator: ${currentUser.username} (${currentUser.role})` : "Zero-Trust: No Operator Authenticated"}
              </p>
              <div className="pt-2 flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
                <span>Phase 2 Database & Auth Verified</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ส่วนท้ายของหน้าเว็บ (Footer) */}
      <footer className="max-w-6xl w-full mx-auto border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div>Minecraft Server Management Panel © 2026. Production Standard.</div>
        <div className="flex gap-6 font-mono">
          <span>Backend: Fastify 5.x</span>
          <span>Database: SQLite</span>
          <span>Theme: Dark Gaming</span>
        </div>
      </footer>
    </div>
  );
}

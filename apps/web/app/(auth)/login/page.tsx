"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Server, Lock, User, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ฟังก์ชันส่งคำขอล็อกอินไปยัง Backend API
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Invalid username or password");
      }

      // บันทึก Token ใน LocalStorage สำหรับ Client-side API Calls (และมี HTTP-Only Cookie อยู่แล้ว)
      if (data.data?.token) {
        localStorage.setItem("session_token", data.data.token);
        localStorage.setItem("user_profile", JSON.stringify(data.data.user));
      }

      // ย้ายหน้าไปยัง Dashboard
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* การ์ดฟอร์มเข้าสู่ระบบ */}
      <div className="max-w-md w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl space-y-6">
        {/* โลโก้และหัวข้อ */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-0.5 items-center justify-center shadow-lg shadow-emerald-500/20 mb-2">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign In to Dashboard</h1>
          <p className="text-xs text-zinc-400">Minecraft Server Multi-Instance Control Panel</p>
        </div>

        {/* แสดงข้อความแจ้งเตือนเมื่อเกิดข้อผิดพลาด */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ฟอร์มเข้าสู่ระบบด้วย Username & Password */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1 text-left">
            <label className="text-xs font-mono text-zinc-400">Username</label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-mono text-zinc-400">Password</label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-semibold shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 text-sm cursor-pointer"
          >
            {loading ? "Authenticating..." : "Sign In with Credentials"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* เส้นคั่น */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-800/80 w-full"></div>
          <span className="bg-zinc-950 px-3 text-[11px] font-mono text-zinc-500 uppercase tracking-widest absolute">
            or
          </span>
        </div>

        {/* ปุ่มเข้าสู่ระบบด้วย Discord OAuth */}
        <button
          type="button"
          onClick={() => alert("Discord OAuth2 integration: Configurable via AUTH_DISCORD_ID in .env")}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2]/30 border border-[#5865F2]/40 text-[#5865F2] font-semibold transition-colors text-sm cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Continue with Discord
        </button>

        {/* ข้อมูลช่วยเหลือ */}
        <div className="pt-2 text-center">
          <p className="text-[11px] text-zinc-500 font-mono flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Default Owner credentials seeded: admin / admin1234
          </p>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            ← Return to Dashboard Landing
          </Link>
        </div>
      </div>
    </div>
  );
}

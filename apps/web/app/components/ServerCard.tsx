"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Play, 
  Square, 
  RotateCw, 
  Skull, 
  Terminal, 
  Users, 
  Cpu, 
  HardDrive, 
  Clock, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { ServerInfo, ServerState } from "@minecraft-panel/shared";
import { useServerActions } from "../hooks/useServerActions";

interface ServerCardProps {
  server: ServerInfo;
  onRefresh?: () => void;
}

/** ฟังก์ชันแปลงวินาทีเป็นรูปแบบเวลาที่อ่านง่าย เช่น 2h 15m */
function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * ServerCard Component
 * การ์ดแสดงสถานะและข้อมูลหลักของเซิร์ฟเวอร์แต่ละตัว
 * - แสดงสถานะพร้อมแสงเรือง (Glow Effect) ตามสถานะ
 * - แสดง Metrics สำคัญ (CPU, RAM, Uptime, ผู้เล่น)
 * - ปุ่มควบคุมรวดเร็ว (Start, Stop, Restart, Kill) พร้อมกล่องยืนยัน Kill
 */
export function ServerCard({ server, onRefresh }: ServerCardProps) {
  const { config, status } = server;
  const { actionState, startServer, stopServer, restartServer, killServer } = useServerActions();
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  // กำหนดสไตล์ สี และไอคอนตาม ServerState
  const stateConfig = {
    [ServerState.ONLINE]: {
      label: "ONLINE",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      dotClass: "bg-emerald-400 animate-pulse",
      glowBorder: "border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-500/5 hover:shadow-emerald-500/10",
    },
    [ServerState.STARTING]: {
      label: "STARTING",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      dotClass: "bg-amber-400 animate-ping",
      glowBorder: "border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5 hover:shadow-amber-500/10",
    },
    [ServerState.STOPPING]: {
      label: "STOPPING",
      badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      dotClass: "bg-orange-400 animate-pulse",
      glowBorder: "border-orange-500/30 hover:border-orange-500/60 shadow-orange-500/5 hover:shadow-orange-500/10",
    },
    [ServerState.CRASHED]: {
      label: "CRASHED",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/30",
      dotClass: "bg-red-400",
      glowBorder: "border-red-500/30 hover:border-red-500/60 shadow-red-500/5 hover:shadow-red-500/10",
    },
    [ServerState.OFFLINE]: {
      label: "OFFLINE",
      badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-700/50",
      dotClass: "bg-zinc-500",
      glowBorder: "border-zinc-800/80 hover:border-zinc-700 shadow-none",
    },
  }[status.state] || {
    label: status.state,
    badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotClass: "bg-zinc-500",
    glowBorder: "border-zinc-800",
  };

  const isOnline = status.state === ServerState.ONLINE;
  const isOffline = status.state === ServerState.OFFLINE;
  const isBusy = actionState.loading || status.state === ServerState.STARTING || status.state === ServerState.STOPPING;

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await startServer(config.id);
    if (ok && onRefresh) onRefresh();
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await stopServer(config.id);
    if (ok && onRefresh) onRefresh();
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await restartServer(config.id);
    if (ok && onRefresh) onRefresh();
  };

  const handleKill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await killServer(config.id);
    setShowKillConfirm(false);
    if (ok && onRefresh) onRefresh();
  };

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl bg-zinc-900/70 backdrop-blur-md p-6 border transition-all duration-300 shadow-xl ${stateConfig.glowBorder}`}
    >
      {/* ส่วนหัวการ์ด: ข้อมูลชื่อและสถานะ */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-zinc-100 tracking-tight group-hover:text-emerald-400 transition-colors">
                {config.name}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                :{config.gamePort}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">{config.slug}</p>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${stateConfig.badgeClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${stateConfig.dotClass}`} />
            {stateConfig.label}
          </div>
        </div>

        {/* ข้อมูล Metrics แบบ Grid 4 ช่อง */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>ผู้เล่น</span>
            </div>
            <div className="font-mono text-base font-bold text-zinc-100">
              {isOnline ? `${status.playerCount} / ${status.maxPlayers}` : "- / -"}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>ซีพียู (CPU)</span>
            </div>
            <div className="font-mono text-base font-bold text-zinc-100">
              {isOnline ? `${status.cpuPercent.toFixed(1)}%` : "-"}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>หน่วยความจำ (RAM)</span>
            </div>
            <div className="font-mono text-base font-bold text-zinc-100">
              {isOnline ? `${Math.round(status.memoryUsageMB)} MB` : "-"}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-3">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>ระยะเวลาทำงาน</span>
            </div>
            <div className="font-mono text-base font-bold text-zinc-100">
              {isOnline ? formatUptime(status.uptimeSeconds) : "-"}
            </div>
          </div>
        </div>

        {/* แสดงข้อความแจ้งเตือน Error หากมี */}
        {actionState.error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{actionState.error}</span>
          </div>
        )}
      </div>

      {/* แถบปุ่ม Action ด้านล่างของการ์ด */}
      <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/server/${config.id}`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/50 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          คอนโซล
        </Link>

        <div className="flex items-center gap-1.5">
          {/* ปุ่มเริ่มเซิร์ฟเวอร์ (Start) */}
          {(isOffline || status.state === ServerState.CRASHED) && (
            <button
              onClick={handleStart}
              disabled={isBusy}
              title="เริ่มเซิร์ฟเวอร์"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {actionState.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              เปิด
            </button>
          )}

          {/* ปุ่มปิดเซิร์ฟเวอร์ (Stop) */}
          {isOnline && (
            <button
              onClick={handleStop}
              disabled={isBusy}
              title="ปิดเซิร์ฟเวอร์อย่างปลอดภัย"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {actionState.loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Square className="w-3.5 h-3.5 fill-current" />
              )}
              ปิด
            </button>
          )}

          {/* ปุ่มรีสตาร์ท (Restart) */}
          {isOnline && (
            <button
              onClick={handleRestart}
              disabled={isBusy}
              title="รีสตาร์ทเซิร์ฟเวอร์"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ปุ่มบังคับปิดทันที (Kill) พร้อม Popup ยืนยัน */}
          {!isOffline && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowKillConfirm(!showKillConfirm);
                }}
                disabled={actionState.loading}
                title="บังคับหยุดกระบวนการทำงานทันที (Kill)"
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Skull className="w-3.5 h-3.5" />
              </button>

              {showKillConfirm && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-2 w-52 p-3 rounded-xl bg-zinc-950 border border-red-500/50 shadow-2xl z-20 text-left"
                >
                  <p className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 mb-1 text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> บังคับปิดทันที?
                  </p>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    ข้อมูลเกมที่ยังไม่เซฟอาจสูญหาย
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setShowKillConfirm(false)}
                      className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleKill}
                      className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold"
                    >
                      ยืนยัน Kill
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

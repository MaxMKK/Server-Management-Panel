"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Play, 
  Square, 
  RotateCw, 
  Skull, 
  Terminal, 
  Users, 
  Server as ServerIcon, 
  Cpu, 
  HardDrive, 
  Layers, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { 
  ServerInfo, 
  ServerState, 
  WsEvent, 
  ConsoleOutput, 
  MetricsUpdate, 
  PlayerEvent 
} from "@minecraft-panel/shared";
import { apiFetch } from "../../../lib/api";
import { useSocket } from "../../../hooks/useSocket";
import { useServerActions } from "../../../hooks/useServerActions";
import { ConsoleTerminal } from "../../../components/ConsoleTerminal";
import { MetricsGauge } from "../../../components/MetricsGauge";
import { MetricsChart, MetricDataPoint } from "../../../components/MetricsChart";

interface ServerConsolePageProps {
  params: Promise<{ id: string }>;
}

/**
 * ServerConsolePage
 * หน้าควบคุมเซิร์ฟเวอร์แบบเจาะลึก
 * - หน้าต่าง Live Console เต็มตา รองรับ Replay ย้อนหลัง 50 บรรทัด + Stream Real-Time
 * - ส่งคำสั่งตรงเข้า stdin / RCON ผ่าน WebSocket
 * - แสดงสถานะ และ Metrics Gauge + Canvas History Chart
 * - ปุ่มคำสั่ง Start / Stop / Restart / Kill
 */
export default function ServerConsolePage({ params }: ServerConsolePageProps) {
  const resolvedParams = use(params);
  const serverId = resolvedParams.id;
  const router = useRouter();

  const [server, setServer] = useState<ServerInfo | null>(null);
  const [logs, setLogs] = useState<ConsoleOutput[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<MetricDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  const { socket, isConnected } = useSocket();
  const { actionState, startServer, stopServer, restartServer, killServer } = useServerActions();

  // 1. ดึงข้อมูลรายละเอียดของเซิร์ฟเวอร์นี้
  const fetchServerDetails = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch<ServerInfo>(`/servers/${serverId}`);
      if (res.success && res.data) {
        setServer(res.data);
      } else {
        setFetchError(res.error?.message || "ไม่พบข้อมูลเซิร์ฟเวอร์");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงข้อมูลเซิร์ฟเวอร์");
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchServerDetails();
  }, [fetchServerDetails]);

  // 2. ดึง Log ย้อนหลังจาก API (กรณี WebSocket ยังไม่เชื่อมต่อหรือโหลดหน้าแรก)
  useEffect(() => {
    apiFetch<ConsoleOutput[]>(`/servers/${serverId}/logs?limit=50`).then((res) => {
      if (res.success && res.data && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    }).catch(() => {});
  }, [serverId]);

  // 3. จัดการเชื่อมต่อ WebSocket เข้ารับข้อมูลของ Room เซิร์ฟเวอร์นี้
  useEffect(() => {
    if (!socket || !isConnected) return;

    // ส่งคำขอเข้าห้องเซิร์ฟเวอร์
    socket.emit(WsEvent.JOIN_SERVER, { serverId });

    // ดักรับข้อความ Console ใหม่
    const handleConsoleOutput = (output: ConsoleOutput) => {
      if (output.serverId === serverId) {
        setLogs((prev) => [...prev.slice(-499), output]); // เก็บประวัติสูงสุด 500 บรรทัดบนหน้าจอ
      }
    };

    // ดักรับการเปลี่ยนสถานะเซิร์ฟเวอร์
    const handleStateChange = (data: { serverId: string; newState: ServerState }) => {
      if (data.serverId === serverId) {
        setServer((prev) => (prev ? { ...prev, status: { ...prev.status, state: data.newState } } : null));
      }
    };

    // ดักรับข้อมูลสถิติ Metrics (CPU / RAM)
    const handleMetricsUpdate = (data: MetricsUpdate) => {
      if (data.serverId === serverId) {
        setServer((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: {
              ...prev.status,
              cpuPercent: data.cpuPercent,
              memoryUsageMB: data.memoryUsageMB,
              playerCount: data.playerCount,
            },
          };
        });

        // บันทึกลงประวัติกราฟ
        setMetricsHistory((prev) => [
          ...prev.slice(-29),
          {
            time: new Date(data.timestamp).toLocaleTimeString(),
            cpu: data.cpuPercent,
            memoryMB: data.memoryUsageMB,
          },
        ]);
      }
    };

    socket.on(WsEvent.CONSOLE_OUTPUT, handleConsoleOutput);
    socket.on(WsEvent.SERVER_STATE_CHANGE, handleStateChange);
    socket.on(WsEvent.METRICS_UPDATE, handleMetricsUpdate);

    // ออกจากห้องเมื่อออกจากหน้านี้
    return () => {
      socket.emit(WsEvent.LEAVE_SERVER, { serverId });
      socket.off(WsEvent.CONSOLE_OUTPUT, handleConsoleOutput);
      socket.off(WsEvent.SERVER_STATE_CHANGE, handleStateChange);
      socket.off(WsEvent.METRICS_UPDATE, handleMetricsUpdate);
    };
  }, [socket, isConnected, serverId]);

  // ฟังก์ชันส่งคำสั่ง Console ไปยัง Backend
  const handleSendCommand = (cmd: string) => {
    if (socket && isConnected) {
      socket.emit(WsEvent.CONSOLE_COMMAND, {
        serverId,
        command: cmd,
      });
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  if (isLoading && !server) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
        <p className="text-sm font-mono">กำลังเชื่อมต่อไปยังโฮสต์คอนโซล...</p>
      </div>
    );
  }

  if (fetchError || !server) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-zinc-100">ไม่สามารถเปิดหน้าต่างนี้ได้</h2>
        <p className="text-sm text-zinc-400 mt-2 mb-6">{fetchError || "ไม่พบข้อมูลเซิร์ฟเวอร์ที่ระบุ"}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> กลับสู่หน้าแดชบอร์ด
        </Link>
      </div>
    );
  }

  const { config, status } = server;
  const isOnline = status.state === ServerState.ONLINE;
  const isOffline = status.state === ServerState.OFFLINE;
  const isBusy = actionState.loading || status.state === ServerState.STARTING || status.state === ServerState.STOPPING;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-8.5rem)] flex flex-col">
      {/* ── ส่วนหัวหน้า Console: ปุ่มย้อนกลับ ชื่อ และชุดคำสั่ง ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">{config.name}</h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                Port: {config.gamePort}
              </span>
              <span
                className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : status.state === ServerState.STARTING
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {status.state}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              ไดเรกทอรี: {config.rootPath}
            </p>
          </div>
        </div>

        {/* ปุ่มควบคุมคำสั่ง (Start, Stop, Restart, Kill) */}
        <div className="flex items-center gap-2">
          {(isOffline || status.state === ServerState.CRASHED) && (
            <button
              onClick={() => startServer(config.id)}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {actionState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              เริ่มเซิร์ฟเวอร์
            </button>
          )}

          {isOnline && (
            <button
              onClick={() => stopServer(config.id)}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {actionState.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
              หยุดการทำงาน
            </button>
          )}

          {isOnline && (
            <button
              onClick={() => restartServer(config.id)}
              disabled={isBusy}
              title="รีสตาร์ทเซิร์ฟเวอร์"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          {!isOffline && (
            <div className="relative">
              <button
                onClick={() => setShowKillConfirm(!showKillConfirm)}
                disabled={actionState.loading}
                title="บังคับหยุดกระบวนการทันที (Kill)"
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Skull className="w-4 h-4" />
              </button>

              {showKillConfirm && (
                <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-xl bg-zinc-950 border border-red-500/50 shadow-2xl z-30">
                  <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> บังคับปิดทันที?
                  </p>
                  <p className="text-[11px] text-zinc-400 mb-2">ข้อมูลเกมที่ยังไม่บันทึกอาจสูญหาย</p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setShowKillConfirm(false)}
                      className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => {
                        killServer(config.id);
                        setShowKillConfirm(false);
                      }}
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

      {/* ── พื้นที่คอนโซลหลัก + Sidebar สถิติทางขวา ──────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* หน้าต่าง Live Console (กินพื้นที่ 8 หรือ 9 คอลัมน์) */}
        <div className="lg:col-span-8 xl:col-span-9 h-full min-h-[400px]">
          <ConsoleTerminal
            logs={logs}
            onSendCommand={handleSendCommand}
            onClearLogs={handleClearLogs}
            disabled={!isOnline}
          />
        </div>

        {/* แถบข้างขวา: Metrics, Gauges, ข้อมูลคอนฟิก */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 overflow-y-auto pr-1">
          {/* Gauges วงกลม CPU / RAM */}
          <div className="grid grid-cols-2 gap-3">
            <MetricsGauge
              label="การใช้งาน CPU"
              value={status.cpuPercent}
              displayValue={isOnline ? `${status.cpuPercent.toFixed(1)}%` : "0%"}
              unit="CPU"
            />
            <MetricsGauge
              label="การใช้งาน RAM"
              value={isOnline ? Math.min((status.memoryUsageMB / 4096) * 100, 100) : 0}
              displayValue={isOnline ? `${Math.round(status.memoryUsageMB)}` : "0"}
              unit="MB"
            />
          </div>

          {/* กราฟประวัติการใช้ทรัพยากร */}
          <MetricsChart data={metricsHistory} maxMemoryMB={4096} />

          {/* ข้อมูลการเชื่อมต่อเซิร์ฟเวอร์ */}
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <h4 className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
              ข้อมูลเซิร์ฟเวอร์
            </h4>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">สถานะ Process ID:</span>
                <span className="text-zinc-200">{status.pid || "-"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">ผู้เล่นออนไลน์:</span>
                <span className="text-emerald-400 font-bold">
                  {status.playerCount} / {status.maxPlayers}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">พอร์ต RCON:</span>
                <span className="text-zinc-200">{config.rconPort}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-900">
                <span className="text-zinc-500">ไฟล์ Core Jar:</span>
                <span className="text-zinc-200 truncate max-w-[120px]">{config.jarFile}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">หน่วยความจำสูงสุด:</span>
                <span className="text-zinc-200">{config.maxMemory}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

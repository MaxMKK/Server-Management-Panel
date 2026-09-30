"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  Server, 
  RotateCw, 
  Plus, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Layers
} from "lucide-react";
import { ServerInfo, ServerState, WsEvent, MetricsUpdate } from "@minecraft-panel/shared";
import { apiFetch } from "../lib/api";
import { useSocket } from "../hooks/useSocket";
import { ServerCard } from "../components/ServerCard";

/**
 * DashboardPage
 * หน้าหลักรวมรายการเซิร์ฟเวอร์ Minecraft ทั้งหมด
 * - ดึงข้อมูลเซิร์ฟเวอร์เริ่มต้นผ่าน GET /api/servers
 * - รับฟังการเปลี่ยนแปลงสถานะเซิร์ฟเวอร์แบบ Real-Time จาก WebSocket (server:state-change)
 * - รับฟัง Metrics อัปเดตแบบ Real-Time จาก WebSocket (metrics:update)
 */
export default function DashboardPage() {
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { socket } = useSocket();

  // ฟังก์ชันดึงข้อมูลเซิร์ฟเวอร์ทั้งหมดจาก Backend API
  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch<ServerInfo[]>("/servers");
      if (res.success && res.data) {
        setServers(res.data);
      } else {
        setFetchError(res.error?.message || "ไม่สามารถโหลดข้อมูลเซิร์ฟเวอร์ได้");
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ดึงข้อมูลครั้งแรกเมื่อเปิดหน้า
  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // ดักฟังเหตุการณ์ Real-time จาก Socket.io
  useEffect(() => {
    if (!socket) return;

    // 1. รับฟังการเปลี่ยนสถานะ เช่น OFFLINE -> STARTING -> ONLINE
    const handleStateChange = (data: { serverId: string; previousState: ServerState; newState: ServerState }) => {
      setServers((prevServers) =>
        prevServers.map((srv) => {
          if (srv.config.id === data.serverId) {
            return {
              ...srv,
              status: {
                ...srv.status,
                state: data.newState,
              },
            };
          }
          return srv;
        })
      );
    };

    // 2. รับฟัง Metrics อัปเดต CPU/RAM แบบ Real-time
    const handleMetricsUpdate = (data: MetricsUpdate) => {
      setServers((prevServers) =>
        prevServers.map((srv) => {
          if (srv.config.id === data.serverId) {
            return {
              ...srv,
              status: {
                ...srv.status,
                cpuPercent: data.cpuPercent,
                memoryUsageMB: data.memoryUsageMB,
                playerCount: data.playerCount,
              },
            };
          }
          return srv;
        })
      );
    };

    socket.on(WsEvent.SERVER_STATE_CHANGE, handleStateChange);
    socket.on(WsEvent.METRICS_UPDATE, handleMetricsUpdate);

    return () => {
      socket.off(WsEvent.SERVER_STATE_CHANGE, handleStateChange);
      socket.off(WsEvent.METRICS_UPDATE, handleMetricsUpdate);
    };
  }, [socket]);

  // คำนวณสรุปสถิติภาพรวม
  const totalServers = servers.length;
  const onlineServers = servers.filter((s) => s.status.state === ServerState.ONLINE).length;
  const totalPlayers = servers.reduce((acc, s) => acc + (s.status.state === ServerState.ONLINE ? s.status.playerCount : 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ส่วนหัวหน้า Dashboard และสถิติสรุป */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            จัดการอินสแตนซ์เซิร์ฟเวอร์
            <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {totalServers} อินสแตนซ์
            </span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            ควบคุม ตรวจสอบสถานะ และดูข้อมูลรีซอร์สเซิร์ฟเวอร์ Minecraft ทุกตัวบนเครื่อง
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchServers}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* แถบสรุปสถิติ 3 คอลัมน์ด้านบน */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">เซิร์ฟเวอร์ที่ออนไลน์</div>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {onlineServers} <span className="text-sm font-normal text-zinc-500">/ {totalServers}</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">ผู้เล่นออนไลน์รวม</div>
            <div className="text-2xl font-bold font-mono text-cyan-400">
              {totalPlayers} <span className="text-sm font-normal text-zinc-500">คน</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-medium">สถานะโฮสต์ Windows</div>
            <div className="text-2xl font-bold font-mono text-zinc-100">พร้อมใช้งาน</div>
          </div>
        </div>
      </div>

      {/* กล่องแจ้งเตือน Error เมื่อดึงข้อมูลไม่สำเร็จ */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* รายการเซิร์ฟเวอร์ทั้งหมด */}
      <div>
        {isLoading && servers.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-64 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="h-6 w-32 bg-zinc-800 rounded" />
                  <div className="h-4 w-20 bg-zinc-800/60 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-14 bg-zinc-800/40 rounded-xl" />
                  <div className="h-14 bg-zinc-800/40 rounded-xl" />
                </div>
                <div className="h-9 bg-zinc-800/50 rounded-lg" />
              </div>
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20">
            <Server className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-zinc-300">ยังไม่มีเซิร์ฟเวอร์ในระบบ</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              ยังไม่มีการลงทะเบียนเซิร์ฟเวอร์ Minecraft ใดๆ บนฐานข้อมูล
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {servers.map((server) => (
              <ServerCard
                key={server.config.id}
                server={server}
                onRefresh={fetchServers}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

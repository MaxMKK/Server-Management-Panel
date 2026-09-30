"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Trash2, 
  CornerDownLeft, 
  Terminal as TerminalIcon, 
  ChevronRight,
  ArrowDown
} from "lucide-react";
import { ConsoleOutput } from "@minecraft-panel/shared";

interface ConsoleTerminalProps {
  logs: ConsoleOutput[];
  onSendCommand: (command: string) => void;
  onClearLogs?: () => void;
  disabled?: boolean;
}

/** ฟังก์ชันจัดรูปแบบสีข้อความ Log ตามระดับเลเวล Minecraft */
function renderColoredLog(line: string) {
  // ตรวจสอบระดับข้อความจาก Tag หรือคำสำคัญ
  if (line.includes("[ERROR]") || line.includes("FATAL") || line.includes("Exception") || line.includes("Error:")) {
    return <span className="text-red-400 font-medium">{line}</span>;
  }
  if (line.includes("[WARN]") || line.includes("WARNING")) {
    return <span className="text-amber-400">{line}</span>;
  }
  if (line.includes("[INFO]")) {
    return <span className="text-zinc-300">{line}</span>;
  }
  return <span className="text-zinc-400">{line}</span>;
}

/**
 * ConsoleTerminal Component
 * หน้าจอ Console แสดงผล Log แบบ Terminal จริง
 * - ดักจับ Auto-Scroll ด้านล่างตลอดเวลาเมื่อมี Log ใหม่เข้ามา
 * - ช่องรับคำสั่งด้านล่างพร้อมรองรับปุ่มลูกศร ขึ้น/ลง (Command History)
 * - ปุ่มล้างหน้าจอแสดงผล (Clear Display)
 */
export function ConsoleTerminal({
  logs,
  onSendCommand,
  onClearLogs,
  disabled = false,
}: ConsoleTerminalProps) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // เลื่อนลงล่างอัตโนมัติเมื่อ logs เปลี่ยนแปลง
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // ส่งคำสั่ง
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || disabled) return;

    onSendCommand(trimmed);

    // เก็บลงประวัติคำสั่ง (ไม่ซ้ำกับคำสั่งก่อนหน้า)
    setHistory((prev) => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
    setHistoryIndex(-1);
    setCommand("");
  };

  // จัดการการกดปุ่มลูกศรขึ้น-ลงเพื่อดึงคำสั่งเดิมมาใช้
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (history.length === 0) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand("");
      } else {
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex]);
      }
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl overflow-hidden">
      {/* ส่วนหัวคอนโซล */}
      <div className="h-11 px-4 bg-zinc-900/60 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-mono font-medium text-zinc-300">
            คอนโซลเซิร์ฟเวอร์แบบเรียลไทม์
          </span>
          <span className="text-[11px] font-mono text-zinc-500">({logs.length} บรรทัด)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scrollToBottom}
            title="เลื่อนลงล่างสุด"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              title="ล้างหน้าจอแสดงผล"
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* หน้าต่างแสดงบรรทัดข้อความ Log */}
      <div
        ref={scrollRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text bg-[#09090b]"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs select-none">
            ไม่มีข้อความจากคอนโซล (เซิร์ฟเวอร์อาจยังไม่ได้เริ่มทำงาน)
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2 hover:bg-zinc-900/40 px-1 py-0.5 rounded">
              <span className="text-zinc-600 select-none text-[10px] shrink-0 pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString("th-TH")}
              </span>
              <div className="break-all whitespace-pre-wrap flex-1">
                {renderColoredLog(log.line)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* แถบส่งคำสั่งด้านล่าง */}
      <form
        onSubmit={handleSubmit}
        className="h-12 border-t border-zinc-800/80 bg-zinc-900/40 px-3 flex items-center gap-2 shrink-0"
      >
        <span className="text-emerald-400 font-mono text-sm font-bold pl-1 select-none">
          &gt;_
        </span>

        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "เซิร์ฟเวอร์ออฟไลน์ — ไม่สามารถส่งคำสั่งได้" : "พิมพ์คำสั่ง Minecraft (เช่น help, say สวัสดี, list)..."}
          className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-zinc-100 placeholder-zinc-500 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={disabled || !command.trim()}
          className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}

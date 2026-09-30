"use client";

import React, { useEffect, useRef } from "react";

export interface MetricDataPoint {
  time: string;
  cpu: number;
  memoryMB: number;
}

interface MetricsChartProps {
  data: MetricDataPoint[];
  maxMemoryMB?: number;
}

/**
 * MetricsChart Component
 * กราฟเส้น Real-Time 2 เส้น (CPU % และ RAM MB) ย้อนหลัง 60 วินาที
 * วาดด้วย Canvas API บริสุทธิ์ (ไม่ต้องพึ่งไลบรารีกราฟภายนอก)
 */
export function MetricsChart({ data, maxMemoryMB = 4096 }: MetricsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // คำนวณความละเอียดจอภาพ (HiDPI / Retina display)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // ล้างหน้าจอ
    ctx.clearRect(0, 0, width, height);

    // เส้นตารางพื้นหลัง (Grid Lines)
    ctx.strokeStyle = "rgba(63, 63, 70, 0.25)";
    ctx.lineWidth = 1;

    for (let i = 1; i <= 4; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // ข้อความกำกับแกน Y
      ctx.fillStyle = "rgba(161, 161, 170, 0.5)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      const pct = Math.round(100 - (i * 20));
      ctx.fillText(`${pct}%`, 30, y + 3);
    }

    if (data.length < 2) {
      // หากข้อมูลยังไม่พอวาดเส้น ให้แสดงข้อความรอ
      ctx.fillStyle = "rgba(161, 161, 170, 0.6)";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("กำลังรวบรวมข้อมูล Telemetry...", width / 2, height / 2);
      return;
    }

    const paddingLeft = 35;
    const paddingRight = 10;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - 20;

    const points = data.slice(-30); // แสดงข้อมูลสูงสุด 30 จุด (60 วินาที)
    const stepX = plotWidth / (Math.max(points.length - 1, 1));

    // ── 1. วาดเส้นและพื้นที่เรืองแสงของ CPU (%) ────────────────────────
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = paddingLeft + idx * stepX;
      const normalizedCpu = Math.min(Math.max(p.cpu, 0), 100);
      const y = plotHeight - (normalizedCpu / 100) * plotHeight + 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#10b981"; // emerald-500
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── 2. วาดเส้นของ RAM (%) ──────────────────────────────────────────
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = paddingLeft + idx * stepX;
      const memPct = Math.min(Math.max((p.memoryMB / maxMemoryMB) * 100, 0), 100);
      const y = plotHeight - (memPct / 100) * plotHeight + 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#06b6d4"; // cyan-500
    ctx.lineWidth = 2;
    ctx.stroke();

  }, [data, maxMemoryMB]);

  return (
    <div className="w-full flex flex-col rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-semibold text-zinc-300 tracking-wide uppercase font-mono">
          การใช้งานย้อนหลัง (Telemetry History)
        </h4>

        {/* Legend อธิบายความหมายของแต่ละสี */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-300">CPU %</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span className="text-zinc-300">RAM %</span>
          </div>
        </div>
      </div>

      <div className="w-full h-44 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}

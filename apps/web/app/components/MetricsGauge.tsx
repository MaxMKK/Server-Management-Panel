"use client";

import React, { useState } from "react";

interface MetricsGaugeProps {
  label: string;
  value: number; // 0 - 100 (%)
  displayValue: string;
  unit?: string;
  size?: number;
}

/**
 * MetricsGauge Component
 * แสดงความจุ/การใช้งานในรูปแบบ Gauge วงกลม (SVG Circular Progress)
 * - เปลี่ยนสีอัตโนมัติ: เขียว (<60%), ส้มเหลือง (60-80%), แดง (>80%)
 * - Animation หมุนตามค่าแบบนุ่มนวล
 */
export function MetricsGauge({
  label,
  value,
  displayValue,
  unit = "%",
  size = 120,
}: MetricsGaugeProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // เลือกสีตามความวิกฤตของค่า (0-60: เขียว, 60-80: ส้มเหลือง, >80: แดง)
  let colorClass = "stroke-emerald-400 text-emerald-400";
  let bgGlow = "shadow-emerald-500/10";
  if (clampedValue >= 80) {
    colorClass = "stroke-red-500 text-red-400";
    bgGlow = "shadow-red-500/20";
  } else if (clampedValue >= 60) {
    colorClass = "stroke-amber-400 text-amber-400";
    bgGlow = "shadow-amber-500/15";
  }

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 shadow-lg ${bgGlow}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* วงแหวนพื้นหลังสีเทา */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-800/80 fill-none"
          />
          {/* เส้นขอบความคืบหน้าแบบสีสันตามสถานะ */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${colorClass} fill-none transition-all duration-700 ease-out`}
          />
        </svg>

        {/* ตัวเลขและหน่วยตรงกลาง */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-mono text-xl font-extrabold tracking-tight text-zinc-100">
            {displayValue}
          </span>
          {unit && (
            <span className="text-[10px] font-mono text-zinc-500 -mt-0.5">
              {unit}
            </span>
          )}
        </div>
      </div>

      <span className="text-xs font-medium text-zinc-400 mt-2">{label}</span>
    </div>
  );
}

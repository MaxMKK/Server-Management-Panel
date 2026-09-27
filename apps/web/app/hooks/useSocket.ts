"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

/** URL ของ WebSocket Server (เดียวกับ Backend API) */
const WS_URL = "http://localhost:4000";

/** ค่าที่ useSocket Hook ส่งคืน */
export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
}

/**
 * useSocket Hook
 * สร้างและจัดการ Socket.io Connection ไปยัง Backend
 * - อ่าน Token จาก localStorage อัตโนมัติ
 * - จัดการ Auto-Reconnect
 * - จัดการ Auth Error → ล้าง Token → redirect ไป /login
 */
export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("session_token");

    // ถ้ายังไม่ได้ Login → ไม่ต้องเชื่อมต่อ WebSocket
    if (!token) {
      return;
    }

    // สร้าง Socket.io Connection พร้อมส่ง Token ไปยืนยันตัวตน
    const socket = io(WS_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    socketRef.current = socket;

    // ── เหตุการณ์เชื่อมต่อสำเร็จ ──────────────────────────────
    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    // ── เหตุการณ์ถูกตัดการเชื่อมต่อ ──────────────────────────
    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        // เซิร์ฟเวอร์สั่งตัดเอง → อาจเป็น Token หมดอายุ
        setConnectionError("เซิร์ฟเวอร์ตัดการเชื่อมต่อ");
      }
    });

    // ── เหตุการณ์เชื่อมต่อล้มเหลว ──────────────────────────
    socket.on("connect_error", (err) => {
      setIsConnected(false);

      if (err.message.includes("AUTHENTICATION_ERROR")) {
        // Token ไม่ถูกต้องหรือหมดอายุ → ล้างแล้ว redirect
        setConnectionError("Token หมดอายุหรือไม่ถูกต้อง");
        localStorage.removeItem("session_token");
        localStorage.removeItem("user_profile");
        window.location.href = "/login";
      } else {
        setConnectionError("ไม่สามารถเชื่อมต่อ WebSocket Server ได้");
      }
    });

    // ── เหตุการณ์ Auth Error จากฝั่ง Server ──────────────────
    socket.on("auth:error", (data: { message: string }) => {
      setConnectionError(data.message);
    });

    // ── ทำลาย Connection เมื่อ Component Unmount ──────────────
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
  };
}

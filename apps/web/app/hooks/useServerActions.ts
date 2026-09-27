"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "../lib/api";

/** สถานะของ Action ที่กำลังดำเนินการ */
export interface ActionState {
  loading: boolean;
  error: string | null;
}

/** ค่าที่ useServerActions Hook ส่งคืน */
export interface UseServerActionsReturn {
  actionState: ActionState;
  startServer: (id: string) => Promise<boolean>;
  stopServer: (id: string) => Promise<boolean>;
  restartServer: (id: string) => Promise<boolean>;
  killServer: (id: string) => Promise<boolean>;
  clearError: () => void;
}

/**
 * useServerActions Hook
 * จัดการการสั่งการเซิร์ฟเวอร์ผ่าน REST API (Start, Stop, Restart, Kill)
 * พร้อม Loading State และ Error Handling
 */
export function useServerActions(): UseServerActionsReturn {
  const [actionState, setActionState] = useState<ActionState>({
    loading: false,
    error: null,
  });

  // ฟังก์ชันกลางสำหรับส่งคำสั่ง
  const executeAction = useCallback(async (id: string, action: string): Promise<boolean> => {
    setActionState({ loading: true, error: null });

    try {
      const result = await apiFetch(`/servers/${id}/${action}`, {
        method: "POST",
      });

      if (!result.success) {
        setActionState({
          loading: false,
          error: result.error?.message || `ไม่สามารถสั่ง ${action} ได้`,
        });
        return false;
      }

      setActionState({ loading: false, error: null });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ";
      setActionState({ loading: false, error: msg });
      return false;
    }
  }, []);

  const startServer = useCallback((id: string) => executeAction(id, "start"), [executeAction]);
  const stopServer = useCallback((id: string) => executeAction(id, "stop"), [executeAction]);
  const restartServer = useCallback((id: string) => executeAction(id, "restart"), [executeAction]);
  const killServer = useCallback((id: string) => executeAction(id, "kill"), [executeAction]);
  const clearError = useCallback(() => setActionState((s) => ({ ...s, error: null })), []);

  return {
    actionState,
    startServer,
    stopServer,
    restartServer,
    killServer,
    clearError,
  };
}

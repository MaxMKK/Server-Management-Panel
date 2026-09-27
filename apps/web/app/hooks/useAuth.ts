"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/** โครงสร้างข้อมูลผู้ใช้ที่เก็บใน LocalStorage */
export interface AuthUser {
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
}

/** ค่าที่ useAuth Hook ส่งคืน */
export interface UseAuthReturn {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

/**
 * useAuth Hook
 * จัดการสถานะการยืนยันตัวตนของผู้ใช้ — อ่าน Token/Profile จาก localStorage
 * Sync ข้ามแท็บด้วย StorageEvent listener
 */
export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // โหลดข้อมูลจาก localStorage เมื่อ Component Mount
  useEffect(() => {
    const savedToken = localStorage.getItem("session_token");
    const savedProfile = localStorage.getItem("user_profile");

    if (savedToken && savedProfile) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedProfile));
      } catch {
        // JSON ผิดรูปแบบ → ล้างข้อมูลเก่า
        localStorage.removeItem("session_token");
        localStorage.removeItem("user_profile");
      }
    }

    setIsLoading(false);
  }, []);

  // ดักจับการเปลี่ยนแปลง localStorage จากแท็บอื่น (Sync ข้ามแท็บ)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "session_token") {
        if (!e.newValue) {
          // ถูก Logout จากแท็บอื่น
          setToken(null);
          setUser(null);
          router.push("/login");
        } else {
          setToken(e.newValue);
        }
      }

      if (e.key === "user_profile") {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            // ignore
          }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [router]);

  // ฟังก์ชันออกจากระบบ
  const logout = useCallback(() => {
    const currentToken = localStorage.getItem("session_token");

    // แจ้ง Backend ให้ยกเลิก Session (ไม่สนว่าจะสำเร็จหรือไม่)
    if (currentToken) {
      fetch("http://localhost:4000/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }

    localStorage.removeItem("session_token");
    localStorage.removeItem("user_profile");
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    logout,
  };
}

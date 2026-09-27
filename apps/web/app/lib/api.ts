/** URL หลักของ Backend API */
const API_BASE = "http://localhost:4000/api";

/**
 * ส่ง HTTP Request ไปยัง Backend API พร้อมแนบ Bearer Token อัตโนมัติ
 * @param endpoint เส้นทาง API เช่น "/servers" หรือ "/servers/:id/start"
 * @param options ตัวเลือกเพิ่มเติมของ fetch (method, body, headers ฯลฯ)
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("session_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  // ถ้าได้ 401 → Token หมดอายุ ให้ล้างแล้ว redirect
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("session_token");
    localStorage.removeItem("user_profile");
    window.location.href = "/login";
    throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  return json;
}

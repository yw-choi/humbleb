const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8200";

const TOKEN_KEY = "humbleb_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new APIError(res.status, error.detail || "Unknown error");
  }

  return res.json();
}

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Types
export interface Member {
  id: string;
  name: string;
  gender: "M" | "F";
  ntrp: number;
  is_admin: boolean;
}

export interface Schedule {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  court_count: number;
  capacity: number;
  status: "MEMBER_OPEN" | "GUEST_OPEN" | "CLOSED";
  attendance_count: number;
}

export interface Attendance {
  id: string;
  member_id: string;
  member_name: string;
  attendance_type: "full" | "late" | "early";
  arrival_time: string | null;
  departure_time: string | null;
  comment: string | null;
}

// Auth
export function getKakaoLoginUrl(): string {
  return `${API_URL}/auth/kakao`;
}

export async function getMe(): Promise<Member> {
  return fetchAPI<Member>("/members/me");
}

export async function getMembers(): Promise<Member[]> {
  return fetchAPI<Member[]>("/members/");
}

export async function linkMember(memberId: string): Promise<Member> {
  return fetchAPI<Member>("/members/link", {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}

// Schedules
export async function getUpcomingSchedules(): Promise<Schedule[]> {
  return fetchAPI<Schedule[]>("/schedules/upcoming");
}

export async function getSchedule(id: string): Promise<Schedule> {
  return fetchAPI<Schedule>(`/schedules/${id}`);
}

// Attendance
export async function attend(
  scheduleId: string,
  type: "full" | "late" | "early" = "full",
  comment?: string,
): Promise<Attendance> {
  return fetchAPI<Attendance>(`/schedules/${scheduleId}/attend`, {
    method: "POST",
    body: JSON.stringify({ type, comment }),
  });
}

export async function cancelAttendance(scheduleId: string): Promise<void> {
  await fetchAPI(`/schedules/${scheduleId}/attend`, { method: "DELETE" });
}

export async function getAttendees(scheduleId: string): Promise<Attendance[]> {
  return fetchAPI<Attendance[]>(`/schedules/${scheduleId}/attendees`);
}

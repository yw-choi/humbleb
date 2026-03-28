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

// Admin: Schedule CRUD
export interface ScheduleCreateBody {
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  venue: string;
  court_count?: number;
  capacity?: number;
  repeat_weeks?: number;
}

export interface ScheduleUpdateBody {
  title?: string;
  schedule_date?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  court_count?: number;
  capacity?: number;
}

export async function createSchedule(
  body: ScheduleCreateBody,
): Promise<Schedule[]> {
  return fetchAPI<Schedule[]>("/schedules/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSchedule(
  id: string,
  body: ScheduleUpdateBody,
): Promise<Schedule> {
  return fetchAPI<Schedule>(`/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteSchedule(id: string): Promise<void> {
  await fetchAPI(`/schedules/${id}`, { method: "DELETE" });
}

// Admin: Guest
export interface Guest {
  id: string;
  schedule_id: string;
  name: string;
  gender: "M" | "F";
  estimated_skill: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  registered_by: string;
}

export interface GuestCreateBody {
  name: string;
  gender: "M" | "F";
  estimated_skill: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

export async function registerGuest(
  scheduleId: string,
  body: GuestCreateBody,
): Promise<Guest> {
  return fetchAPI<Guest>(`/schedules/${scheduleId}/guests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getGuests(scheduleId: string): Promise<Guest[]> {
  return fetchAPI<Guest[]>(`/schedules/${scheduleId}/guests`);
}

export async function deleteGuest(guestId: string): Promise<void> {
  await fetchAPI(`/guests/${guestId}`, { method: "DELETE" });
}

// Share text
export async function getShareText(
  scheduleId: string,
): Promise<{ text: string }> {
  return fetchAPI<{ text: string }>(`/schedules/${scheduleId}/share-text`);
}

// Matchmaking
export interface ConstraintIn {
  type: string;
  member_ids: string[];
  round?: number;
}

export interface GameData {
  id: string;
  court: string;
  team_a_player1_id: string;
  team_a_player2_id: string;
  team_b_player1_id: string;
  team_b_player2_id: string;
  team_a_player1_type: string;
  team_a_player2_type: string;
  team_b_player1_type: string;
  team_b_player2_type: string;
  team_a_player1_name: string;
  team_a_player2_name: string;
  team_b_player1_name: string;
  team_b_player2_name: string;
  score_a: number | null;
  score_b: number | null;
}

export interface RoundData {
  round_number: number;
  games: GameData[];
}

export interface MatchmakingData {
  id: string;
  schedule_id: string;
  status: "DRAFT" | "CONFIRMED";
  constraints?: ConstraintIn[];
  warnings?: string[];
  rounds: RoundData[];
}

export async function createMatchmaking(
  scheduleId: string,
  roundCount: number,
  constraints?: ConstraintIn[],
): Promise<MatchmakingData> {
  return fetchAPI<MatchmakingData>(`/schedules/${scheduleId}/matchmaking`, {
    method: "POST",
    body: JSON.stringify({ round_count: roundCount, constraints }),
  });
}

export async function confirmMatchmaking(
  scheduleId: string,
): Promise<void> {
  await fetchAPI(`/schedules/${scheduleId}/matches/confirm`, {
    method: "POST",
  });
}

export async function getMatches(
  scheduleId: string,
): Promise<MatchmakingData> {
  return fetchAPI<MatchmakingData>(`/schedules/${scheduleId}/matches`);
}

export async function swapPlayers(
  scheduleId: string,
  gameId: string,
  positionA: string,
  positionB: string,
  gameIdB?: string,
): Promise<void> {
  await fetchAPI(`/schedules/${scheduleId}/matches/swap`, {
    method: "PUT",
    body: JSON.stringify({
      game_id: gameId,
      position_a: positionA,
      game_id_b: gameIdB,
      position_b: positionB,
    }),
  });
}

// Game results
export async function submitScore(
  gameId: string,
  scoreA: number,
  scoreB: number,
): Promise<GameData> {
  return fetchAPI<GameData>(`/games/${gameId}/result`, {
    method: "PUT",
    body: JSON.stringify({ score_a: scoreA, score_b: scoreB }),
  });
}

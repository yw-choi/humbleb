"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  getUpcomingSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getGuests,
  registerGuest,
  deleteGuest,
  getShareText,
  createMatchmaking,
  confirmMatchmaking,
  getMatches,
  getAttendees,
  clearToken,
  getMatchImageUrl,
  type Schedule,
  type Guest,
  type ScheduleCreateBody,
  type GuestCreateBody,
  type MatchmakingData,
  type ConstraintIn,
  type Attendance,
  APIError,
} from "@/lib/api";
import { BottomSheet } from "@/components/BottomSheet";
import { showToast, ToastContainer } from "@/components/Toast";

const SKILL_LABEL: Record<string, string> = {
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "상급",
};

function Header({ name, onLogout }: { name?: string; onLogout?: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🎾</span>
        <span className="text-lg font-bold">HumbleB</span>
        <span className="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          관리
        </span>
      </div>
      <div className="flex items-center gap-2">
        <a href="/" className="text-sm text-muted-fg hover:text-foreground">
          홈
        </a>
        {name && (
          <button
            onClick={onLogout}
            className="touch-active flex h-8 w-8 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
            title="로그아웃"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

// --- Schedule Create Form ---
function ScheduleCreateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ScheduleCreateBody>({
    title: "정모",
    date: "",
    start_time: "10:00:00",
    end_time: "12:30:00",
    venue: "한강중학교",
    court_count: 2,
    capacity: 12,
    repeat_weeks: 0,
  });

  const handleSubmit = async () => {
    if (!form.date) {
      showToast("날짜를 선택해주세요", "error");
      return;
    }
    setLoading(true);
    try {
      await createSchedule(form);
      showToast(`일정 ${(form.repeat_weeks || 0) + 1}개 생성 완료`);
      setOpen(false);
      onCreated();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="touch-active flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white"
      >
        + 일정 생성
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <h3 className="mb-4 text-lg font-semibold">일정 생성</h3>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-fg">제목</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-fg">날짜</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-muted-fg">시작</span>
              <input
                type="time"
                value={form.start_time.slice(0, 5)}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value + ":00" })
                }
                className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-muted-fg">종료</span>
              <input
                type="time"
                value={form.end_time.slice(0, 5)}
                onChange={(e) =>
                  setForm({ ...form, end_time: e.target.value + ":00" })
                }
                className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-fg">장소</span>
            <input
              type="text"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
            />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-muted-fg">코트</span>
              <input
                type="number"
                min={1}
                value={form.court_count}
                onChange={(e) =>
                  setForm({ ...form, court_count: Number(e.target.value) })
                }
                className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-muted-fg">정원</span>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) })
                }
                className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted-fg">
              반복 (주 단위, 0=단일)
            </span>
            <input
              type="number"
              min={0}
              max={12}
              value={form.repeat_weeks}
              onChange={(e) =>
                setForm({ ...form, repeat_weeks: Number(e.target.value) })
              }
              className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
            />
          </label>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="touch-active mt-2 flex h-14 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? "생성 중..." : "생성"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

// --- Admin Schedule Card ---
function AdminScheduleCard({
  schedule,
  onUpdate,
}: {
  schedule: Schedule;
  onUpdate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [guestSheetOpen, setGuestSheetOpen] = useState(false);
  const [matchSheetOpen, setMatchSheetOpen] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestForm, setGuestForm] = useState<GuestCreateBody>({
    name: "",
    gender: "M",
    estimated_skill: "INTERMEDIATE",
  });
  const [loading, setLoading] = useState(false);
  const [roundCount, setRoundCount] = useState(5);
  const [matchmaking, setMatchmaking] = useState<MatchmakingData | null>(null);

  const loadGuests = useCallback(async () => {
    try {
      const g = await getGuests(schedule.id);
      setGuests(g);
    } catch {
      // ignore
    }
  }, [schedule.id]);

  const handleGenerateMatchmaking = async () => {
    setLoading(true);
    try {
      const mm = await createMatchmaking(schedule.id, roundCount);
      setMatchmaking(mm);
      showToast("대진표 생성 완료 (DRAFT)");
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMatchmaking = async () => {
    try {
      await confirmMatchmaking(schedule.id);
      showToast("대진표 확정 완료");
      if (matchmaking) {
        setMatchmaking({ ...matchmaking, status: "CONFIRMED" });
      }
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    }
  };

  const loadMatchmaking = useCallback(async () => {
    try {
      const mm = await getMatches(schedule.id);
      setMatchmaking(mm);
    } catch {
      setMatchmaking(null);
    }
  }, [schedule.id]);

  const handleDelete = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteSchedule(schedule.id);
      showToast("일정 삭제 완료");
      onUpdate();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    }
    setMenuOpen(false);
  };

  const handleShare = async () => {
    try {
      const { text } = await getShareText(schedule.id);
      await navigator.clipboard.writeText(text);
      showToast("카톡 안내 텍스트 복사됨");
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
      else showToast("복사 실패", "error");
    }
    setMenuOpen(false);
  };

  const handleAddGuest = async () => {
    if (!guestForm.name.trim()) {
      showToast("게스트 이름을 입력해주세요", "error");
      return;
    }
    setLoading(true);
    try {
      await registerGuest(schedule.id, guestForm);
      showToast("게스트 등록 완료");
      setGuestForm({ name: "", gender: "M", estimated_skill: "INTERMEDIATE" });
      loadGuests();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    try {
      await deleteGuest(guestId);
      showToast("게스트 삭제 완료");
      loadGuests();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    }
  };

  const dateStr = new Date(schedule.date).toLocaleDateString("ko-KR", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

  const STATUS_BADGE: Record<string, { label: string; dotColor: string }> = {
    MEMBER_OPEN: { label: "멤버신청중", dotColor: "bg-green-500" },
    GUEST_OPEN: { label: "게스트모집", dotColor: "bg-yellow-500" },
    CLOSED: { label: "마감", dotColor: "bg-gray-400" },
  };
  const badge = STATUS_BADGE[schedule.status];

  return (
    <>
      <div className="rounded-2xl border border-card-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-muted-fg">
                {dateStr}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-fg">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dotColor}`}
                />
                {badge.label}
              </span>
            </div>
            <div className="mb-0.5 text-base font-semibold">
              {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}{" "}
              {schedule.venue}
            </div>
            <div className="text-sm text-muted-fg">
              {schedule.attendance_count}/{schedule.capacity}명 | 코트{" "}
              {schedule.court_count}면
            </div>
          </div>

          {/* Overflow menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="touch-active flex h-10 w-10 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-10 z-30 w-40 rounded-xl border border-card-border bg-card py-1 shadow-xl">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setGuestSheetOpen(true);
                      loadGuests();
                    }}
                    className="flex h-11 w-full items-center px-4 text-sm hover:bg-muted"
                  >
                    게스트 등록
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setMatchSheetOpen(true);
                      loadMatchmaking();
                    }}
                    className="flex h-11 w-full items-center px-4 text-sm hover:bg-muted"
                  >
                    대진표
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex h-11 w-full items-center px-4 text-sm hover:bg-muted"
                  >
                    카톡 안내 복사
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex h-11 w-full items-center px-4 text-sm text-red-500 hover:bg-muted"
                  >
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Guest Registration BottomSheet */}
      <BottomSheet
        open={guestSheetOpen}
        onClose={() => setGuestSheetOpen(false)}
      >
        <h3 className="mb-4 text-lg font-semibold">게스트 등록</h3>

        {/* Existing guests */}
        {guests.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-muted-fg">
              등록된 게스트 ({guests.length}명)
            </p>
            <div className="flex flex-col gap-1">
              {guests.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                >
                  <span className="text-sm">
                    {g.name} ({g.gender === "M" ? "남" : "여"},{" "}
                    {SKILL_LABEL[g.estimated_skill]})
                  </span>
                  <button
                    onClick={() => handleDeleteGuest(g.id)}
                    className="text-sm text-red-500"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add guest form */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="이름"
            value={guestForm.name}
            onChange={(e) =>
              setGuestForm({ ...guestForm, name: e.target.value })
            }
            className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
          />
          <div className="flex gap-2">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGuestForm({ ...guestForm, gender: g })}
                className={`flex h-12 flex-1 items-center justify-center rounded-xl text-base font-medium ${
                  guestForm.gender === g
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-fg"
                }`}
              >
                {g === "M" ? "남" : "여"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((s) => (
              <button
                key={s}
                onClick={() =>
                  setGuestForm({ ...guestForm, estimated_skill: s })
                }
                className={`flex h-12 flex-1 items-center justify-center rounded-xl text-sm font-medium ${
                  guestForm.estimated_skill === s
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-fg"
                }`}
              >
                {SKILL_LABEL[s]}
              </button>
            ))}
          </div>
          <button
            onClick={handleAddGuest}
            disabled={loading}
            className="touch-active mt-1 flex h-14 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? "등록 중..." : "게스트 추가"}
          </button>
        </div>
      </BottomSheet>

      {/* Matchmaking BottomSheet */}
      <BottomSheet
        open={matchSheetOpen}
        onClose={() => setMatchSheetOpen(false)}
      >
        <h3 className="mb-4 text-lg font-semibold">대진표</h3>

        {/* Generate controls */}
        <div className="mb-4 flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-muted-fg">라운드 수</span>
            <input
              type="number"
              min={1}
              max={10}
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
              className="h-12 rounded-xl border border-card-border bg-card px-3 text-base"
            />
          </label>
          <button
            onClick={handleGenerateMatchmaking}
            disabled={loading}
            className="touch-active flex h-12 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "생성중..." : "생성"}
          </button>
        </div>

        {/* Warnings */}
        {matchmaking?.warnings && matchmaking.warnings.length > 0 && (
          <div className="mb-3 rounded-lg bg-yellow-500/10 p-3">
            {matchmaking.warnings.map((w, i) => (
              <p key={i} className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠ {w}
              </p>
            ))}
          </div>
        )}

        {/* Draft/Confirmed preview */}
        {matchmaking && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  matchmaking.status === "DRAFT"
                    ? "bg-yellow-500/20 text-yellow-600"
                    : "bg-green-500/20 text-green-600"
                }`}
              >
                {matchmaking.status}
              </span>
            </div>

            <div className="max-h-[40dvh] overflow-y-auto">
              {matchmaking.rounds.map((round) => (
                <div key={round.round_number} className="mb-3">
                  <p className="mb-1 text-sm font-semibold">
                    Round {round.round_number}
                  </p>
                  {round.games.map((game) => (
                    <div
                      key={game.id}
                      className="mb-1 rounded-lg bg-muted p-2 text-sm"
                    >
                      <span className="text-xs text-muted-fg">
                        Court {game.court}
                      </span>
                      <div className="flex items-center justify-between">
                        <span>
                          {game.team_a_player1_name}·
                          {game.team_a_player2_name}
                        </span>
                        <span className="text-muted-fg">vs</span>
                        <span>
                          {game.team_b_player1_name}·
                          {game.team_b_player2_name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {matchmaking.status === "DRAFT" && (
              <button
                onClick={handleConfirmMatchmaking}
                className="touch-active mt-2 flex h-14 w-full items-center justify-center rounded-xl bg-green-600 text-base font-semibold text-white"
              >
                대진표 확정
              </button>
            )}
            {matchmaking.status === "CONFIRMED" && (
              <a
                href={getMatchImageUrl(schedule.id)}
                download={`대진표_${schedule.date}.png`}
                className="touch-active mt-2 flex h-14 w-full items-center justify-center rounded-xl bg-muted text-base font-semibold"
              >
                이미지 다운로드
              </a>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}

// --- Main Admin Page ---
export default function AdminPage() {
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    try {
      const data = await getUpcomingSchedules();
      setSchedules(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") {
      loadSchedules();
    }
  }, [auth.status, loadSchedules]);

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  if (auth.status === "loading" || auth.status === "unauthenticated") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-muted-fg">로그인이 필요합니다</p>
      </main>
    );
  }

  if (auth.status === "authenticated" && !auth.member.is_admin) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-muted-fg">운영진 권한이 필요합니다</p>
      </main>
    );
  }

  return (
    <main className="bg-background">
      <Header
        name={auth.status === "authenticated" ? auth.member.name : undefined}
        onLogout={handleLogout}
      />
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <ScheduleCreateForm onCreated={loadSchedules} />

        <h2 className="mb-3 mt-6 text-lg font-semibold">일정 관리</h2>
        {loading ? (
          <div className="py-12 text-center text-muted-fg">로딩 중...</div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-muted-fg">
            예정된 일정이 없습니다
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {schedules.map((s) => (
              <AdminScheduleCard
                key={s.id}
                schedule={s}
                onUpdate={loadSchedules}
              />
            ))}
          </div>
        )}
      </div>
      <ToastContainer />
    </main>
  );
}

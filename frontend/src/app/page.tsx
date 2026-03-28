"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  getUpcomingSchedules,
  getAttendees,
  getMatches,
  getKakaoLoginUrl,
  clearToken,
} from "@/lib/api";
import type { Schedule, Attendance, MatchmakingData } from "@/lib/api";
import { ScheduleCard } from "@/components/ScheduleCard";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { MemberPicker } from "@/components/MemberPicker";
import { ToastContainer } from "@/components/Toast";

function Header({
  name,
  onLogout,
}: {
  name?: string;
  onLogout?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🎾</span>
        <span className="text-lg font-bold">HumbleB</span>
      </div>
      {name && (
        <div className="flex items-center gap-2">
          <a href="/humbleb/history" className="touch-active rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-fg">기록</a>
          <a href="/humbleb/stats" className="touch-active rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-fg">통계</a>
          <span className="text-xs text-muted-fg">{name}</span>
          <button
            onClick={onLogout}
            className="touch-active flex h-10 w-10 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
            title="로그아웃"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}

/**
 * Check if now is within ±1 hour of a schedule's game time.
 */
function isGameTime(schedule: Schedule): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (schedule.date !== today) return false;

  const [sh, sm] = schedule.start_time.split(":").map(Number);
  const [eh, em] = schedule.end_time.split(":").map(Number);
  const startMin = sh * 60 + sm - 60; // 1 hour before start
  const endMin = eh * 60 + em + 60; // 1 hour after end
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
}

function GameTimeView({
  schedule,
  matchmaking,
  onRefresh,
}: {
  schedule: Schedule;
  matchmaking: MatchmakingData;
  onRefresh: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-4">
      <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <h2 className="mb-1 text-base font-semibold">오늘의 대진표</h2>
        <p className="text-sm text-muted-fg">
          {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}{" "}
          {schedule.venue}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {matchmaking.rounds.map((round) => (
          <div key={round.round_number}>
            <h3 className="mb-2 text-sm font-semibold">
              Round {round.round_number}
            </h3>
            {round.games.map((game) => (
              <div
                key={game.id}
                className="mb-2 rounded-xl border border-card-border bg-card p-3"
              >
                <div className="mb-1 text-xs text-muted-fg">
                  Court {game.court}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center text-sm font-semibold">
                    {game.team_a_player1_name}·{game.team_a_player2_name}
                  </div>
                  <div className="mx-2 text-lg font-bold">
                    {game.score_a !== null ? (
                      <span>
                        {game.score_a}
                        <span className="text-muted-fg">:</span>
                        {game.score_b}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-fg">vs</span>
                    )}
                  </div>
                  <div className="flex-1 text-center text-sm font-semibold">
                    {game.team_b_player1_name}·{game.team_b_player2_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <a
        href={`/schedule/${schedule.id}/matches`}
        className="touch-active mt-4 flex h-12 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white"
      >
        스코어 입력하기
      </a>
    </div>
  );
}

export default function Home() {
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [myAttendances, setMyAttendances] = useState<
    Record<string, Attendance>
  >({});
  const [loading, setLoading] = useState(true);
  const [activeGameSchedule, setActiveGameSchedule] = useState<Schedule | null>(null);
  const [activeMatchmaking, setActiveMatchmaking] = useState<MatchmakingData | null>(null);

  const loadData = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const upcoming = await getUpcomingSchedules();
      setSchedules(upcoming);

      // Fetch all attendees in parallel
      const results = await Promise.all(
        upcoming.map((s) => getAttendees(s.id)),
      );
      const attendanceMap: Record<string, Attendance> = {};
      results.forEach((attendees, i) => {
        const mine = attendees.find((a) => a.member_id === auth.member.id);
        if (mine) attendanceMap[upcoming[i].id] = mine;
      });
      setMyAttendances(attendanceMap);

      // Context-aware: check if any schedule is in game time and user is attending
      for (const s of upcoming) {
        if (isGameTime(s) && attendanceMap[s.id]) {
          try {
            const mm = await getMatches(s.id);
            if (mm.status === "CONFIRMED") {
              setActiveGameSchedule(s);
              setActiveMatchmaking(mm);
              break;
            }
          } catch {
            // No matchmaking yet — show normal view
          }
        }
      }
    } catch {
      // handled by individual components
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = () => {
    clearToken();
    window.location.reload();
  };

  // Login screen
  if (auth.status === "unauthenticated") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <span className="mb-4 text-5xl">🎾</span>
        <h1 className="mb-1 text-2xl font-bold">HumbleB</h1>
        <p className="mb-8 text-sm text-muted-fg">테니스 클럽 정모 관리</p>
        <a
          href={getKakaoLoginUrl()}
          className="touch-active flex h-12 items-center rounded-xl bg-[#FEE500] px-8 text-base font-semibold text-[#191919]"
        >
          카카오 로그인
        </a>
        <ToastContainer />
      </main>
    );
  }

  // Member linking
  if (auth.status === "unlinked") {
    return (
      <main className="bg-background">
        <Header />
        <MemberPicker onLinked={auth.refresh} />
        <ToastContainer />
      </main>
    );
  }

  // Loading
  if (auth.status === "loading" || loading) {
    return (
      <main className="bg-background">
        <Header />
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <h2 className="mb-3 text-lg font-semibold">다가오는 정모</h2>
          <ScheduleListSkeleton />
        </div>
        <ToastContainer />
      </main>
    );
  }

  // Context-aware: show matches during game time
  if (activeGameSchedule && activeMatchmaking) {
    return (
      <main className="bg-background">
        <Header name={auth.member.name} onLogout={handleLogout} />
        <GameTimeView
          schedule={activeGameSchedule}
          matchmaking={activeMatchmaking}
          onRefresh={loadData}
        />
        <ToastContainer />
      </main>
    );
  }

  const openSchedules = schedules.filter((s) => s.status !== "CLOSED");
  const closedSchedules = schedules.filter((s) => s.status === "CLOSED");

  return (
    <main className="bg-background">
      <Header name={auth.member.name} onLogout={handleLogout} />
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <h2 className="mb-3 text-lg font-semibold">다가오는 정모</h2>

        {openSchedules.length === 0 && closedSchedules.length === 0 ? (
          <div className="py-12 text-center text-muted-fg">
            예정된 정모가 없습니다
          </div>
        ) : (
          <>
            {openSchedules.length > 0 && (
              <div className="flex flex-col gap-3">
                {openSchedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    isAttending={!!myAttendances[schedule.id]}
                    myAttendanceType={myAttendances[schedule.id]?.attendance_type}
                    onUpdate={loadData}
                  />
                ))}
              </div>
            )}

            {closedSchedules.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-fg">
                  마감된 일정 ({closedSchedules.length})
                </summary>
                <div className="mt-2 flex flex-col gap-3">
                  {closedSchedules.map((schedule) => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      isAttending={!!myAttendances[schedule.id]}
                      myAttendanceType={myAttendances[schedule.id]?.attendance_type}
                      onUpdate={loadData}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
      <ToastContainer />
    </main>
  );
}

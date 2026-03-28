"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import {
  getUpcomingSchedules,
  getAttendees,
  getMatches,
  getPastSchedules,
  getKakaoLoginUrl,
  clearToken,
} from "@/lib/api";
import type { Schedule, Attendance, MatchmakingData } from "@/lib/api";
import { ScheduleCard } from "@/components/ScheduleCard";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { MemberPicker } from "@/components/MemberPicker";
import { ToastContainer } from "@/components/Toast";

// ─── Icons ───

function CalendarIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ─── Top Header (Instagram style) ───

function TopBar({
  name,
  isAdmin,
  onLogout,
}: {
  name: string;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-card-border bg-background/90 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <span className="text-xl">🎾</span>
        <span className="text-lg font-bold tracking-tight">HumbleB</span>
      </div>
      <div className="flex items-center gap-2.5">
        {isAdmin && (
          <a
            href="/humbleb/admin"
            className="btn-press rounded-lg bg-blue-600/15 px-2.5 py-1 text-xs font-semibold text-blue-400"
          >
            관리
          </a>
        )}
        <span className="text-sm text-muted-fg">{name}</span>
        <button
          onClick={onLogout}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
          title="로그아웃"
        >
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}

// ─── Bottom Tab Bar ───

function BottomTabBar({
  active,
  onChange,
}: {
  active: "schedule" | "history";
  onChange: (tab: "schedule" | "history") => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-card-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md">
        <button
          onClick={() => onChange("schedule")}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
            active === "schedule" ? "text-foreground" : "text-muted-fg"
          }`}
        >
          <CalendarIcon active={active === "schedule"} />
          <span className="text-[11px] font-medium">일정</span>
        </button>
        <button
          onClick={() => onChange("history")}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
            active === "history" ? "text-foreground" : "text-muted-fg"
          }`}
        >
          <ClockIcon active={active === "history"} />
          <span className="text-[11px] font-medium">기록</span>
        </button>
      </div>
    </nav>
  );
}

// ─── Sub-tab pills ───

function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`btn-press rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            active === t.key
              ? "bg-foreground text-background"
              : "bg-muted text-muted-fg"
          }`}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="ml-1.5 opacity-60">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Game Time View ───

function isGameTime(schedule: Schedule): boolean {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (schedule.date !== today) return false;
  const [sh, sm] = schedule.start_time.split(":").map(Number);
  const [eh, em] = schedule.end_time.split(":").map(Number);
  const startMin = sh * 60 + sm - 60;
  const endMin = eh * 60 + em + 60;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
}

function GameTimeView({
  schedule,
  matchmaking,
}: {
  schedule: Schedule;
  matchmaking: MatchmakingData;
}) {
  return (
    <div className="px-4 py-4">
      <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <h2 className="mb-1 text-base font-semibold">오늘의 대진표</h2>
        <p className="text-sm text-muted-fg">
          {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}{" "}
          {schedule.venue}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {matchmaking.rounds.map((round) => (
          <div key={round.round_number}>
            <h3 className="mb-2 text-sm font-semibold">
              Round {round.round_number}
            </h3>
            {round.games.map((game) => (
              <div key={game.id} className="mb-2 rounded-xl border border-card-border bg-card p-3">
                <div className="mb-1 text-xs text-muted-fg">Court {game.court}</div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center text-sm font-semibold">
                    {game.team_a_player1_name}·{game.team_a_player2_name}
                  </div>
                  <div className="mx-2 text-lg font-bold">
                    {game.score_a !== null ? (
                      <>{game.score_a}<span className="text-muted-fg">:</span>{game.score_b}</>
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
        href={`/humbleb/schedule/${schedule.id}/matches`}
        className="btn-press mt-4 flex h-12 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white"
      >
        스코어 입력하기
      </a>
    </div>
  );
}

// ─── History Tab Content ───

function HistoryContent() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPastSchedules()
      .then(setSchedules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-muted-fg">로딩 중...</div>;
  }

  if (schedules.length === 0) {
    return <div className="py-12 text-center text-muted-fg">지난 모임이 없습니다</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {schedules.map((s) => {
        const dateObj = new Date(s.date);
        const dateStr = `${dateObj.getFullYear()}.${dateObj.getMonth() + 1}.${dateObj.getDate()}`;
        const weekday = dateObj.toLocaleDateString("ko-KR", { weekday: "short" });
        return (
          <Link
            key={s.id}
            href={`/humbleb/schedule/${s.id}`}
            className="card-press rounded-xl border border-card-border bg-card p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-0.5 text-sm text-muted-fg">
                  {dateStr} ({weekday})
                </div>
                <div className="text-base font-semibold">
                  {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)} {s.venue}
                </div>
              </div>
              <div className="text-sm text-muted-fg">{s.attendance_count}명</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Main ───

export default function Home() {
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [myAttendances, setMyAttendances] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [activeGameSchedule, setActiveGameSchedule] = useState<Schedule | null>(null);
  const [activeMatchmaking, setActiveMatchmaking] = useState<MatchmakingData | null>(null);
  const [bottomTab, setBottomTab] = useState<"schedule" | "history">("schedule");
  const [subTab, setSubTab] = useState<string>("upcoming");

  const loadData = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const upcoming = await getUpcomingSchedules();
      setSchedules(upcoming);

      const results = await Promise.all(upcoming.map((s) => getAttendees(s.id)));
      const attendanceMap: Record<string, Attendance> = {};
      results.forEach((attendees, i) => {
        const mine = attendees.find((a) => a.member_id === auth.member.id);
        if (mine) attendanceMap[upcoming[i].id] = mine;
      });
      setMyAttendances(attendanceMap);

      for (const s of upcoming) {
        if (isGameTime(s) && attendanceMap[s.id]) {
          try {
            const mm = await getMatches(s.id);
            if (mm.status === "CONFIRMED") {
              setActiveGameSchedule(s);
              setActiveMatchmaking(mm);
              break;
            }
          } catch {}
        }
      }
    } catch {} finally {
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

  // ─── Login ───
  if (auth.status === "unauthenticated") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <span className="mb-4 text-5xl">🎾</span>
        <h1 className="mb-1 text-2xl font-bold">HumbleB</h1>
        <p className="mb-8 text-sm text-muted-fg">테니스 클럽 정모 관리</p>
        <a
          href={getKakaoLoginUrl()}
          className="btn-press flex h-12 items-center rounded-xl bg-[#FEE500] px-8 text-base font-semibold text-[#191919]"
        >
          카카오 로그인
        </a>
        <ToastContainer />
      </main>
    );
  }

  // ─── Member linking ───
  if (auth.status === "unlinked") {
    return (
      <main className="bg-background">
        <MemberPicker onLinked={auth.refresh} />
        <ToastContainer />
      </main>
    );
  }

  // ─── Loading ───
  if (auth.status === "loading" || loading) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-background">
        <TopBar name="" isAdmin={false} onLogout={() => {}} />
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
          <ScheduleListSkeleton />
        </div>
        <BottomTabBar active="schedule" onChange={() => {}} />
        <ToastContainer />
      </main>
    );
  }

  const member = auth.member;
  const openSchedules = schedules.filter((s) => s.status !== "CLOSED");
  const closedSchedules = schedules.filter((s) => s.status === "CLOSED");

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background">
      <TopBar name={member.name} isAdmin={member.is_admin} onLogout={handleLogout} />

      {/* Content area — scrollable, with bottom padding for tab bar */}
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">

        {/* ─── Schedule tab ─── */}
        {bottomTab === "schedule" && (
          <>
            {/* Game time override */}
            {activeGameSchedule && activeMatchmaking ? (
              <GameTimeView schedule={activeGameSchedule} matchmaking={activeMatchmaking} />
            ) : (
              <>
                <SubTabs
                  tabs={[
                    { key: "upcoming", label: "다가오는 모임", count: openSchedules.length },
                    { key: "closed", label: "마감된 모임", count: closedSchedules.length },
                  ]}
                  active={subTab}
                  onChange={setSubTab}
                />

                {subTab === "upcoming" && (
                  openSchedules.length === 0 ? (
                    <div className="py-16 text-center text-muted-fg">
                      예정된 모임이 없습니다
                    </div>
                  ) : (
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
                  )
                )}

                {subTab === "closed" && (
                  closedSchedules.length === 0 ? (
                    <div className="py-16 text-center text-muted-fg">
                      마감된 모임이 없습니다
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
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
                  )
                )}
              </>
            )}
          </>
        )}

        {/* ─── History tab ─── */}
        {bottomTab === "history" && <HistoryContent />}
      </div>

      <BottomTabBar active={bottomTab} onChange={setBottomTab} />
      <ToastContainer />
    </main>
  );
}

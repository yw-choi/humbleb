"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import {
  getUpcomingSchedules,
  getMatches,
  getPastSchedules,
  getMemberStats,
  getKakaoLoginUrl,
  clearToken,
} from "@/lib/api";
import type { Schedule, MatchmakingData, MemberStats } from "@/lib/api";
import { ScheduleCard } from "@/components/ScheduleCard";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { MemberPicker } from "@/components/MemberPicker";
import { ToastContainer } from "@/components/Toast";
import { TopBar, BottomTabBar, type Tab } from "@/components/AppShell";

// ─── Helpers ───

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

function groupByDate(schedules: Schedule[]): [string, Schedule[]][] {
  const groups: Record<string, Schedule[]> = {};
  for (const s of schedules) {
    if (!groups[s.date]) groups[s.date] = [];
    groups[s.date].push(s);
  }
  return Object.entries(groups);
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`;
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

// ─── Empty State ───

function EmptyState({ icon, text }: { icon: "calendar" | "clock"; text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-muted-fg">
      {icon === "calendar" && (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      )}
      {icon === "clock" && (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )}
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Game Time View ───

function GameTimeView({
  schedule,
  matchmaking,
}: {
  schedule: Schedule;
  matchmaking: MatchmakingData;
}) {
  return (
    <div className="py-4">
      <div className="mb-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
        <h2 className="mb-1 text-base font-semibold">오늘의 대진표</h2>
        <p className="text-sm text-muted-fg">
          {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)} {schedule.venue}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {matchmaking.rounds.map((round) => (
          <div key={round.round_number}>
            <h3 className="mb-2 text-sm font-semibold">Round {round.round_number}</h3>
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
      <Link
        href={`/schedule/${schedule.id}/matches`}
        className="btn-press mt-4 flex h-12 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white"
      >
        스코어 입력하기
      </Link>
    </div>
  );
}

// ─── My Stats Card ───

function MyStatsCard({ memberId }: { memberId: string }) {
  const [stats, setStats] = useState<MemberStats | null>(null);

  useEffect(() => {
    getMemberStats()
      .then((all) => {
        const mine = all.find((m) => m.id === memberId);
        if (mine) setStats(mine);
      })
      .catch(() => {});
  }, [memberId]);

  if (!stats || stats.total_games === 0) return null;

  const winPct = Math.round(stats.win_rate * 100);
  return (
    <div className="mb-4 rounded-2xl border border-card-border bg-card p-4">
      <div className="mb-2 text-xs font-semibold text-muted-fg">내 전적</div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{winPct}%</span>
          <div className="flex gap-2 text-sm">
            <span className="text-green-500">{stats.wins}승</span>
            <span className="text-red-400">{stats.losses}패</span>
            {stats.draws > 0 && <span className="text-muted-fg">{stats.draws}무</span>}
          </div>
        </div>
        <div className="text-right text-sm">
          <span className="font-medium">{stats.total_games}게임</span>
          <span className="ml-2 text-muted-fg">R{Math.round(stats.internal_rating)}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${winPct}%` }} />
      </div>
    </div>
  );
}

// ─── History Tab ───

function HistoryContent({ memberId }: { memberId: string }) {
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

  return (
    <>
      <MyStatsCard memberId={memberId} />
      {schedules.length === 0 ? (
        <EmptyState icon="clock" text="지난 모임이 없습니다" />
      ) : (
        <div className="flex flex-col gap-3">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              isAttending={false}
              onUpdate={() => {}}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Inner Home ───

function HomeInner() {
  const searchParams = useSearchParams();
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGameSchedule, setActiveGameSchedule] = useState<Schedule | null>(null);
  const [activeMatchmaking, setActiveMatchmaking] = useState<MatchmakingData | null>(null);

  const initialTab = (searchParams.get("tab") as Tab) || "schedule";
  const [bottomTab, setBottomTab] = useState<Tab>(initialTab);
  const [subTab, setSubTab] = useState<string>("upcoming");

  const loadData = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const upcoming = await getUpcomingSchedules();
      setSchedules(upcoming);

      for (const s of upcoming) {
        if (isGameTime(s) && s.my_attendance_type) {
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
  }, [auth.status]);

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

  if (auth.status === "unlinked") {
    return (
      <main className="bg-background">
        <MemberPicker onLinked={auth.refresh} />
        <ToastContainer />
      </main>
    );
  }

  if (auth.status === "loading" || loading) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-background">
        <TopBar name="" isAdmin={false} onLogout={() => {}} />
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-4">
          <ScheduleListSkeleton />
        </div>
        <BottomTabBar active="schedule" />
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

      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">

        {/* ─── Schedule tab ─── */}
        {bottomTab === "schedule" && (
          <>
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
                    <EmptyState icon="calendar" text="예정된 모임이 없습니다" />
                  ) : (
                    <div className="flex flex-col gap-5">
                      {groupByDate(openSchedules).map(([date, items]) => (
                        <div key={date}>
                          <h3 className="mb-2 text-sm font-semibold text-muted-fg">
                            {formatDateHeader(date)}
                          </h3>
                          <div className="flex flex-col gap-3">
                            {items.map((schedule) => (
                              <ScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                isAttending={!!schedule.my_attendance_type}
                                myAttendanceType={schedule.my_attendance_type || undefined}
                                onUpdate={loadData}
                                isAdmin={member.is_admin}
                                showDate={false}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {subTab === "closed" && (
                  closedSchedules.length === 0 ? (
                    <EmptyState icon="calendar" text="마감된 모임이 없습니다" />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {closedSchedules.map((schedule) => (
                        <ScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          isAttending={!!schedule.my_attendance_type}
                          myAttendanceType={schedule.my_attendance_type || undefined}
                          onUpdate={loadData}
                          isAdmin={member.is_admin}
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
        {bottomTab === "history" && <HistoryContent memberId={member.id} />}
      </div>

      <BottomTabBar active={bottomTab} onTabChange={setBottomTab} />
      <ToastContainer />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

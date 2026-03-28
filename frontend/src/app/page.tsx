"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  getUpcomingSchedules,
  getAttendees,
  getKakaoLoginUrl,
  clearToken,
} from "@/lib/api";
import type { Schedule, Attendance } from "@/lib/api";
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
          <span className="text-sm text-muted-fg">{name}</span>
          <button
            onClick={onLogout}
            className="touch-active flex h-8 w-8 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
            title="로그아웃"
          >
            <svg
              width="18"
              height="18"
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

export default function Home() {
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [myAttendances, setMyAttendances] = useState<
    Record<string, Attendance>
  >({});
  const [loading, setLoading] = useState(true);

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
          <h2 className="mb-3 text-lg font-semibold">이번 주 정모</h2>
          <ScheduleListSkeleton />
        </div>
        <ToastContainer />
      </main>
    );
  }

  return (
    <main className="bg-background">
      <Header name={auth.member.name} onLogout={handleLogout} />
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <h2 className="mb-3 text-lg font-semibold">이번 주 정모</h2>

        {schedules.length === 0 ? (
          <div className="py-12 text-center text-muted-fg">
            예정된 정모가 없습니다
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {schedules.map((schedule) => (
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
      </div>
      <ToastContainer />
    </main>
  );
}

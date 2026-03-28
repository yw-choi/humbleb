"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getUpcomingSchedules, getAttendees, getKakaoLoginUrl } from "@/lib/api";
import type { Schedule, Attendance } from "@/lib/api";
import { ScheduleCard } from "@/components/ScheduleCard";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { MemberPicker } from "@/components/MemberPicker";
import { ToastContainer } from "@/components/Toast";

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

      const attendanceMap: Record<string, Attendance> = {};
      for (const schedule of upcoming) {
        const attendees = await getAttendees(schedule.id);
        const mine = attendees.find(
          (a) => a.member_id === auth.member.id,
        );
        if (mine) {
          attendanceMap[schedule.id] = mine;
        }
      }
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

  if (auth.status === "unauthenticated") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4">
        <h1 className="mb-2 text-2xl font-bold">HumbleB 테니스</h1>
        <p className="mb-8 text-sm text-gray-500">정모 참가 신청</p>
        <a
          href={getKakaoLoginUrl()}
          className="flex h-12 items-center rounded-lg bg-[#FEE500] px-8 text-base font-semibold text-[#191919] active:bg-[#F5DC00]"
        >
          카카오 로그인
        </a>
        <ToastContainer />
      </main>
    );
  }

  if (auth.status === "unlinked") {
    return (
      <main>
        <MemberPicker onLinked={auth.refresh} />
        <ToastContainer />
      </main>
    );
  }

  if (auth.status === "loading" || loading) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">이번 주 정모</h1>
        <ScheduleListSkeleton />
        <ToastContainer />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">이번 주 정모</h1>
        <span className="text-sm text-gray-500">{auth.member.name}</span>
      </div>

      {schedules.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
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

      <ToastContainer />
    </main>
  );
}

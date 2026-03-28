"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSchedule, getAttendees } from "@/lib/api";
import type { Schedule, Attendance } from "@/lib/api";
import { ToastContainer } from "@/components/Toast";
import { TopBar, BottomTabBar } from "@/components/AppShell";

const TYPE_LABEL: Record<string, string> = {
  full: "풀참",
  late: "늦참",
  early: "일퇴",
};

export default function ScheduleDetail() {
  const params = useParams();
  const id = params.id as string;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [attendees, setAttendees] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, a] = await Promise.all([getSchedule(id), getAttendees(id)]);
        setSchedule(s);
        setAttendees(a);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading || !schedule) {
    return (
      <main className="flex min-h-[100dvh] flex-col bg-background">
        <TopBar showBack title="일정 상세" />
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-6">
          <div className="animate-pulse">
            <div className="mb-4 h-6 w-48 rounded bg-muted" />
            <div className="mb-2 h-4 w-32 rounded bg-muted" />
            <div className="mb-6 h-4 w-24 rounded bg-muted" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="mb-2 h-12 rounded bg-muted" />
            ))}
          </div>
        </div>
        <BottomTabBar active="schedule" />
      </main>
    );
  }

  const dateStr = new Date(schedule.date + "T00:00:00").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const STATUS_LABEL: Record<string, { text: string; color: string }> = {
    MEMBER_OPEN: { text: "멤버 신청중", color: "text-green-400" },
    GUEST_OPEN: { text: "게스트 모집중", color: "text-yellow-400" },
    CLOSED: { text: "마감", color: "text-muted-fg" },
  };
  const status = STATUS_LABEL[schedule.status];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background">
      <TopBar showBack title="일정 상세" />

      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">
        <h1 className="mb-1 text-xl font-bold">{schedule.title || schedule.venue}</h1>
        <p className="mb-1 text-sm text-muted-fg">{dateStr}</p>
        <p className="mb-1 text-sm text-muted-fg">
          {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)} · {schedule.venue} · 코트 {schedule.court_count}면
        </p>
        <p className={`mb-4 text-sm font-semibold ${status.color}`}>{status.text}</p>

        <div className="mb-3 text-sm font-medium text-muted-fg">
          참가자 ({attendees.length}/{schedule.capacity})
        </div>

        {attendees.length === 0 ? (
          <div className="py-8 text-center text-muted-fg">아직 참가자가 없습니다</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-card-border bg-card">
            {attendees.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center px-4 py-3 ${
                  i < attendees.length - 1 ? "border-b border-card-border" : ""
                }`}
              >
                <span className="flex-1 font-medium">{a.member_name}</span>
                <span className="text-sm text-muted-fg">
                  {TYPE_LABEL[a.attendance_type]}
                  {a.arrival_time && ` ${a.arrival_time.slice(0, 5)}`}
                  {a.departure_time && `-${a.departure_time.slice(0, 5)}`}
                </span>
                {a.comment && (
                  <span className="ml-2 max-w-[120px] truncate text-xs text-muted-fg">
                    {a.comment}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomTabBar active="schedule" />
      <ToastContainer />
    </main>
  );
}

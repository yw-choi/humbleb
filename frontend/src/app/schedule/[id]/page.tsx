"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSchedule, getAttendees } from "@/lib/api";
import type { Schedule, Attendance } from "@/lib/api";
import { ToastContainer } from "@/components/Toast";

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
        const [s, a] = await Promise.all([
          getSchedule(id),
          getAttendees(id),
        ]);
        setSchedule(s);
        setAttendees(a);
      } catch {
        // error handling
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading || !schedule) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-48 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
          <div className="mb-6 h-4 w-24 rounded bg-gray-200" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="mb-2 h-12 rounded bg-gray-200" />
          ))}
        </div>
      </main>
    );
  }

  const dateStr = new Date(schedule.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-gray-500 active:text-gray-700"
      >
        ← 돌아가기
      </Link>

      <h1 className="mb-1 text-xl font-bold">{schedule.title || schedule.venue}</h1>
      <p className="mb-1 text-gray-600">{dateStr}</p>
      <p className="mb-4 text-gray-600">
        {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)} ·{" "}
        {schedule.venue} · 코트 {schedule.court_count}면
      </p>

      <div className="mb-2 text-sm font-medium text-gray-500">
        참가자 ({attendees.length}/{schedule.capacity})
      </div>

      {attendees.length === 0 ? (
        <div className="py-8 text-center text-gray-400">아직 참가자가 없습니다</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {attendees.map((a, i) => (
            <div
              key={a.id}
              className={`flex items-center px-4 py-3 ${
                i < attendees.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <span className="flex-1 font-medium">{a.member_name}</span>
              <span className="text-sm text-gray-400">
                {TYPE_LABEL[a.attendance_type]}
                {a.arrival_time && ` ${a.arrival_time.slice(0, 5)}`}
                {a.departure_time && `-${a.departure_time.slice(0, 5)}`}
              </span>
              {a.comment && (
                <span className="ml-2 max-w-[120px] truncate text-xs text-gray-400">
                  {a.comment}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <ToastContainer />
    </main>
  );
}

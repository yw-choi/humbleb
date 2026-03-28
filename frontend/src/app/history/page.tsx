"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getPastSchedules, type Schedule } from "@/lib/api";
import { ToastContainer } from "@/components/Toast";

const STATUS_BADGE: Record<string, { label: string; dotColor: string }> = {
  MEMBER_OPEN: { label: "멤버신청중", dotColor: "bg-green-500" },
  GUEST_OPEN: { label: "게스트모집", dotColor: "bg-yellow-500" },
  CLOSED: { label: "마감", dotColor: "bg-gray-400" },
};

export default function HistoryPage() {
  const auth = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getPastSchedules();
      setSchedules(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") loadData();
  }, [auth.status, loadData]);

  if (auth.status !== "authenticated") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-muted-fg">로그인이 필요합니다</p>
      </main>
    );
  }

  return (
    <main className="bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Link href="/" className="touch-active text-muted-fg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold">지난 정모</h1>
      </header>

      <div className="mx-auto w-full max-w-md px-4 py-4">
        {loading ? (
          <div className="py-12 text-center text-muted-fg">로딩 중...</div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-muted-fg">
            지난 정모가 없습니다
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {schedules.map((s) => {
              const dateStr = new Date(s.date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                weekday: "short",
              });
              const badge = STATUS_BADGE[s.status];
              return (
                <Link
                  key={s.id}
                  href={`/schedule/${s.id}`}
                  className="touch-active rounded-xl border border-card-border bg-card p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="mb-0.5 text-sm text-muted-fg">
                        {dateStr}
                      </div>
                      <div className="text-base font-semibold">
                        {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}{" "}
                        {s.venue}
                      </div>
                    </div>
                    <div className="text-sm text-muted-fg">
                      {s.attendance_count}명
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <ToastContainer />
    </main>
  );
}

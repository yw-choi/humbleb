"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getMemberStats, type MemberStats } from "@/lib/api";
import { ToastContainer } from "@/components/Toast";

export default function StatsPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getMemberStats();
      setStats(data);
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
        <h1 className="text-lg font-bold">멤버 통계</h1>
      </header>

      <div className="mx-auto w-full max-w-md px-4 py-4">
        {loading ? (
          <div className="py-12 text-center text-muted-fg">로딩 중...</div>
        ) : stats.length === 0 ? (
          <div className="py-12 text-center text-muted-fg">
            아직 통계 데이터가 없습니다
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {stats.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-card-border bg-card p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-fg">
                      NTRP {m.ntrp} | Rating{" "}
                      {Math.round(m.internal_rating)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {m.total_games > 0
                        ? `${Math.round(m.win_rate * 100)}%`
                        : "-"}
                    </div>
                    <div className="text-xs text-muted-fg">
                      {m.total_games}게임
                    </div>
                  </div>
                </div>
                {m.total_games > 0 && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <span className="text-green-500">{m.wins}승</span>
                    <span className="text-red-500">{m.losses}패</span>
                    {m.draws > 0 && (
                      <span className="text-muted-fg">{m.draws}무</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <ToastContainer />
    </main>
  );
}

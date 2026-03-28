"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getMatches, getSchedule, type MatchmakingData, type Schedule, APIError } from "@/lib/api";
import { ToastContainer } from "@/components/Toast";

function MatchCard({
  game,
}: {
  game: MatchmakingData["rounds"][number]["games"][number];
}) {
  const hasScore = game.score_a !== null && game.score_b !== null;

  return (
    <div className="rounded-xl border border-card-border bg-card p-3">
      <div className="mb-2 text-xs font-medium text-muted-fg">
        Court {game.court}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold">
            {game.team_a_player1_name}
          </div>
          <div className="text-sm font-semibold">
            {game.team_a_player2_name}
          </div>
        </div>
        <div className="mx-3 flex items-center gap-2 text-lg font-bold">
          {hasScore ? (
            <>
              <span>{game.score_a}</span>
              <span className="text-muted-fg">:</span>
              <span>{game.score_b}</span>
            </>
          ) : (
            <span className="text-sm text-muted-fg">vs</span>
          )}
        </div>
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold">
            {game.team_b_player1_name}
          </div>
          <div className="text-sm font-semibold">
            {game.team_b_player2_name}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const [matchmaking, setMatchmaking] = useState<MatchmakingData | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [mm, sched] = await Promise.all([
        getMatches(id),
        getSchedule(id),
      ]);
      setMatchmaking(mm);
      setSchedule(sched);
    } catch (e) {
      if (e instanceof APIError) {
        setError(e.status === 404 ? "대진표가 아직 생성되지 않았습니다" : e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        <Link href={`/schedule/${id}`} className="touch-active text-muted-fg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold">대진표</h1>
          {schedule && (
            <p className="text-xs text-muted-fg">
              {new Date(schedule.date).toLocaleDateString("ko-KR", {
                month: "numeric",
                day: "numeric",
                weekday: "short",
              })}{" "}
              {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 py-4">
        {loading ? (
          <div className="py-12 text-center text-muted-fg">로딩 중...</div>
        ) : error ? (
          <div className="py-12 text-center text-muted-fg">{error}</div>
        ) : matchmaking ? (
          <div className="flex flex-col gap-6">
            {matchmaking.rounds.map((round) => (
              <div key={round.round_number}>
                <h2 className="mb-2 text-base font-semibold">
                  Round {round.round_number}
                </h2>
                <div className="flex flex-col gap-2">
                  {round.games.map((game) => (
                    <MatchCard key={game.id} game={game} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ToastContainer />
    </main>
  );
}

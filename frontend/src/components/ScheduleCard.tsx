"use client";

import { useState } from "react";
import Link from "next/link";
import type { Schedule } from "@/lib/api";
import { attend, cancelAttendance, APIError } from "@/lib/api";
import { BottomSheet } from "./BottomSheet";
import { showToast } from "./Toast";

interface ScheduleCardProps {
  schedule: Schedule;
  isAttending: boolean;
  myAttendanceType?: "full" | "late" | "early";
  onUpdate: () => void;
}

const STATUS_BADGE: Record<string, { label: string; dotColor: string }> = {
  MEMBER_OPEN: { label: "멤버신청중", dotColor: "bg-green-500" },
  GUEST_OPEN: { label: "게스트모집", dotColor: "bg-yellow-500" },
  CLOSED: { label: "마감", dotColor: "bg-gray-400" },
};

const TYPE_LABEL: Record<string, string> = {
  full: "풀참",
  late: "늦참",
  early: "일퇴",
};

export function ScheduleCard({
  schedule,
  isAttending,
  myAttendanceType,
  onUpdate,
}: ScheduleCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const badge = STATUS_BADGE[schedule.status];

  const handleAttend = async (type: "full" | "late" | "early") => {
    setSheetOpen(false);
    setLoading(true);
    try {
      await attend(schedule.id, type);
      showToast("참가 신청 완료");
      onUpdate();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelAttendance(schedule.id);
      showToast("불참 처리 완료");
      onUpdate();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const dateStr = new Date(schedule.date).toLocaleDateString("ko-KR", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

  const isClosed = schedule.status === "CLOSED";

  return (
    <>
      <div className={`rounded-2xl border border-card-border bg-card p-4 transition-colors ${isClosed ? "opacity-50" : ""}`}>
        <div className="flex items-start gap-3">
          {/* Left: schedule info */}
          <Link href={`/schedule/${schedule.id}`} className="touch-active min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-muted-fg">{dateStr}</span>
              <span className="flex items-center gap-1 text-xs text-muted-fg">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dotColor}`} />
                {badge.label}
              </span>
            </div>
            <div className="mb-0.5 text-base font-semibold">
              {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
            </div>
            <div className="mb-1 text-sm text-muted-fg">{schedule.venue}</div>
            <div className="text-sm text-muted-fg">
              {schedule.attendance_count}/{schedule.capacity}명
            </div>
          </Link>

          {/* Right: action buttons (vertical stack) */}
          <div className="flex flex-col gap-2">
            {isAttending ? (
              <>
                <button
                  disabled
                  className="touch-active flex h-12 w-16 flex-col items-center justify-center rounded-xl bg-blue-600 text-white"
                >
                  <span className="text-lg">✓</span>
                  <span className="text-xs font-medium">{TYPE_LABEL[myAttendanceType || "full"]}</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading || isClosed}
                  className="touch-active flex h-12 w-16 flex-col items-center justify-center rounded-xl bg-muted text-muted-fg disabled:opacity-40"
                >
                  <span className="text-lg">✕</span>
                  <span className="text-xs font-medium">취소</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSheetOpen(true)}
                  disabled={loading || isClosed}
                  className="touch-active flex h-12 w-16 flex-col items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"
                >
                  <span className="text-lg">○</span>
                  <span className="text-xs font-medium">참가</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading || isClosed}
                  className="touch-active flex h-12 w-16 flex-col items-center justify-center rounded-xl bg-muted text-muted-fg disabled:opacity-40"
                >
                  <span className="text-lg">✕</span>
                  <span className="text-xs font-medium">불참</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <h3 className="mb-4 text-lg font-semibold">참가 방식 선택</h3>
        <div className="flex flex-col gap-2">
          {(["full", "late", "early"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleAttend(type)}
              className="touch-active flex h-14 items-center rounded-xl bg-muted px-4 text-base font-medium"
            >
              {TYPE_LABEL[type]}
              {type === "late" && <span className="ml-2 text-sm text-muted-fg">(시작 +30분)</span>}
              {type === "early" && <span className="ml-2 text-sm text-muted-fg">(종료 -30분)</span>}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

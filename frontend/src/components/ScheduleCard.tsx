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

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  MEMBER_OPEN: { label: "멤버신청중", color: "bg-green-100 text-green-700" },
  GUEST_OPEN: { label: "게스트모집", color: "bg-yellow-100 text-yellow-700" },
  CLOSED: { label: "마감", color: "bg-gray-100 text-gray-500" },
};

const TYPE_LABEL: Record<string, string> = {
  full: "풀참",
  late: "늦참 (+30분)",
  early: "일퇴 (-30분)",
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
      if (e instanceof APIError) {
        showToast(e.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelAttendance(schedule.id);
      showToast("참가 취소 완료");
      onUpdate();
    } catch (e) {
      if (e instanceof APIError) {
        showToast(e.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const dateStr = new Date(schedule.date).toLocaleDateString("ko-KR", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Link href={`/schedule/${schedule.id}`}>
          <div className="mb-1 text-sm text-gray-500">{dateStr}</div>
          <div className="mb-1 font-semibold">
            {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}{" "}
            {schedule.venue}
          </div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
            <span className="text-sm text-gray-600">
              {schedule.attendance_count}/{schedule.capacity}명
            </span>
          </div>
        </Link>

        <div className="flex gap-2">
          {isAttending ? (
            <>
              <span className="flex h-12 items-center rounded-lg bg-blue-50 px-4 text-sm font-medium text-blue-700">
                {TYPE_LABEL[myAttendanceType || "full"]}
              </span>
              <button
                onClick={handleCancel}
                disabled={loading || schedule.status === "CLOSED"}
                className="h-12 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 active:bg-gray-200 disabled:opacity-50"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSheetOpen(true)}
                disabled={loading || schedule.status === "CLOSED"}
                className="h-12 rounded-lg bg-blue-600 px-6 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50"
              >
                참가
              </button>
              {schedule.status !== "CLOSED" && (
                <button
                  disabled
                  className="h-12 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-400"
                >
                  불참
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <h3 className="mb-4 text-lg font-semibold">참가 방식 선택</h3>
        <div className="flex flex-col gap-2">
          {(["full", "late", "early"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleAttend(type)}
              className="h-14 rounded-lg bg-gray-50 px-4 text-left text-base font-medium active:bg-gray-100"
            >
              {TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

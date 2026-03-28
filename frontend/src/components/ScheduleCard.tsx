"use client";

import { useState } from "react";
import Link from "next/link";
import type { Schedule } from "@/lib/api";
import { attend, cancelAttendance, APIError } from "@/lib/api";
import { showToast } from "./Toast";

interface ScheduleCardProps {
  schedule: Schedule;
  isAttending: boolean;
  myAttendanceType?: "full" | "late" | "early";
  onUpdate: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  full: "풀참",
  late: "늦참",
  early: "일퇴",
};

const TYPE_DESC: Record<string, string> = {
  full: "처음부터 끝까지",
  late: "시작 30분 후 합류",
  early: "종료 30분 전 퇴장",
};

type CardVariant = "attending" | "open" | "guest" | "closed";

function getVariant(schedule: Schedule, isAttending: boolean): CardVariant {
  if (isAttending) return "attending";
  if (schedule.status === "CLOSED") return "closed";
  if (schedule.status === "GUEST_OPEN") return "guest";
  return "open";
}

const VARIANT_STYLES: Record<
  CardVariant,
  { border: string; bg: string; accent: string; statusText: string; statusColor: string }
> = {
  attending: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/[0.06]",
    accent: "text-blue-400",
    statusText: "참가 예정",
    statusColor: "text-blue-400",
  },
  open: {
    border: "border-green-500/30",
    bg: "bg-card",
    accent: "text-green-400",
    statusText: "멤버 신청중",
    statusColor: "text-green-400",
  },
  guest: {
    border: "border-yellow-500/30",
    bg: "bg-card",
    accent: "text-yellow-400",
    statusText: "게스트 모집",
    statusColor: "text-yellow-400",
  },
  closed: {
    border: "border-card-border",
    bg: "bg-card",
    accent: "text-muted-fg",
    statusText: "마감",
    statusColor: "text-muted-fg",
  },
};

// ─── Center Modal ───

function CenterModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm animate-modal-in rounded-2xl border border-card-border bg-card p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───

export function ScheduleCard({
  schedule,
  isAttending,
  myAttendanceType,
  onUpdate,
}: ScheduleCardProps) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const variant = getVariant(schedule, isAttending);
  const styles = VARIANT_STYLES[variant];

  const handleAttend = async (type: "full" | "late" | "early") => {
    setModalOpen(false);
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
      showToast("참가 취소됨");
      onUpdate();
    } catch (e) {
      if (e instanceof APIError) showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (isAttending) {
      setCancelConfirm(true);
    } else {
      setModalOpen(true);
    }
  };

  const dateObj = new Date(schedule.date);
  const weekday = dateObj.toLocaleDateString("ko-KR", { weekday: "short" });
  const dateStr = `${dateObj.getMonth() + 1}.${dateObj.getDate()}`;
  const timeStr = `${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}`;
  const isClosed = schedule.status === "CLOSED";
  const isFull = schedule.attendance_count >= schedule.capacity;

  return (
    <>
      <div
        className={`
          card-press group relative overflow-hidden rounded-2xl border
          ${styles.border} ${styles.bg}
          p-4 transition-all duration-200
          ${isClosed ? "opacity-60" : ""}
        `}
      >
        {/* Subtle left accent bar */}
        <div
          className={`absolute left-0 top-0 h-full w-1 ${
            variant === "attending"
              ? "bg-blue-500"
              : variant === "open"
                ? "bg-green-500"
                : variant === "guest"
                  ? "bg-yellow-500"
                  : "bg-transparent"
          }`}
        />

        <div className="flex items-center gap-3">
          {/* Content — tappable to detail */}
          <Link
            href={`/humbleb/schedule/${schedule.id}`}
            className="min-w-0 flex-1 pl-2"
          >
            {/* Row 1: date + time */}
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="text-base font-bold">
                {dateStr}
              </span>
              <span className="text-sm text-muted-fg">({weekday})</span>
              <span className="text-sm font-medium">{timeStr}</span>
            </div>

            {/* Row 2: venue + capacity */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-sm text-muted-fg">{schedule.venue}</span>
              <span className="text-sm">
                <span className={styles.accent}>{schedule.attendance_count}</span>
                <span className="text-muted-fg">/{schedule.capacity}명</span>
              </span>
            </div>

            {/* Row 3: status */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${styles.statusColor}`}>
                {isAttending
                  ? `${styles.statusText} · ${TYPE_LABEL[myAttendanceType || "full"]}`
                  : styles.statusText}
              </span>
              {isFull && !isClosed && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                  FULL
                </span>
              )}
            </div>
          </Link>

          {/* Action button — single toggle */}
          {!isClosed && (
            <button
              onClick={handleButtonClick}
              disabled={loading || (isFull && !isAttending)}
              className={`
                btn-press flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl
                text-sm font-semibold transition-all duration-150
                disabled:opacity-30
                ${
                  isAttending
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                    : "bg-muted text-foreground hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-600/25"
                }
              `}
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : isAttending ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="mt-0.5 text-[11px]">참가중</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="mt-0.5 text-[11px]">참가</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Attendance type modal — centered */}
      <CenterModal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3 className="mb-1 text-lg font-bold">참가 방식</h3>
        <p className="mb-4 text-sm text-muted-fg">
          {dateStr}({weekday}) {timeStr}
        </p>
        <div className="flex flex-col gap-2">
          {(["full", "late", "early"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleAttend(type)}
              className="btn-press flex h-14 items-center justify-between rounded-xl bg-muted px-4 transition-colors hover:bg-blue-600 hover:text-white"
            >
              <div className="flex flex-col items-start">
                <span className="text-base font-semibold">{TYPE_LABEL[type]}</span>
                <span className="text-xs opacity-60">{TYPE_DESC[type]}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      </CenterModal>

      {/* Cancel confirmation modal */}
      <CenterModal open={cancelConfirm} onClose={() => setCancelConfirm(false)}>
        <h3 className="mb-1 text-lg font-bold">참가 취소</h3>
        <p className="mb-5 text-sm text-muted-fg">
          {dateStr}({weekday}) {timeStr} 참가를 취소하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCancelConfirm(false)}
            className="btn-press flex h-12 flex-1 items-center justify-center rounded-xl bg-muted text-sm font-semibold"
          >
            아니오
          </button>
          <button
            onClick={() => {
              setCancelConfirm(false);
              handleCancel();
            }}
            className="btn-press flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 text-sm font-semibold text-white"
          >
            취소하기
          </button>
        </div>
      </CenterModal>
    </>
  );
}

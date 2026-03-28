"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Theme ───

type Theme = "system" | "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("humbleb_theme", theme);
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem("humbleb_theme") as Theme) || "system");
  }, []);

  const cycle = () => {
    const next: Theme = theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    setTheme(next);
    applyTheme(next);
  };

  const label = theme === "dark" ? "다크 모드" : theme === "light" ? "라이트 모드" : "시스템 설정";

  return (
    <button
      onClick={cycle}
      className="btn-press flex h-9 w-9 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
      title={label}
      aria-label="테마 변경"
    >
      {theme === "dark" ? <MoonIcon /> : theme === "light" ? <SunIcon /> : <MonitorIcon />}
    </button>
  );
}

// ─── Icons ───

function CalendarIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChartIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ─── Top Bar ───

export function TopBar({
  name,
  isAdmin,
  onLogout,
  showBack,
  title,
}: {
  name?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
  showBack?: boolean;
  title?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-card-border bg-background/90 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        {showBack && (
          <Link href="/" className="btn-press mr-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-fg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        )}
        {title ? (
          <span className="text-lg font-bold tracking-tight">{title}</span>
        ) : (
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-xl">🎾</span>
            <span className="text-lg font-bold tracking-tight">HumbleB</span>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isAdmin && (
          <Link
            href="/admin"
            className="btn-press rounded-lg bg-blue-600/15 px-2.5 py-1 text-xs font-semibold text-blue-400"
          >
            관리
          </Link>
        )}
        {name && <span className="ml-1 text-sm text-muted-fg">{name}</span>}
        <ThemeToggle />
        {onLogout && (
          <button
            onClick={onLogout}
            className="btn-press flex h-9 w-9 items-center justify-center rounded-full text-muted-fg hover:bg-muted"
            title="로그아웃"
            aria-label="로그아웃"
          >
            <LogoutIcon />
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Bottom Tab Bar ───

export type Tab = "schedule" | "history";

const TABS: { key: Tab; label: string; Icon: React.FC<{ active?: boolean }> }[] = [
  { key: "schedule", label: "일정", Icon: CalendarIcon },
  { key: "history", label: "기록", Icon: ClockIcon },
];

export function BottomTabBar({
  active,
  onTabChange,
}: {
  active?: Tab;
  onTabChange?: (tab: Tab) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-card-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const cls = `flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
            isActive ? "text-foreground" : "text-muted-fg"
          }`;
          const content = (
            <>
              <Icon active={isActive} />
              <span className="text-[11px] font-medium">{label}</span>
            </>
          );

          if (onTabChange) {
            return (
              <button key={key} onClick={() => onTabChange(key)} className={cls}>
                {content}
              </button>
            );
          }

          const href = key === "schedule" ? "/" : `/?tab=${key}`;
          return (
            <Link key={key} href={href} className={cls}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

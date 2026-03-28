"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Token is passed via URL fragment: /auth/callback#token=xxx
    const hash = window.location.hash;
    const match = hash.match(/token=([^&]+)/);
    if (match) {
      setToken(match[1]);
    }
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <p className="text-gray-400">로그인 처리중...</p>
    </div>
  );
}

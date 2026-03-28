"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // JWT is already set as httpOnly cookie by the backend redirect.
    // Just redirect to home.
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <p className="text-gray-400">로그인 처리중...</p>
    </div>
  );
}

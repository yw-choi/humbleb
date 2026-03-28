"use client";

import { useEffect, useState, useCallback } from "react";

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "error";
}

let toastId = 0;
let addToastFn: ((text: string, type: "success" | "error") => void) | null =
  null;

export function showToast(text: string, type: "success" | "error" = "success") {
  addToastFn?.(text, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: "success" | "error") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text, type }]);
    const duration = type === "error" ? 4000 : 2000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "error" ? "bg-red-600" : "bg-gray-800 dark:bg-gray-200 dark:text-gray-900"
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

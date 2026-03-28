"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, getToken, clearToken, type Member, APIError } from "./api";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unlinked" }
  | { status: "authenticated"; member: Member };

export function useAuth() {
  const token = typeof window !== "undefined" ? getToken() : null;
  const [state, setState] = useState<AuthState>(
    token ? { status: "loading" } : { status: "unauthenticated" },
  );
  const didFetch = useRef(false);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setState({ status: "unauthenticated" });
      return;
    }
    try {
      const member = await getMe();
      setState({ status: "authenticated", member });
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 401) {
          clearToken();
          setState({ status: "unauthenticated" });
        } else if (e.status === 403) {
          setState({ status: "unlinked" });
        } else {
          setState({ status: "unauthenticated" });
        }
      } else {
        setState({ status: "unauthenticated" });
      }
    }
  }, []);

  useEffect(() => {
    if (didFetch.current || !token) return;
    didFetch.current = true;
    // Fetch auth from external API
    getMe()
      .then((member) => setState({ status: "authenticated", member }))
      .catch((e) => {
        if (e instanceof APIError) {
          if (e.status === 401) {
            clearToken();
            setState({ status: "unauthenticated" });
          } else if (e.status === 403) {
            setState({ status: "unlinked" });
          } else {
            setState({ status: "unauthenticated" });
          }
        } else {
          setState({ status: "unauthenticated" });
        }
      });
  }, [token]);

  return { ...state, refresh };
}

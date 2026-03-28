"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, type Member, APIError } from "./api";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unlinked" }
  | { status: "authenticated"; member: Member };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const didFetch = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const member = await getMe();
      setState({ status: "authenticated", member });
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === 401) {
          setState({ status: "unauthenticated" });
        } else if (e.status === 403) {
          setState({ status: "unlinked" });
        }
      } else {
        setState({ status: "unauthenticated" });
      }
    }
  }, []);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    // fetch auth state on mount via external API call
    getMe()
      .then((member) => setState({ status: "authenticated", member }))
      .catch((e) => {
        if (e instanceof APIError) {
          if (e.status === 401) setState({ status: "unauthenticated" });
          else if (e.status === 403) setState({ status: "unlinked" });
          else setState({ status: "unauthenticated" });
        } else {
          setState({ status: "unauthenticated" });
        }
      });
  }, []);

  return { ...state, refresh };
}

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

// Phase 1: 公開 signUp は廃止。管理者からの招待フロー (Phase 2) で代替する。
export const { signIn, signOut, useSession } = authClient;

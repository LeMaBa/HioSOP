import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserResponse } from "../api/auth";

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  setAuth: (token: string, user: UserResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "sop-auth" }
  )
);

export const isAdmin = (user: UserResponse | null) =>
  user?.role === "ADMIN" || user?.role === "OWNER";

export const isOwner = (user: UserResponse | null) => user?.role === "OWNER";

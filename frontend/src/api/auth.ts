import { apiClient } from "./client";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: "DISPATCHER" | "ADMIN" | "OWNER";
  is_active: boolean;
  is_ldap_user: boolean;
  created_at: string;
  last_login: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>("/auth/login", data).then((r) => r.data),

  me: () => apiClient.get<UserResponse>("/auth/me").then((r) => r.data),

  logout: () => apiClient.post("/auth/logout"),
};

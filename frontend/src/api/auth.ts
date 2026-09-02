import { apiClient } from "./client";
import { User } from "../types";

export async function registerRequest(input: { username: string; email: string; password: string }) {
  const res = await apiClient.post<{ data: { user: User; token: string } }>("/auth/register", input);
  return res.data.data;
}

export async function loginRequest(input: { email: string; password: string }) {
  const res = await apiClient.post<{ data: { user: User; token: string } }>("/auth/login", input);
  return res.data.data;
}

export async function logoutRequest() {
  await apiClient.post("/auth/logout");
}

export async function meRequest() {
  const res = await apiClient.get<{ data: { user: User } }>("/auth/me");
  return res.data.data.user;
}

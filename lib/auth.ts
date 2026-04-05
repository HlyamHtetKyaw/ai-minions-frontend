import { apiFetch } from "./api";

export async function signup(username: string, email: string, password: string) {
  return apiFetch("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export async function login(usernameOrEmail: string, password: string) {
  return apiFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ usernameOrEmail, password }),
  });
}

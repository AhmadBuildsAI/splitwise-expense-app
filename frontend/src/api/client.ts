import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api",
  withCredentials: true,
});

// Attach a bearer token from localStorage as a fallback for
// environments where third-party cookies are restricted.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | {
          message?: string;
          error?: string;
          errors?: Array<{ message?: string } | string>;
        }
      | undefined;

    if (data?.message) {
      return data.message;
    }

    if (data?.error) {
      return data.error;
    }

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const messages = data.errors
        .map((item) =>
          typeof item === "string" ? item : item?.message,
        )
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(", ");
      }
    }

    if (err.message) {
      return err.message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Something went wrong. Please try again.";
}
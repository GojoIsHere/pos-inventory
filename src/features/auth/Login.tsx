import {
  FormEvent,
  useState,
} from "react";

import { login } from "./authService";
import type { AuthUser } from "../../types/auth";
import "./auth.css";

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

export default function Login({
  onLogin,
}: LoginProps) {
  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    try {
      setLoading(true);

      const user = await login(
        username,
        password
      );

      onLogin(user);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="setup-card">
        <div className="setup-header">
          <div className="logo-box">
            S
          </div>

          <div>
            <p className="eyebrow">
              PROJECT S
            </p>

            <h1>Welcome back</h1>

            <p className="subtitle">
              Sign in to access the store.
            </p>
          </div>
        </div>

        <form
          className="setup-form"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        <p className="security-note">
          Project S • Local Store System
        </p>
      </section>
    </main>
  );
}
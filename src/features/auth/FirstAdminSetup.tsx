import { FormEvent, useState } from "react";
import { createFirstAdmin } from "./authService";
import "./auth.css";

interface FirstAdminSetupProps {
  onComplete: () => void;
}

export default function FirstAdminSetup({
  onComplete,
}: FirstAdminSetupProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await createFirstAdmin({
        fullName,
        username,
        password,
      });

      onComplete();
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

            <h1>Set up your store</h1>

            <p className="subtitle">
              Create the primary administrator account.
            </p>
          </div>
        </div>

        <form
          className="setup-form"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="fullName">
              Administrator name
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Store owner name"
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              placeholder="admin"
              autoComplete="username"
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
                setPassword(event.target.value)
              }
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm password
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Enter password again"
              autoComplete="new-password"
              minLength={8}
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
              ? "Creating account..."
              : "Create Administrator"}
          </button>
        </form>

        <p className="security-note">
          Your password is securely hashed before
          being stored on this device.
        </p>
      </section>
    </main>
  );
}
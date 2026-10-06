import {
  useEffect,
  useState,
} from "react";

import FirstAdminSetup from "./features/auth/FirstAdminSetup";
import Login from "./features/auth/Login";

import AppShell from "./layout/AppShell";

import {
  hasAdmin,
} from "./features/auth/authService";

import type {
  AuthUser,
} from "./types/auth";

type AppState =
  | "loading"
  | "setup"
  | "login"
  | "authenticated"
  | "error";

function App() {
  const [appState, setAppState] =
    useState<AppState>("loading");

  const [currentUser, setCurrentUser] =
    useState<AuthUser | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function initialize() {
      try {
        const adminExists =
          await hasAdmin();

        setAppState(
          adminExists
            ? "login"
            : "setup"
        );
      } catch (err) {
        console.error(err);

        setError(String(err));
        setAppState("error");
      }
    }

    initialize();
  }, []);

  function handleLogin(
    user: AuthUser
  ) {
    setCurrentUser(user);
    setAppState("authenticated");
  }

  function handleLogout() {
    setCurrentUser(null);
    setAppState("login");
  }

  if (appState === "loading") {
    return (
      <main className="auth-page">
        <p>
          Starting Project S...
        </p>
      </main>
    );
  }

  if (appState === "setup") {
    return (
      <FirstAdminSetup
        onComplete={() =>
          setAppState("login")
        }
      />
    );
  }

  if (appState === "login") {
    return (
      <Login
        onLogin={handleLogin}
      />
    );
  }

  if (
  appState === "authenticated" &&
  currentUser
  ) {
    return (
      <AppShell
        user={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (appState === "error") {
    return (
      <main className="auth-page">
        <section className="setup-card">
          <h1>Project S</h1>

          <p>
            Failed to initialize.
          </p>

          <p>{error}</p>
        </section>
      </main>
    );
  }

  return null;
}

export default App;
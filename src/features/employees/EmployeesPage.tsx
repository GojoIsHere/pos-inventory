import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import {
  createCashier,
  getEmployees,
  setCashierActive,
  type Employee,
} from "./employeeService";

import "./employees.css";

interface EmployeesPageProps {
  user: AuthUser;
}

function formatDate(
  value: string
): string {
  const isoValue =
    value.includes("T")
      ? value
      : `${value.replace(
          " ",
          "T"
        )}Z`;

  const date =
    new Date(isoValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString();
}

export default function EmployeesPage({
  user,
}: EmployeesPageProps) {
  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    fullName,
    setFullName,
  ] = useState("");

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  async function loadEmployees() {
    try {
      setLoading(true);

      const results =
        await getEmployees();

      setEmployees(results);
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

  useEffect(() => {
    loadEmployees();
  }, []);

  const activeCashiers =
    useMemo(
      () =>
        employees.filter(
          (employee) =>
            employee.role ===
              "cashier"
            && employee.isActive ===
              1
        ).length,
      [employees]
    );

  function resetForm() {
    setFullName("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleCreate(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      if (
        password !==
        confirmPassword
      ) {
        throw new Error(
          "Passwords do not match."
        );
      }

      setSaving(true);

      await createCashier(
        fullName,
        username,
        password,
        user.id
      );

      resetForm();

      setShowForm(false);

      await loadEmployees();

      setSuccess(
        "Cashier account created successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(
    employee: Employee
  ) {
    setError("");
    setSuccess("");

    try {
      const nextStatus =
        employee.isActive !== 1;

      await setCashierActive(
        employee.id,
        nextStatus,
        user.id
      );

      await loadEmployees();

      setSuccess(
        `${employee.fullName} ${
          nextStatus
            ? "activated"
            : "deactivated"
        }.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  return (
    <section className="employees-page">
      <div className="employees-heading">
        <div>
          <p className="page-eyebrow">
            TEAM
          </p>

          <h2>Employees</h2>

          <p>
            Manage administrator and
            cashier access to Project S.
          </p>
        </div>

        <button
          className="employee-primary-button"
          onClick={() => {
            setShowForm(
              (current) => !current
            );

            setError("");
            setSuccess("");
          }}
        >
          {showForm
            ? "Close form"
            : "+ Add cashier"}
        </button>
      </div>

      <div className="employee-stats">
        <div>
          <span>
            Total accounts
          </span>

          <strong>
            {employees.length}
          </strong>
        </div>

        <div>
          <span>
            Active cashiers
          </span>

          <strong>
            {activeCashiers}
          </strong>
        </div>
      </div>

      {error && (
        <div className="employee-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="employee-alert success">
          {success}
        </div>
      )}

      {showForm && (
        <form
          className="employee-form-card"
          onSubmit={
            handleCreate
          }
        >
          <div>
            <p className="page-eyebrow">
              NEW CASHIER
            </p>

            <h3>
              Create cashier account
            </h3>

            <p>
              The cashier will use this
              username and password to
              sign into Project S.
            </p>
          </div>

          <div className="employee-form-grid">
            <div className="employee-field">
              <label>
                Employee name
              </label>

              <input
                value={
                  fullName
                }
                onChange={(
                  event
                ) =>
                  setFullName(
                    event.target
                      .value
                  )
                }
                placeholder="Cashier name"
                required
              />
            </div>

            <div className="employee-field">
              <label>
                Username
              </label>

              <input
                value={
                  username
                }
                onChange={(
                  event
                ) =>
                  setUsername(
                    event.target
                      .value
                  )
                }
                placeholder="cashier01"
                autoComplete="off"
                required
              />
            </div>

            <div className="employee-field">
              <label>
                Password
              </label>

              <input
                type="password"
                value={
                  password
                }
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
                minLength={8}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="employee-field">
              <label>
                Confirm password
              </label>

              <input
                type="password"
                value={
                  confirmPassword
                }
                onChange={(
                  event
                ) =>
                  setConfirmPassword(
                    event.target
                      .value
                  )
                }
                minLength={8}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="employee-form-actions">
            <button
              type="button"
              className="employee-secondary-button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="employee-primary-button"
              disabled={saving}
            >
              {saving
                ? "Creating..."
                : "Create Cashier"}
            </button>
          </div>
        </form>
      )}

      <div className="employee-table-card">
        {loading ? (
          <div className="employee-empty">
            Loading employees...
          </div>
        ) : (
          <div className="employee-table-wrapper">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>
                    Username
                  </th>

                  <th>
                    Role
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Created
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {employees.map(
                  (employee) => (
                    <tr
                      key={
                        employee.id
                      }
                    >
                      <td>
                        <div className="employee-name-cell">
                          <div className="employee-avatar">
                            {employee.fullName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <strong>
                            {
                              employee.fullName
                            }
                          </strong>
                        </div>
                      </td>

                      <td>
                        @
                        {
                          employee.username
                        }
                      </td>

                      <td>
                        <span
                          className={`employee-role ${employee.role}`}
                        >
                          {
                            employee.role
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            employee.isActive ===
                            1
                              ? "employee-status active"
                              : "employee-status inactive"
                          }
                        >
                          {employee.isActive ===
                          1
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          employee.createdAt
                        )}
                      </td>

                      <td>
                        {employee.role ===
                        "cashier" ? (
                          <button
                            className={
                              employee.isActive ===
                              1
                                ? "employee-deactivate-button"
                                : "employee-activate-button"
                            }
                            onClick={() =>
                              handleStatusChange(
                                employee
                              )
                            }
                          >
                            {employee.isActive ===
                            1
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                        ) : (
                          <span className="admin-protected">
                            Protected
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
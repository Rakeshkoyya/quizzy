"use client";

import { useState, useEffect, useCallback } from "react";

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  createdAt: string;
  _count: { exams: number; attempts: number };
}

export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Create user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Bulk upload state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkErrorDetails, setBulkErrorDetails] = useState<string[]>([]);
  const [bulkSuccess, setBulkSuccess] = useState("");

  const fetchUsers = useCallback(async (password: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      void fetchUsers(adminPassword);
    }
  }, [authenticated, adminPassword, fetchUsers]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/admin/users", {
      headers: { "x-admin-password": adminPassword },
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setAuthError("Invalid admin password");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          name: newName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setCreateSuccess(`User "${newUsername}" created successfully`);
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      void fetchUsers(adminPassword);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(userId: string, displayName: string) {
    if (!confirm(`Delete user "${displayName}"? This will delete all their exams and attempts.`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to delete user");
      void fetchUsers(adminPassword);
    } catch {
      alert("Failed to delete user");
    }
  }

  function downloadTemplate() {
    const csvContent = "username,password,name\nstudent1,pass1234,Student One\nstudent2,pass5678,Student Two\nstudent3,mypassword,Student Three\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk_users_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkFile) return;
    setBulkError("");
    setBulkErrorDetails([]);
    setBulkSuccess("");
    setBulkUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", bulkFile);
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "x-admin-password": adminPassword },
        body: formData,
      });
      const data = await res.json() as { message?: string; error?: string; details?: string[]; created?: number };
      if (!res.ok) {
        setBulkError(data.error || "Failed to bulk create users");
        if (data.details) setBulkErrorDetails(data.details);
        return;
      }
      setBulkSuccess(data.message || `Created ${data.created} users`);
      setBulkFile(null);
      // Reset the file input
      const fileInput = document.getElementById("bulk-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      void fetchUsers(adminPassword);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to upload");
    } finally {
      setBulkUploading(false);
    }
  }

  // ── Password Gate ──
  if (!authenticated) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5efe8]">
              <svg className="h-8 w-8 text-[#c9784e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Admin Panel</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Enter the admin password to continue</p>
          </div>

          <form onSubmit={(e) => void handleLogin(e)} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] focus:outline-none"
                placeholder="Enter admin password"
              />
            </div>
            {authError && (
              <p className="mb-4 rounded-lg bg-[var(--error-light)] px-3 py-2 text-sm text-[var(--error)]">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#c9784e] px-4 py-3 font-medium text-white hover:bg-[#b5673f]"
            >
              Access Admin Panel
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Admin Dashboard ──
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Admin Panel</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{users.length} users registered</p>
        </div>
        <button
          type="button"
          onClick={() => { setAuthenticated(false); setAdminPassword(""); }}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
        >
          Lock Panel
        </button>
      </header>

      {/* Create User Form */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Create New User</h2>
        <form onSubmit={(e) => void handleCreateUser(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Username *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                pattern="^[a-zA-Z0-9_]+$"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] focus:outline-none"
                placeholder="johndoe"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Password *</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={4}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] focus:outline-none"
                placeholder="password123"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">Display Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] focus:outline-none"
                placeholder="John Doe (optional)"
              />
            </div>
          </div>

          {createError && (
            <p className="rounded-lg bg-[var(--error-light)] px-3 py-2 text-sm text-[var(--error)]">{createError}</p>
          )}
          {createSuccess && (
            <p className="rounded-lg bg-[var(--success-light)] px-3 py-2 text-sm text-[var(--success)]">{createSuccess}</p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-[#c9784e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>

      {/* Bulk Upload Users */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Bulk Create Users</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Upload a CSV file to create multiple users at once. The file must have <strong>username</strong> and <strong>password</strong> columns. An optional <strong>name</strong> column sets the display name.
        </p>

        {/* Download Template */}
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Template CSV
          </button>
          <span className="text-xs text-[var(--muted)]">Open in Excel/Google Sheets, fill in, and save as CSV</span>
        </div>

        {/* Upload Form */}
        <form onSubmit={(e) => void handleBulkUpload(e)} className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--background)] px-5 py-3 text-sm font-medium text-[var(--foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors">
              <svg className="h-5 w-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {bulkFile ? bulkFile.name : "Choose CSV file"}
              <input
                id="bulk-file-input"
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  setBulkFile(e.target.files?.[0] || null);
                  setBulkError("");
                  setBulkErrorDetails([]);
                  setBulkSuccess("");
                }}
              />
            </label>
            {bulkFile && (
              <span className="text-xs text-[var(--muted)]">
                {(bulkFile.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          {bulkError && (
            <div className="rounded-lg bg-[var(--error-light)] px-3 py-2">
              <p className="text-sm font-medium text-[var(--error)]">{bulkError}</p>
              {bulkErrorDetails.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-[var(--error)]">
                  {bulkErrorDetails.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {bulkSuccess && (
            <p className="rounded-lg bg-[var(--success-light)] px-3 py-2 text-sm text-[var(--success)]">{bulkSuccess}</p>
          )}

          <button
            type="submit"
            disabled={!bulkFile || bulkUploading}
            className="rounded-xl bg-[#c9784e] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkUploading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </span>
            ) : (
              "Upload & Create Users"
            )}
          </button>
        </form>
      </section>

      {/* Users List */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">All Users</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">No users yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--secondary-light)]">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-[var(--foreground)]">User</th>
                  <th className="px-6 py-3 text-left font-medium text-[var(--foreground)]">Login</th>
                  <th className="px-6 py-3 text-center font-medium text-[var(--foreground)]">Exams</th>
                  <th className="px-6 py-3 text-center font-medium text-[var(--foreground)]">Attempts</th>
                  <th className="px-6 py-3 text-right font-medium text-[var(--foreground)]">Joined</th>
                  <th className="px-6 py-3 text-right font-medium text-[var(--foreground)]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--secondary-light)]">
                    <td className="px-6 py-3">
                      <p className="font-medium text-[var(--foreground)]">{user.name || "—"}</p>
                      <p className="text-xs text-[var(--muted)]">{user.id}</p>
                    </td>
                    <td className="px-6 py-3">
                      {user.username ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary-light)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          {user.username}
                        </span>
                      ) : user.email ? (
                        <span className="text-xs text-[var(--muted)]">{user.email}</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--secondary-light)] px-1.5 text-xs font-medium text-[var(--foreground)]">
                        {user._count.exams}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[var(--secondary-light)] px-1.5 text-xs font-medium text-[var(--foreground)]">
                        {user._count.attempts}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-[var(--muted)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(user.id, user.name || user.username || user.email || user.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-light)]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

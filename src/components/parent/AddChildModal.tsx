"use client";
import { useState } from "react";
import type { AddChildForm } from "@/types/parent";

interface Props {
  onClose: () => void;
  onAdd: (form: AddChildForm) => void;
  loading?: boolean;
  serverError?: string | null;
}

const GRADES = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function AddChildModal({ onClose, onAdd, loading = false, serverError }: Props) {
  const [form, setForm] = useState<AddChildForm>({ name: "", email: "", password: "", grade: "", dob: "" });
  const [errors, setErrors] = useState<Partial<AddChildForm>>({});
  const [showPw, setShowPw] = useState(false);

  const validate = () => {
    const e: Partial<AddChildForm> = {};
    if (!form.name.trim())            e.name     = "Name is required";
    if (!form.email.includes("@"))    e.email    = "Valid email required";
    if (form.password.length < 6)     e.password = "Min 6 characters";
    if (!form.grade)                  e.grade    = "Select a grade";
    if (!form.dob)                    e.dob      = "Date of birth required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => { if (validate()) onAdd(form); };

  const field = (hasError: boolean) =>
    `w-full h-11 px-3.5 rounded-lg border bg-bg text-primary text-sm outline-none transition-all ${
      hasError
        ? "border-coral focus:ring-2 focus:ring-coral/20"
        : "border-border focus:border-gold focus:ring-2 focus:ring-gold/20"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel — bottom sheet on mobile, centered card on sm+ */}
      <div className="relative w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden animate-slide-up sm:animate-fade-up">
        {/* Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-gold via-teal to-violet" />

        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 sm:px-7 pt-4 sm:pt-5 pb-6 sm:pb-7">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">👦</span>
            </div>
            <div>
              <h2 className="font-display font-800 text-lg text-primary">Add a Child Account</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Your child will use these credentials to log in
              </p>
            </div>
            <button
              type="button"
                aria-label="Close modal"
              onClick={onClose}
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg transition-colors flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Child's Name
              </label>
              <input
                type="text" placeholder="e.g. Layla"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={field(!!errors.name)}
              />
              {errors.name && <p className="text-xs text-coral mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email" placeholder="layla@yourfamily.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={field(!!errors.email)}
              />
              {errors.email && <p className="text-xs text-coral mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={`${field(!!errors.password)} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors p-1"
                >
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                      <circle cx="8" cy="8" r="2"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010.4 10M4.5 4.6C2.8 5.7 1.5 7.6 1.5 8s2.7 5 6.5 5a6.8 6.8 0 003.5-1M8 3C11.8 3 14.5 7.6 14.5 8a7.2 7.2 0 01-.9 1.8"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="text-xs text-coral mt-1">{errors.password}</p>}
            </div>

            {/* Grade + DOB — side by side on sm+, stacked on xs */}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  School Grade
                </label>
                <select
                  aria-label="Select school grade"
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  className={`${field(!!errors.grade)} appearance-none`}
                >
                  <option value="">Select grade</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
                {errors.grade && <p className="text-xs text-coral mt-1">{errors.grade}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Date of Birth
                </label>
                <input
                  aria-label="Select date of birth"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                  className={field(!!errors.dob)}
                />
                {errors.dob && <p className="text-xs text-coral mt-1">{errors.dob}</p>}
              </div>
            </div>
          </div>

          {/* Server-side error */}
          {serverError && (
            <p className="mt-4 text-xs text-coral font-medium text-center">{serverError}</p>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-lg border border-border text-text-muted text-sm font-semibold hover:bg-bg transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 h-11 rounded-lg bg-gold text-primary text-sm font-display font-extrabold hover:brightness-105 transition-all shadow-sm disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create Account ✨"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { FormEvent, ReactNode, useState } from "react";

type Expense = {
  id: number;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string | null;
  remarks: string | null;
  createdByName: string;
};

type Props = {
  initialExpenses: Expense[];
  totalExpenses: number;
};

const paymentMethods = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE", label: "Cheque" },
] as const;

export default function ExpenseManager({
  initialExpenses,
  totalExpenses,
}: Props) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const closeForm = () => {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setError("");
  };

  const openNew = () => {
    setEditing(null);
    setError("");
    setOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setError("");
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const formData = new FormData(event.currentTarget);
    const expenseDate = String(formData.get("expenseDate") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const amount = String(formData.get("amount") ?? "").trim();
    const paymentMethod = String(formData.get("paymentMethod") ?? "CASH");
    const referenceNo = String(formData.get("referenceNo") ?? "").trim();
    const remarks = String(formData.get("remarks") ?? "").trim();

    if (!expenseDate || !category || !description || !amount) {
      setError("Date, category, description and amount are required.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Expense amount must be greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const endpoint = editing
        ? `/api/expenses/${editing.id}`
        : "/api/expenses";

      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expenseDate,
          category,
          description,
          amount: numericAmount,
          paymentMethod,
          referenceNo: referenceNo || null,
          remarks: remarks || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save expense.");
      }

      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save expense."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (saving) return;

    const confirmed = window.confirm(
      `Delete this expense of ${formatLkr(expense.amount)}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete expense.");
      }

      setExpenses((current) =>
        current.filter((item) => item.id !== expense.id)
      );
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete expense."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Expenses</h2>
          <p className="mt-1 text-xs text-black/40">
            Business expenses recorded in the selected date range.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-black/55">
            {formatLkr(totalExpenses)}
          </span>
          <button
            type="button"
            onClick={openNew}
            className="h-9 rounded-lg bg-black px-4 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
          >
            + Add Expense
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="mt-5 flex min-h-36 items-center justify-center rounded-lg border border-dashed border-black/10 bg-[#fafaf9] px-5 text-center">
          <p className="text-sm text-black/40">
            No expenses found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-black/10">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Category</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Description</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Method</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">Amount</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">Reference</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-black/5 last:border-b-0 hover:bg-[#fafaf9]"
                >
                  <td className="px-4 py-3 text-xs text-black/60">
                    {formatDate(expense.expenseDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium">
                    {expense.category}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium">{expense.description}</p>
                    {expense.remarks ? (
                      <p className="mt-0.5 max-w-72 truncate text-[10px] text-black/35">
                        {expense.remarks}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/60">
                    {formatPaymentMethod(expense.paymentMethod)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold">
                    {formatLkr(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-black/50">
                    {expense.referenceNo || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(expense)}
                        className="text-xs font-medium text-black/45 transition hover:text-black"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        className="text-xs font-medium text-red-500 transition hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h3 className="text-base font-semibold">
                  {editing ? "Edit Expense" : "Add Expense"}
                </h3>
                <p className="mt-1 text-xs text-black/40">
                  Record a business expense.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expense Date" htmlFor="expense-date">
                  <input
                    id="expense-date"
                    name="expenseDate"
                    type="date"
                    defaultValue={
                      editing
                        ? editing.expenseDate.slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                    }
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Category" htmlFor="expense-category">
                  <input
                    id="expense-category"
                    name="category"
                    type="text"
                    defaultValue={editing?.category ?? ""}
                    placeholder="Office Rent"
                    required
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Description" htmlFor="expense-description">
                <input
                  id="expense-description"
                  name="description"
                  type="text"
                  defaultValue={editing?.description ?? ""}
                  placeholder="September office rent"
                  required
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Amount" htmlFor="expense-amount">
                  <input
                    id="expense-amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={editing?.amount ?? ""}
                    placeholder="0.00"
                    required
                    className={inputClass}
                  />
                </Field>

                <Field label="Payment Method" htmlFor="expense-method">
                  <select
                    id="expense-method"
                    name="paymentMethod"
                    defaultValue={editing?.paymentMethod ?? "CASH"}
                    className={inputClass}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Reference No. (Optional)" htmlFor="expense-reference">
                <input
                  id="expense-reference"
                  name="referenceNo"
                  type="text"
                  defaultValue={editing?.referenceNo ?? ""}
                  placeholder="Receipt / voucher number"
                  className={inputClass}
                />
              </Field>

              <Field label="Remarks (Optional)" htmlFor="expense-remarks">
                <textarea
                  id="expense-remarks"
                  name="remarks"
                  rows={3}
                  defaultValue={editing?.remarks ?? ""}
                  placeholder="Optional notes..."
                  className={`${inputClass} resize-none py-3`}
                />
              </Field>

              {error ? (
                <p className="text-xs font-medium text-red-600">{error}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-black/10 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="h-10 rounded-lg border border-black/10 px-4 text-xs font-medium text-black/60 transition hover:border-black/20 hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-black px-5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium text-black/50"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10";

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function formatLkr(value: number) {
  return `LKR ${new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatPaymentMethod(method: string) {
  switch (method) {
    case "BANK_TRANSFER":
      return "Bank Transfer";
    case "CASH":
      return "Cash";
    case "CARD":
      return "Card";
    case "CHEQUE":
      return "Cheque";
    default:
      return method;
  }
}

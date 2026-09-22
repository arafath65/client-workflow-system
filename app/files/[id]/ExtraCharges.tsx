"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Charge = {
  id: number;
  description: string;
  quantity: number;
  unitAmount: string;
  totalAmount: string;
  createdAt: string;
};

type Props = {
  fileId: number;
  onChanged?: () => void;
};

export default function ExtraCharges({
  fileId,
  onChanged,
}: Props) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [total, setTotal] = useState("0.00");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState("");

  const loadCharges = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/files/${fileId}/charges`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to load extra charges."
        );
      }

      setCharges(data.charges ?? []);
      setTotal(data.totalAmount ?? "0.00");
    } catch (error) {
      console.error(
        "Load extra charges error:",
        error
      );

      setError(
        "Unable to load extra charges."
      );
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCharges();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCharges]);

  const resetForm = () => {
    setDescription("");
    setQuantity("1");
    setUnitAmount("");
    setError("");
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (saving) return;

    const cleanDescription =
      description.trim();

    const cleanQuantity = quantity.trim();
    const cleanUnitAmount =
      unitAmount.trim();

    if (!cleanDescription) {
      setError(
        "Charge description is required."
      );
      return;
    }

    if (
      !/^\d+$/.test(cleanQuantity) ||
      Number(cleanQuantity) <= 0
    ) {
      setError(
        "Quantity must be a positive whole number."
      );
      return;
    }

    if (
      !/^\d+(?:\.\d{1,2})?$/.test(
        cleanUnitAmount
      )
    ) {
      setError(
        "Enter a valid unit amount."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/files/${fileId}/charges`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description:
              cleanDescription,
            quantity: Number(cleanQuantity),
            unitAmount:
              cleanUnitAmount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            "Unable to add extra charge."
        );
        return;
      }

      resetForm();
      setOpen(false);

      await loadCharges();

      onChanged?.();
    } catch (error) {
      console.error(
        "Add extra charge error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSaving(false);
    }
  };

  const money = (value: string | number) =>
    Number(value).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="mt-6 border-t border-black/10 pt-5">
      {/* Header */}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            Extra Charges
          </h3>

          <p className="mt-1 text-xs text-black/40">
            Additional charges outside the service fees.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setOpen((value) => !value);
          }}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black transition hover:border-[#f9a800] hover:bg-[#f9a800]/10"
        >
          {open
            ? "Cancel"
            : "+ Add Extra Charge"}
        </button>
      </div>

      {/* Add Form */}

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-black/10 bg-[#fafaf9] p-4"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Description *
              </label>

              <input
                type="text"
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                placeholder="e.g. Translation"
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Quantity *
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value
                  )
                }
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-black/60">
                Unit Amount *
              </label>

              <input
                type="text"
                inputMode="decimal"
                value={unitAmount}
                onChange={(e) =>
                  setUnitAmount(
                    e.target.value
                  )
                }
                placeholder="0.00"
                className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
            >
              {saving
                ? "Adding..."
                : "Add Charge"}
            </button>
          </div>
        </form>
      )}

      {/* Charge List */}

      {loading ? (
        <div className="mt-4 rounded-lg bg-[#fafaf9] p-5 text-center">
          <p className="text-xs text-black/40">
            Loading charges...
          </p>
        </div>
      ) : charges.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-black/10 bg-[#fafaf9] p-5 text-center">
          <p className="text-xs text-black/40">
            No extra charges added.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-black/10 bg-[#fafaf9]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Description
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Qty
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Unit Amount
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-black/40">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {charges.map((charge) => (
                <tr
                  key={charge.id}
                  className="border-b border-black/5 last:border-b-0"
                >
                  <td className="px-4 py-3 text-xs font-medium">
                    {charge.description}
                  </td>

                  <td className="px-4 py-3 text-right text-xs text-black/60">
                    {charge.quantity}
                  </td>

                  <td className="px-4 py-3 text-right text-xs text-black/60">
                    {money(charge.unitAmount)}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {money(charge.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-4 text-right text-xs font-semibold text-black/50"
                >
                  Total Extra Charges
                </td>

                <td className="px-4 py-4 text-right text-sm font-semibold">
                  {money(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
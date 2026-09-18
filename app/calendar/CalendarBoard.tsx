"use client";

import { useEffect, useMemo, useState } from "react";

type Staff = {
  id: number;
  name: string;
};

type FileOption = {
  id: number;
  fileNumber: string;
  title: string;
  client: {
    id: number;
    name: string;
  };
};

type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  clientFile: {
    id: number;
    fileNumber: string;
    title: string;
    client: { id: number; name: string };
  } | null;
  staff: { id: number; name: string } | null;
};

type CalendarBoardProps = {
  initialYear: number;
  initialMonth: number;
  staff: Staff[];
  files: FileOption[];
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CalendarBoard({
  initialYear,
  initialMonth,
  staff,
  files,
}: CalendarBoardProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const monthDays = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const firstWeekday = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: Array<number | null> = Array.from(
      { length: firstWeekday },
      () => null
    );

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(day);
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setLoaded(false);
      setError("");

      const from = `${year}-${pad2(month)}-01T00:00`;
      const next =
        month === 12
          ? `${year + 1}-01-01T00:00`
          : `${year}-${pad2(month + 1)}-01T00:00`;

      try {
        const response = await fetch(
          `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(next)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load calendar.");
        }

        if (!cancelled) {
          setEvents(data.events ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Load calendar error:", err);
          setError("Unable to load calendar events.");
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [year, month, refreshKey]);

  const goToMonth = (delta: number) => {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
    setLoaded(false);
  };

  const goToday = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "numeric",
    }).formatToParts(now);
    const map = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    setYear(Number(map.year));
    setMonth(Number(map.month));
    setLoaded(false);
  };

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    const day = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Colombo",
        day: "numeric",
      }).format(new Date(event.startAt))
    );
    const list = eventsByDay.get(day) ?? [];
    list.push(event);
    eventsByDay.set(day, list);
  }

  const openForm = (day?: number) => {
    setError("");
    if (day) {
      setSelectedDate(`${year}-${pad2(month)}-${pad2(day)}`);
    } else {
      setSelectedDate("");
    }
    setShowForm(true);
  };

  const saveEvent = async (form: HTMLFormElement) => {
    setSaving(true);
    setError("");

    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const date = String(formData.get("date") ?? "");
    const startTime = String(formData.get("startTime") ?? "");
    const endTime = String(formData.get("endTime") ?? "");
    const description = String(formData.get("description") ?? "");
    const clientFileId = String(formData.get("clientFileId") ?? "");
    const staffId = String(formData.get("staffId") ?? "");

    if (!title || !date) {
      setError("Title and date are required.");
      setSaving(false);
      return;
    }

    if (endTime && !startTime) {
      setError("Select a start time before adding an end time.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          date,
          startAt: startTime ? `${date}T${startTime}` : null,
          endAt: endTime ? `${date}T${endTime}` : null,
          clientFileId: clientFileId || null,
          staffId: staffId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save event.");
      }

      setShowForm(false);
      setLoaded(false);
      setRefreshKey((current) => current + 1);
    } catch (err) {
      console.error("Create calendar event error:", err);
      setError(err instanceof Error ? err.message : "Unable to save event.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {MONTHS[month - 1]} {year}
            </h2>
            <p className="mt-1 text-xs text-black/40">
              {loaded ? `${events.length} event${events.length === 1 ? "" : "s"} this month` : "Loading events..."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="h-9 rounded-lg border border-black/10 px-3 text-xs font-medium hover:border-black/20"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-lg border border-black/10 px-3 text-xs font-medium hover:border-[#f9a800]/50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="h-9 rounded-lg border border-black/10 px-3 text-xs font-medium hover:border-black/20"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => openForm()}
              className="h-9 rounded-lg bg-black px-4 text-xs font-semibold text-white hover:bg-[#f9a800] hover:text-black"
            >
              + New Event
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-lg border border-black/10">
          <div className="grid grid-cols-7 border-b border-black/10 bg-[#fafaf9]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="border-r border-black/5 px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-black/40 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day, index) => {
              const dayEvents = day ? eventsByDay.get(day) ?? [] : [];
              const dateString = day
                ? `${year}-${pad2(month)}-${pad2(day)}`
                : "";

              return (
                <div
                  key={`${day ?? "empty"}-${index}`}
                  className="min-h-[125px] border-b border-r border-black/5 bg-white p-2 last:border-r-0"
                >
                  {day ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openForm(day)}
                        className="mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold hover:bg-[#fff7e6]"
                        title={`Add event on ${dateString}`}
                      >
                        {day}
                      </button>

                      <div className="space-y-1.5">
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className={`rounded-md border px-2 py-1.5 ${
                              event.status === "CANCELLED"
                                ? "border-black/5 bg-black/[0.03] opacity-50"
                                : event.status === "COMPLETED"
                                  ? "border-green-200 bg-green-50"
                                  : "border-[#f9a800]/25 bg-[#fffaf0]"
                            }`}
                          >
                            <p className="truncate text-[10px] font-semibold">
                              {formatEventTime(event)}
                            </p>
                            <p className="truncate text-[11px] font-medium">
                              {event.title}
                            </p>
                            {event.clientFile ? (
                              <p className="truncate text-[9px] text-black/40">
                                {event.clientFile.client.name} · {event.clientFile.fileNumber}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
                  Calendar
                </p>
                <h3 className="mt-1 text-xl font-semibold">New Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-lg text-black/35 hover:text-black"
              >
                ×
              </button>
            </div>

            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEvent(e.currentTarget);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Title
                  </label>
                  <input
                    name="title"
                    required
                    placeholder="Client appointment / follow-up..."
                    className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Date
                  </label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={selectedDate}
                    className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Start Time <span className="font-normal text-black/30">(Optional)</span>
                  </label>
                  <input
                    name="startTime"
                    type="time"
                    className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    End Time <span className="font-normal text-black/30">(Optional)</span>
                  </label>
                  <input
                    name="endTime"
                    type="time"
                    className="h-10 w-full rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Staff
                  </label>
                  <select
                    name="staffId"
                    className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800]"
                  >
                    <option value="">No staff assigned</option>
                    {staff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Client File
                  </label>
                  <select
                    name="clientFileId"
                    className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#f9a800]"
                  >
                    <option value="">No client file</option>
                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.fileNumber} — {file.client.name} — {file.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-black/50">
                    Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Optional notes..."
                    className="w-full resize-none rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatEventTime(event: CalendarEvent) {
  const date = new Date(event.startAt);

  // Creation allows an event without a time. Those events are stored at
  // midnight so the existing required database field remains valid.
  if (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    !event.endAt
  ) {
    return "All day";
  }

  return new Intl.DateTimeFormat("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Colombo",
  }).format(date);
}

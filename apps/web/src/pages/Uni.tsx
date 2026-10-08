import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Course, CreateUniItemInput, UniItem, UpdateUniItemInput } from "@apex/shared";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text";
const button = "rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const DUBAI_OFFSET_MS = 4 * 60 * 60_000;
const reminderOptions = [
  { minutes: null, label: "No reminder" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
] as const;

function localParts(iso: string): { date: string; time: string } {
  const local = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
function dubaiDay(): string {
  return new Date(Date.now() + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
}
function dayAfter(day: string, days: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
}
function weekdayFor(day: string): number {
  return (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
}
function dayLabel(day: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Dubai", weekday: "short", month: "short", day: "numeric",
  }).format(new Date(day + "T08:00:00Z"));
}

function localWeekday(): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai", weekday: "long",
  }).format(new Date());
  return DAYS.indexOf(name);
}

function deadlineLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Dubai", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export function Uni() {
  const qc = useQueryClient();
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ["uni"],
    queryFn: () => api.get<Course[]>("/api/uni/courses"),
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [courseId, setCourseId] = useState("");
  const [kind, setKind] = useState<CreateUniItemInput["kind"]>("assignment");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("23:59");
  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderLead, setReminderLead] = useState<number | null>(1440);
  const [courseEditId, setCourseEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editing, setEditing] = useState<UniItem | null>(null);
  const [editDraft, setEditDraft] = useState({
    courseId: "", title: "", date: "", time: "23:59",
    weekday: 0, startTime: "", endTime: "", location: "", notes: "",
    reminderLead: null as number | null,
  });
  const [message, setMessage] = useState("");

  function refresh() {
    qc.invalidateQueries({ queryKey: ["uni"] });
    qc.invalidateQueries({ queryKey: ["today"] });
  }

  const addCourse = useMutation({
    mutationFn: () => api.post<Course>("/api/uni/courses", { name: name.trim(), code: code.trim() || null }),
    onSuccess(course) { refresh(); setName(""); setCode(""); setCourseId(course.id); setMessage(""); },
    onError(err: Error) { setMessage(err.message); },
  });
  const saveCourse = useMutation({
    mutationFn: ({ id, name, code }: { id: string; name: string; code: string | null }) =>
      api.patch<Course>("/api/uni/courses/" + id, { name, code }),
    onSuccess() { refresh(); setCourseEditId(null); setMessage(""); },
    onError(err: Error) { setMessage(err.message); },
  });
  const addItem = useMutation({
    mutationFn: (item: CreateUniItemInput) => api.post<UniItem>("/api/uni/items", item),
    onSuccess() { refresh(); setTitle(""); setDate(""); setStartTime(""); setEndTime(""); setLocation(""); setNotes(""); setMessage(""); },
    onError(err: Error) { setMessage(err.message); },
  });
  const update = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api.patch<UniItem>("/api/uni/items/" + id, { done }),
    onSuccess: refresh,
    onError(err: Error) { setMessage(err.message); },
  });
  const saveItem = useMutation({
    mutationFn: ({ id, change }: { id: string; change: UpdateUniItemInput }) =>
      api.patch<UniItem>("/api/uni/items/" + id, change),
    onSuccess() { refresh(); setEditing(null); setMessage(""); },
    onError(err: Error) { setMessage(err.message); },
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>("/api/uni/items/" + id),
    onSuccess: refresh,
    onError(err: Error) { setMessage(err.message); },
  });
  const removeCourse = useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>("/api/uni/courses/" + id),
    onSuccess() { refresh(); setCourseId(""); setCourseEditId(null); setEditing(null); },
    onError(err: Error) { setMessage(err.message); },
  });

  const selected = courses.some((course) => course.id === courseId) ? courseId : courses[0]?.id ?? "";
  const today = localWeekday();
  const todayDay = dubaiDay();
  const classes = courses.flatMap((course) =>
    course.items.filter((item) => item.kind === "class")
      .map((item) => ({ ...item, course: course.code ?? course.name })),
  ).sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0) ||
    (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  const deadlines = courses.flatMap((course) =>
    course.items.filter((item) => item.kind !== "class")
      .map((item) => ({ ...item, course: course.code ?? course.name })),
  ).sort((a, b) => Number(a.done) - Number(b.done) ||
    (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const nextSevenDays = Array.from({ length: 7 }, (_, index) => {
    const day = dayAfter(todayDay, index);
    const events = [
      ...classes.filter((item) => item.weekday === weekdayFor(day))
        .map((item) => ({ ...item, eventTime: item.startTime ?? "" })),
      ...deadlines.filter((item) => !item.done && item.dueAt &&
        localParts(item.dueAt).date === day)
        .map((item) => ({ ...item, eventTime: item.dueAt ? localParts(item.dueAt).time : "" })),
    ].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
    return { day, events };
  });

  function beginEdit(item: UniItem) {
    const parts = item.dueAt ? localParts(item.dueAt) : null;
    setEditDraft({
      courseId: item.courseId, title: item.title, date: parts?.date ?? "",
      time: parts?.time ?? "23:59", weekday: item.weekday ?? 0,
      startTime: item.startTime ?? "", endTime: item.endTime ?? "",
      location: item.location ?? "", notes: item.notes ?? "",
      reminderLead: item.reminderLead,
    });
    setEditing(item);
    setMessage("");
  }

  function submitEdit() {
    if (!editing || !editDraft.title.trim()) return;
    const change: UpdateUniItemInput = {
      courseId: editDraft.courseId, title: editDraft.title.trim(),
      notes: editDraft.notes.trim() || null,
    };
    if (editing.kind === "class") {
      if (!editDraft.startTime || !editDraft.endTime || editDraft.endTime <= editDraft.startTime) {
        setMessage("Add a valid start and end time."); return;
      }
      Object.assign(change, {
        weekday: editDraft.weekday, startTime: editDraft.startTime,
        endTime: editDraft.endTime, location: editDraft.location.trim() || null,
      });
    } else {
      if (!editDraft.date || !editDraft.time) {
        setMessage("Add a deadline and time."); return;
      }
      Object.assign(change, {
        dueAt: new Date(editDraft.date + "T" + editDraft.time + ":00+04:00").toISOString(),
        reminderLead: editDraft.reminderLead,
      });
    }
    saveItem.mutate({ id: editing.id, change });
  }

  function submitItem() {
    if (!selected || !title.trim()) return;
    if (kind === "class") {
      if (!startTime || !endTime || endTime <= startTime) {
        setMessage("Add a valid start and end time.");
        return;
      }
      addItem.mutate({ courseId: selected, kind, title: title.trim(),
        weekday, startTime, endTime, location: location.trim() || null,
        notes: notes.trim() || null });
    } else {
      if (!date || !time) { setMessage("Add a deadline and time."); return; }
      addItem.mutate({ courseId: selected, kind, title: title.trim(),
        dueAt: new Date(date + "T" + time + ":00+04:00").toISOString(),
        notes: notes.trim() || null, reminderLead });
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <header>
        <h1 className="font-display text-[26px] font-bold text-text">Uni</h1>
        <p className="text-sm text-muted">Classes and deadlines in Dubai time.</p>
      </header>
      {error && <p role="alert" className="text-sm text-bad">{(error as Error).message}</p>}
      {message && <p role="alert" className="text-sm text-bad">{message}</p>}

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-text">Courses</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) addCourse.mutate(); }}
          className="flex flex-wrap gap-2">
          <input aria-label="Course name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Course name" className={input + " min-w-32 flex-1"} />
          <input aria-label="Course code" value={code} onChange={(e) => setCode(e.target.value)}
            placeholder="Code" className={input + " w-24"} />
          <button type="submit" className={button} disabled={!name.trim() || addCourse.isPending}>Add</button>
        </form>
        {isLoading ? <p className="text-sm text-muted">Loading courses…</p> :
          courses.length === 0 ? <p className="text-sm text-muted">Add your first course to start planning uni.</p> :
          <ul className="space-y-1 text-sm">
            {courses.map((course) => (
              <li key={course.id} className="flex items-center gap-2 text-text">
                {courseEditId === course.id ? (
                  <form className="flex flex-1 flex-wrap gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim()) saveCourse.mutate({
                      id: course.id, name: editName.trim(), code: editCode.trim() || null,
                    });
                  }}>
                    <input aria-label="Edit course name" className={input + " min-w-32 flex-1"}
                      value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input aria-label="Edit course code" className={input + " w-24"}
                      value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                    <button type="submit" className={button}
                      disabled={!editName.trim() || saveCourse.isPending}>Save</button>
                    <button type="button" className="text-xs text-muted"
                      onClick={() => setCourseEditId(null)}>Cancel</button>
                  </form>
                ) : <>
                  <span className="min-w-0 flex-1">{course.code ? course.code + " · " : ""}{course.name}</span>
                  <button className="text-xs text-accent" aria-label={"Edit " + course.name}
                    onClick={() => {
                      setEditName(course.name); setEditCode(course.code ?? "");
                      setCourseEditId(course.id); setMessage("");
                    }}>Edit</button>
                  <button className="text-xs text-muted" aria-label={"Delete " + course.name}
                    onClick={() => {
                      if (window.confirm("Delete this course and all its classes and deadlines?")) removeCourse.mutate(course.id);
                    }}>Delete</button>
                </>}
              </li>
            ))}
          </ul>}
      </section>

      {courses.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold text-text">Add class or deadline</h2>
          <select aria-label="Course" className={input} value={selected}
            onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((course) => <option key={course.id} value={course.id}>
              {course.code ? course.code + " · " : ""}{course.name}
            </option>)}
          </select>
          <select aria-label="Type" className={input} value={kind}
            onChange={(e) => setKind(e.target.value as CreateUniItemInput["kind"])}>
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
            <option value="class">Weekly class</option>
          </select>
          <input aria-label="Title" className={input} value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "class" ? "Lecture / lab" : "Assignment / exam name"} />
          {kind === "class" ? <>
            <select aria-label="Weekday" className={input} value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}>
              {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">Start
                <input type="time" className={input} value={startTime}
                  onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="flex-1 text-xs text-muted">End
                <input type="time" className={input} value={endTime}
                  onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
            <input aria-label="Location (optional)" className={input} value={location}
              onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
          </> : <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">Deadline
                <input type="date" className={input} value={date}
                  onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="w-28 text-xs text-muted">Time
                <input type="time" className={input} value={time}
                  onChange={(e) => setTime(e.target.value)} />
              </label>
            </div>
            <label className="block text-xs text-muted">Reminder
              <select className={input} value={reminderLead ?? ""}
                onChange={(e) => setReminderLead(e.target.value === "" ? null : Number(e.target.value))}>
                {reminderOptions.map((option) => <option key={option.label} value={option.minutes ?? ""}>
                  {option.label}
                </option>)}
              </select>
            </label>
            <p className="text-xs text-muted">Push reminders need notifications enabled in <Link className="text-accent" to="/settings">Settings</Link>.</p>
          </>}
          <textarea aria-label="Notes (optional)" className={input}
            placeholder="Notes (optional)" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
          <button className={button} onClick={submitItem}
            disabled={!title.trim() || addItem.isPending}>Save</button>
        </section>
      )}

      {editing && <section className="space-y-3 rounded-2xl border border-accent bg-surface p-4">
        <h2 className="font-semibold text-text">Edit {editing.kind}</h2>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submitEdit(); }}>
          <select aria-label="Edit course" className={input} value={editDraft.courseId}
            onChange={(e) => setEditDraft({ ...editDraft, courseId: e.target.value })}>
            {courses.map((course) => <option key={course.id} value={course.id}>
              {course.code ? course.code + " · " : ""}{course.name}
            </option>)}
          </select>
          <input aria-label="Edit title" className={input} value={editDraft.title}
            onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
          {editing.kind === "class" ? <>
            <select aria-label="Edit weekday" className={input} value={editDraft.weekday}
              onChange={(e) => setEditDraft({ ...editDraft, weekday: Number(e.target.value) })}>
              {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">Start
                <input type="time" className={input} value={editDraft.startTime}
                  onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })} />
              </label>
              <label className="flex-1 text-xs text-muted">End
                <input type="time" className={input} value={editDraft.endTime}
                  onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })} />
              </label>
            </div>
            <input aria-label="Edit location" className={input} placeholder="Location (optional)"
              value={editDraft.location}
              onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
          </> : <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted">Deadline
                <input type="date" className={input} value={editDraft.date}
                  onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })} />
              </label>
              <label className="w-28 text-xs text-muted">Time
                <input type="time" className={input} value={editDraft.time}
                  onChange={(e) => setEditDraft({ ...editDraft, time: e.target.value })} />
              </label>
            </div>
            <label className="block text-xs text-muted">Reminder
              <select className={input} value={editDraft.reminderLead ?? ""}
                onChange={(e) => setEditDraft({
                  ...editDraft, reminderLead: e.target.value === "" ? null : Number(e.target.value),
                })}>
                {reminderOptions.map((option) => <option key={option.label} value={option.minutes ?? ""}>
                  {option.label}
                </option>)}
              </select>
            </label>
          </>}
          <textarea aria-label="Edit notes" className={input} value={editDraft.notes}
            onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
          <div className="flex gap-3">
            <button type="submit" className={button}
              disabled={!editDraft.title.trim() || saveItem.isPending}>Save changes</button>
            <button type="button" className="text-sm text-muted" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      </section>}

      <section className="space-y-2">
        <h2 className="font-semibold text-text">Classes today</h2>
        {classes.filter((item) => item.weekday === today).length === 0
          ? <p className="text-sm text-muted">No classes today.</p>
          : classes.filter((item) => item.weekday === today).map((item) =>
            <p key={item.id} className="rounded-xl border border-line bg-surface p-3 text-sm text-text">
              {item.startTime}–{item.endTime} · {item.course} · {item.title}
              {item.location ? " · " + item.location : ""}
            </p>)}
      </section>
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold text-text">Next 7 days</h2>
        {nextSevenDays.map(({ day, events }) => (
          <div key={day} className="border-t border-line pt-2">
            <h3 className="text-sm font-medium text-text">{dayLabel(day)}</h3>
            {events.length ? events.map((item) => (
              <div key={item.id} className="mt-1 flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 tabular-nums text-muted">{item.eventTime}</span>
                <span className="min-w-0 flex-1 text-text">
                  {item.course} · {item.title} · {item.kind}
                </span>
                <button className="text-accent" aria-label={"Edit " + item.title}
                  onClick={() => beginEdit(item)}>Edit</button>
              </div>
            )) : <p className="text-xs text-muted">No uni events.</p>}
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-text">Assignments and exams</h2>
        {deadlines.length === 0 ? <p className="text-sm text-muted">No deadlines added.</p> :
          deadlines.map((item) => <div key={item.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
            <input type="checkbox" checked={item.done} aria-label={"Complete " + item.title}
              onChange={() => update.mutate({ id: item.id, done: !item.done })} />
            <div className="min-w-0 flex-1">
              <p className={item.done ? "text-muted line-through" : "text-text"}>{item.title}</p>
              <p className="text-xs text-muted">{item.course} · {item.kind} · {item.dueAt ? deadlineLabel(item.dueAt) : ""}</p>
            </div>
            <button className="text-xs text-accent" aria-label={"Edit " + item.title}
              onClick={() => beginEdit(item)}>Edit</button>
            <button className="text-xs text-muted" aria-label={"Delete " + item.title}
              onClick={() => {
                if (window.confirm("Delete this deadline?")) removeItem.mutate(item.id);
              }}>Delete</button>
          </div>)}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold text-text">Weekly timetable</h2>
        {classes.length === 0 ? <p className="text-sm text-muted">No weekly classes added.</p> :
          classes.map((item) => <div key={item.id}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-text">
            <span className="min-w-0 flex-1">{DAYS[item.weekday ?? 0]} {item.startTime}–{item.endTime}
              {" · "}{item.course} · {item.title}{item.location ? " · " + item.location : ""}</span>
            <button className="text-xs text-accent" aria-label={"Edit " + item.title}
              onClick={() => beginEdit(item)}>Edit</button>
            <button className="text-xs text-muted" aria-label={"Delete " + item.title}
              onClick={() => {
                if (window.confirm("Delete this class?")) removeItem.mutate(item.id);
              }}>Delete</button>
          </div>)}
      </section>
      <Link to="/goals" className="block text-sm text-accent">
        Set a study or yearly goal in Goals →
      </Link>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Course, CreateUniItemInput, UniItem } from "@apex/shared";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api } from "../lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-text";
const button = "rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

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
  const addItem = useMutation({
    mutationFn: (item: CreateUniItemInput) => api.post<UniItem>("/api/uni/items", item),
    onSuccess() { refresh(); setTitle(""); setDate(""); setStartTime(""); setEndTime(""); setLocation(""); setMessage(""); },
    onError(err: Error) { setMessage(err.message); },
  });
  const update = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      api.patch<UniItem>("/api/uni/items/" + id, { done }),
    onSuccess: refresh,
    onError(err: Error) { setMessage(err.message); },
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>("/api/uni/items/" + id),
    onSuccess: refresh,
    onError(err: Error) { setMessage(err.message); },
  });
  const removeCourse = useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>("/api/uni/courses/" + id),
    onSuccess() { refresh(); setCourseId(""); },
    onError(err: Error) { setMessage(err.message); },
  });

  const selected = courses.some((course) => course.id === courseId) ? courseId : courses[0]?.id ?? "";
  const today = localWeekday();
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

  function submitItem() {
    if (!selected || !title.trim()) return;
    if (kind === "class") {
      if (!startTime || !endTime || endTime <= startTime) {
        setMessage("Add a valid start and end time.");
        return;
      }
      addItem.mutate({ courseId: selected, kind, title: title.trim(),
        weekday, startTime, endTime, location: location.trim() || null });
    } else {
      if (!date || !time) { setMessage("Add a deadline and time."); return; }
      addItem.mutate({ courseId: selected, kind, title: title.trim(),
        dueAt: new Date(date + "T" + time + ":00+04:00").toISOString() });
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
              <li key={course.id} className="flex items-center justify-between gap-2 text-text">
                <span>{course.code ? course.code + " · " : ""}{course.name}</span>
                <button className="text-xs text-muted" aria-label={"Delete " + course.name}
                  onClick={() => {
                    if (window.confirm("Delete this course and all its classes and deadlines?")) removeCourse.mutate(course.id);
                  }}>Delete</button>
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
          </> : <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted">Deadline
              <input type="date" className={input} value={date}
                onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="w-28 text-xs text-muted">Time
              <input type="time" className={input} value={time}
                onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>}
          <button className={button} onClick={submitItem}
            disabled={!title.trim() || addItem.isPending}>Save</button>
        </section>
      )}

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

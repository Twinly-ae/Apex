// Apex — tasks home-screen widget for Scriptable (iOS).
// Setup lives in docs/widget/README.md. Fill in the two values below.

const API_BASE = "https://YOUR-API-HOST"; // no trailing slash
const TOKEN = "YOUR_WIDGET_TOKEN";        // must match WIDGET_TOKEN on the API
const APP_URL = "https://YOUR-APP-HOST/tasks"; // opened when you tap the widget

const BG = new Color("#0b0b13");
const CARD = new Color("#16161f");
const TEXT = new Color("#f4f4f8");
const MUTED = new Color("#8b8b9e");
const ACCENT = new Color("#7c5cff");
const BAD = new Color("#ff5c7a");

async function fetchTasks() {
  const req = new Request(`${API_BASE}/api/widget/tasks`);
  req.headers = { "x-widget-token": TOKEN };
  req.timeoutInterval = 15;
  return req.loadJSON();
}

/** Priority dot + urgency colour for one row. */
function rowColor(task) {
  if (task.dueLabel === "overdue") return BAD;
  if (task.dueLabel === "today") return ACCENT;
  return MUTED;
}

function addHeader(widget, data) {
  const row = widget.addStack();
  row.centerAlignContent();

  const title = row.addText("Apex");
  title.font = Font.semiboldSystemFont(13);
  title.textColor = ACCENT;

  row.addSpacer();

  const c = data.counts;
  const summary = row.addText(
    c.overdue > 0 ? `${c.overdue} overdue` : `${c.open} open`,
  );
  summary.font = Font.mediumSystemFont(11);
  summary.textColor = c.overdue > 0 ? BAD : MUTED;
}

function addTaskRow(widget, task) {
  const row = widget.addStack();
  row.centerAlignContent();
  row.spacing = 6;

  const dot = row.addText("●");
  dot.font = Font.systemFont(8);
  dot.textColor = rowColor(task);

  const name = row.addText(task.title);
  name.font = Font.systemFont(12);
  name.textColor = TEXT;
  name.lineLimit = 1;

  row.addSpacer();

  if (task.dueLabel) {
    const due = row.addText(
      task.dueLabel === "today" || task.dueLabel === "overdue"
        ? task.dueLabel
        : task.dueLabel.slice(5), // MM-DD
    );
    due.font = Font.mediumSystemFont(10);
    due.textColor = rowColor(task);
  } else if (task.estMinutes) {
    const est = row.addText(`${task.estMinutes}m`);
    est.font = Font.systemFont(10);
    est.textColor = MUTED;
  }
}

function buildWidget(data, family) {
  const widget = new ListWidget();
  widget.backgroundColor = BG;
  widget.setPadding(14, 14, 14, 14);
  widget.url = APP_URL;

  addHeader(widget, data);
  widget.addSpacer(8);

  const limit = family === "small" ? 3 : family === "large" ? 8 : 4;
  const tasks = data.tasks.slice(0, limit);

  if (tasks.length === 0) {
    const done = widget.addText("All clear ✓");
    done.font = Font.semiboldSystemFont(14);
    done.textColor = TEXT;
    widget.addSpacer();
    return widget;
  }

  tasks.forEach((task, i) => {
    if (i > 0) widget.addSpacer(6);
    addTaskRow(widget, task);
  });

  widget.addSpacer();
  const foot = widget.addText(
    `${data.counts.doneToday} done today · ${data.counts.dueToday} due`,
  );
  foot.font = Font.systemFont(9);
  foot.textColor = MUTED;
  return widget;
}

function errorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = BG;
  widget.setPadding(14, 14, 14, 14);
  const t = widget.addText("Apex");
  t.font = Font.semiboldSystemFont(13);
  t.textColor = ACCENT;
  widget.addSpacer(6);
  const m = widget.addText(message);
  m.font = Font.systemFont(11);
  m.textColor = MUTED;
  m.lineLimit = 4;
  return widget;
}

let widget;
try {
  const data = await fetchTasks();
  widget = buildWidget(data, config.widgetFamily ?? "medium");
} catch (err) {
  widget = errorWidget(`Couldn't load tasks.\n${String(err).slice(0, 90)}`);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();

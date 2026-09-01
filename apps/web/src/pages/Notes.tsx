import {
  FolderPlus,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Note, NoteFolder } from "@apex/shared";
import { PageHeader } from "../components/ui/PageHeader";
import { Sheet, inputClass, primaryButtonClass, selectClass } from "../components/ui/Sheet";
import {
  useAddNote,
  useAddNoteFolder,
  useDeleteNote,
  useDeleteNoteFolder,
  useNotes,
  useUpdateNote,
  useUpdateNoteFolder,
} from "../lib/queries";

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Draft being edited in the note sheet; id null = a new note. */
interface NoteDraft {
  id: string | null;
  title: string;
  content: string;
  folderId: string | null;
  pinned: boolean;
}

function NoteEditor({
  draft,
  folders,
  onClose,
}: {
  draft: NoteDraft;
  folders: NoteFolder[];
  onClose: () => void;
}) {
  const addNote = useAddNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [title, setTitle] = useState(draft.title);
  const [content, setContent] = useState(draft.content);
  const [folderId, setFolderId] = useState(draft.folderId);
  const [pinned, setPinned] = useState(draft.pinned);
  const busy = addNote.isPending || updateNote.isPending || deleteNote.isPending;

  async function save() {
    const t = title.trim();
    if (!t || busy) return;
    const input = { title: t, content, folderId, pinned };
    if (draft.id) await updateNote.mutateAsync({ id: draft.id, input });
    else await addNote.mutateAsync(input);
    onClose();
  }

  async function remove() {
    if (!draft.id || busy) return;
    await deleteNote.mutateAsync(draft.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={draft.id ? "Edit note" : "New note"}>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Title"
          autoFocus={!draft.id}
          className={`${inputClass} font-display text-lg font-bold`}
        />
        <div className="flex items-center gap-2">
          <select
            value={folderId ?? ""}
            onChange={(e) => setFolderId(e.target.value || null)}
            className={`${selectClass} flex-1`}
          >
            <option value="">No section</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji ? `${f.emoji} ` : ""}
                {f.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setPinned((p) => !p)}
            aria-label={pinned ? "Unpin" : "Pin"}
            className={`pressable grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${
              pinned
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-line bg-surface-2 text-muted"
            }`}
          >
            <Pin className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          maxLength={50_000}
          placeholder="Write anything…"
          className={`${inputClass} min-h-[38vh] resize-none text-[15px] leading-relaxed`}
        />
        <button onClick={save} disabled={!title.trim() || busy} className={primaryButtonClass}>
          {busy ? "Saving…" : "Save note"}
        </button>
        {draft.id && (
          <button
            onClick={remove}
            disabled={busy}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-bad disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            Delete note
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Create or rename/delete a section. folder null = creating a new one. */
function FolderEditor({
  folder,
  onClose,
  onDeleted,
}: {
  folder: NoteFolder | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const addFolder = useAddNoteFolder();
  const updateFolder = useUpdateNoteFolder();
  const deleteFolder = useDeleteNoteFolder();
  const [name, setName] = useState(folder?.name ?? "");
  const [emoji, setEmoji] = useState(folder?.emoji ?? "");
  const busy = addFolder.isPending || updateFolder.isPending || deleteFolder.isPending;

  async function save() {
    const n = name.trim();
    if (!n || busy) return;
    const input = { name: n, emoji: emoji.trim() || null };
    if (folder) await updateFolder.mutateAsync({ id: folder.id, input });
    else await addFolder.mutateAsync(input);
    onClose();
  }

  async function remove() {
    if (!folder || busy) return;
    await deleteFolder.mutateAsync(folder.id);
    onDeleted();
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={folder ? "Edit section" : "New section"}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            placeholder="🙂"
            aria-label="Section emoji"
            className={`${inputClass} w-16 shrink-0 text-center`}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Section name (e.g. Twinly, Gym)"
            autoFocus={!folder}
            className={`${inputClass} flex-1`}
          />
        </div>
        <button onClick={save} disabled={!name.trim() || busy} className={primaryButtonClass}>
          {busy ? "Saving…" : folder ? "Save section" : "Add section"}
        </button>
        {folder && (
          <>
            <button
              onClick={remove}
              disabled={busy}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-bad disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              Delete section
            </button>
            <p className="text-center text-xs text-muted">
              Its notes are kept — they just lose the section.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

function NoteCard({ note, folder, onOpen }: { note: Note; folder?: NoteFolder; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="pressable flex flex-col rounded-2xl border border-line bg-surface p-3.5 text-left"
    >
      <div className="flex items-start justify-between gap-1.5">
        <h3 className="break-words text-sm font-semibold leading-snug text-text">
          {note.title}
        </h3>
        {note.pinned && (
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.2} />
        )}
      </div>
      {note.content && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted line-clamp-6">
          {note.content}
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5 pt-0.5">
        {folder && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {folder.emoji ? `${folder.emoji} ` : ""}
            {folder.name}
          </span>
        )}
        <span className="text-[10px] text-muted">{when(note.updatedAt)}</span>
      </div>
    </button>
  );
}

export function Notes() {
  const { data } = useNotes();
  const folders = useMemo(() => data?.folders ?? [], [data]);
  const notes = useMemo(() => data?.notes ?? [], [data]);
  const folderById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders],
  );

  const [filter, setFilter] = useState<string>("all"); // "all" | folderId
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [folderSheet, setFolderSheet] = useState<
    { folder: NoteFolder | null } | null
  >(null);

  const activeFolder = filter === "all" ? null : folderById.get(filter) ?? null;
  const q = query.trim().toLowerCase();
  const visible = notes.filter((n) => {
    if (filter !== "all" && n.folderId !== filter) return false;
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  });
  const pinned = visible.filter((n) => n.pinned);
  const rest = visible.filter((n) => !n.pinned);

  const countFor = (id: string) => notes.filter((n) => n.folderId === id).length;

  function openNew() {
    setDraft({
      id: null,
      title: "",
      content: "",
      folderId: filter === "all" ? null : filter,
      pinned: false,
    });
  }

  function openNote(n: Note) {
    setDraft({
      id: n.id,
      title: n.title,
      content: n.content,
      folderId: n.folderId,
      pinned: n.pinned,
    });
  }

  const grid = (items: Note[]) => (
    <div className="grid grid-cols-2 items-start gap-2.5">
      {items.map((n) => (
        <NoteCard
          key={n.id}
          note={n}
          folder={n.folderId ? folderById.get(n.folderId) : undefined}
          onOpen={() => openNote(n)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notes"
        eyebrow={`${notes.length} note${notes.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={openNew}
            aria-label="New note"
            className="pressable grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-glow"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        }
      />

      {/* Search */}
      <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-muted/70 outline-none"
        />
      </div>

      {/* Section chips */}
      <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        <button
          onClick={() => setFilter("all")}
          className={`pressable shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
            filter === "all"
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-line bg-surface text-muted"
          }`}
        >
          All
        </button>
        {folders.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() =>
                active ? setFolderSheet({ folder: f }) : setFilter(f.id)
              }
              className={`pressable flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-line bg-surface text-muted"
              }`}
            >
              {f.emoji && <span>{f.emoji}</span>}
              {f.name}
              <span className={active ? "text-accent/70" : "text-muted/60"}>
                {countFor(f.id)}
              </span>
              {active && <Pencil className="h-3 w-3" strokeWidth={2.2} />}
            </button>
          );
        })}
        <button
          onClick={() => setFolderSheet({ folder: null })}
          aria-label="New section"
          className="pressable flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line bg-transparent px-3.5 py-1.5 text-sm font-medium text-muted"
        >
          <FolderPlus className="h-4 w-4" strokeWidth={2} />
          Section
        </button>
      </div>

      {/* Notes */}
      {visible.length === 0 ? (
        <div className="pt-14 text-center">
          <StickyNote className="mx-auto h-10 w-10 text-muted/50" strokeWidth={1.6} />
          <p className="mt-3 text-sm font-medium text-text">
            {q
              ? "No notes match your search."
              : activeFolder
                ? `Nothing in ${activeFolder.name} yet.`
                : "No notes yet."}
          </p>
          {!q && (
            <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-muted">
              Tap + to write one, or ask Apex to save something here for you.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Pinned
              </h2>
              {grid(pinned)}
            </section>
          )}
          {rest.length > 0 && (
            <section className="space-y-2">
              {pinned.length > 0 && (
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Others
                </h2>
              )}
              {grid(rest)}
            </section>
          )}
        </div>
      )}

      {draft && (
        <NoteEditor
          draft={draft}
          folders={folders}
          onClose={() => setDraft(null)}
        />
      )}
      {folderSheet && (
        <FolderEditor
          folder={folderSheet.folder}
          onClose={() => setFolderSheet(null)}
          onDeleted={() => setFilter("all")}
        />
      )}
    </div>
  );
}

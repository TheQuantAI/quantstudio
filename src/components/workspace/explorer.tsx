// Copyright 2026 TheQuantAI
// API-017: workspace explorer — folder/file tree with create, rename, delete,
// download, drag-to-move, and search. Authenticated-only (rendered by the page).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  File as FileIcon,
  FileCode2,
  FilePlus,
  Folder,
  FolderPlus,
  Loader2,
  PanelLeftClose,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useCircuitStore } from "@/store";
import {
  createFile,
  createFolder,
  deleteFile,
  deleteFolder,
  downloadFile,
  downloadFolder,
  moveFile,
  moveFolder,
  openFile,
  renameFile,
  renameFolder,
  type CloudFile,
  type CloudFolder,
  type FileType,
} from "@/lib/api";
import { NewFileDialog } from "./new-file-dialog";

const DRAG_MIME = "application/x-tqc-node";

export function WorkspaceExplorer({
  selectedFolderId,
  onSelectFolder,
  onCollapse,
}: {
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  /** Optional: renders a collapse button in the header when provided. */
  onCollapse?: () => void;
}) {
  const tree = useCircuitStore((s) => s.tree);
  const treeLoading = useCircuitStore((s) => s.treeLoading);
  const loadTree = useCircuitStore((s) => s.loadTree);
  const openFileTab = useCircuitStore((s) => s.openFileTab);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | "root" | null>(null);
  const [newFileParent, setNewFileParent] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const foldersByParent = useMemo(() => {
    const m = new Map<string | null, CloudFolder[]>();
    for (const f of tree.folders) {
      const arr = m.get(f.parent_id) ?? [];
      arr.push(f);
      m.set(f.parent_id, arr);
    }
    return m;
  }, [tree.folders]);

  const filesByFolder = useMemo(() => {
    const m = new Map<string | null, CloudFile[]>();
    for (const f of tree.files) {
      const arr = m.get(f.folder_id) ?? [];
      arr.push(f);
      m.set(f.folder_id, arr);
    }
    return m;
  }, [tree.files]);

  const refresh = useCallback(async () => {
    await loadTree();
  }, [loadTree]);

  const withBusy = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ─── Actions ───

  const handleNewFolder = (parentId: string | null) =>
    withBusy(async () => {
      const name = window.prompt("New folder name")?.trim();
      if (!name) return;
      await createFolder(name, parentId);
      await refresh();
    });

  const handleCreateFile = (parentId: string | null | undefined) =>
    (name: string, fileType: FileType) =>
      void withBusy(async () => {
        const created = await createFile({ name, fileType, folderId: parentId ?? null });
        await refresh();
        await openFileTab(created.id); // open the new file in a tab
      });

  const handleRenameFolder = (f: CloudFolder) =>
    withBusy(async () => {
      const name = window.prompt("Rename folder", f.name)?.trim();
      if (!name || name === f.name) return;
      await renameFolder(f.id, name);
      await refresh();
    });

  const handleRenameFile = (f: CloudFile) =>
    withBusy(async () => {
      const name = window.prompt("Rename file", f.name)?.trim();
      if (!name || name === f.name) return;
      await renameFile(f.id, name);
      await refresh();
    });

  const handleDeleteFolder = (f: CloudFolder) =>
    withBusy(async () => {
      if (!window.confirm(`Delete folder "${f.name}" and everything inside it?`)) return;
      await deleteFolder(f.id);
      if (selectedFolderId === f.id) onSelectFolder(null);
      await refresh();
    });

  const handleDeleteFile = (f: CloudFile) =>
    withBusy(async () => {
      if (!window.confirm(`Delete "${f.name}"?`)) return;
      await deleteFile(f.id);
      await refresh();
    });

  const handleDownloadFile = (f: CloudFile) =>
    withBusy(async () => {
      const full = await openFile(f.id); // tree omits content
      downloadFile(f.name, full.content ?? "");
    });

  const handleDownloadFolder = (f: CloudFolder) =>
    withBusy(async () => {
      await downloadFolder(f.id, f.name);
    });

  // ─── Drag & drop (move) ───

  const onDropInto = (targetFolderId: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const payload = e.dataTransfer.getData(DRAG_MIME);
    if (!payload) return;
    const [kind, id] = payload.split(":");
    void withBusy(async () => {
      if (kind === "file") await moveFile(id, targetFolderId);
      else if (kind === "folder") {
        if (id === targetFolderId) return; // no-op; server also rejects cycles
        await moveFolder(id, targetFolderId);
      }
      await refresh();
    });
  };

  const dragProps = (kind: "file" | "folder", id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_MIME, `${kind}:${id}`);
      e.dataTransfer.effectAllowed = "move";
    },
  });

  // ─── Rendering ───

  const renderFolder = (folder: CloudFolder, depth: number) => {
    const isCollapsed = collapsed.has(folder.id);
    const childFolders = foldersByParent.get(folder.id) ?? [];
    const childFiles = filesByFolder.get(folder.id) ?? [];
    const selected = selectedFolderId === folder.id;
    return (
      <div key={folder.id}>
        <div
          {...dragProps("folder", folder.id)}
          onClick={() => onSelectFolder(folder.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(folder.id);
          }}
          onDragLeave={() => setDragOver((d) => (d === folder.id ? null : d))}
          onDrop={onDropInto(folder.id)}
          className={`group flex items-center gap-1 rounded px-1 py-1 text-sm cursor-pointer ${
            selected ? "bg-accent" : "hover:bg-accent/50"
          } ${dragOver === folder.id ? "ring-1 ring-quantum" : ""}`}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
            className="shrink-0 text-muted-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <Folder className="h-3.5 w-3.5 shrink-0 text-quantum" />
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <IconBtn title="New file here" onClick={() => setNewFileParent(folder.id)}>
              <FilePlus className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="New subfolder" onClick={() => void handleNewFolder(folder.id)}>
              <FolderPlus className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Download folder (zip)" onClick={() => void handleDownloadFolder(folder)}>
              <Download className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Rename" onClick={() => void handleRenameFolder(folder)}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Delete" danger onClick={() => void handleDeleteFolder(folder)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </span>
        </div>
        {!isCollapsed && (
          <div>
            {childFolders.map((cf) => renderFolder(cf, depth + 1))}
            {childFiles.map((cf) => renderFile(cf, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFile = (file: CloudFile, depth: number) => {
    const Icon = file.file_type === "py" ? FileCode2 : FileIcon;
    return (
      <div
        key={file.id}
        {...dragProps("file", file.id)}
        onClick={() => void openFileTab(file.id)}
        className="group flex items-center gap-1 rounded px-1 py-1 text-sm cursor-pointer hover:bg-accent/50"
        style={{ paddingLeft: depth * 12 + 20 }}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{file.name}</span>
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <IconBtn title="Download" onClick={() => void handleDownloadFile(file)}>
            <Download className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Rename" onClick={() => void handleRenameFile(file)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn title="Delete" danger onClick={() => void handleDeleteFile(file)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </span>
      </div>
    );
  };

  const rootFolders = foldersByParent.get(null) ?? [];
  const rootFiles = filesByFolder.get(null) ?? [];

  const searchLower = search.trim().toLowerCase();
  const searchHits = searchLower
    ? tree.files.filter((f) => f.name.toLowerCase().includes(searchLower))
    : [];

  return (
    <div className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </span>
        <span className="flex items-center gap-0.5">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <IconBtn title="New file" onClick={() => setNewFileParent(selectedFolderId ?? null)}>
            <FilePlus className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="New folder" onClick={() => void handleNewFolder(selectedFolderId)}>
            <FolderPlus className="h-4 w-4" />
          </IconBtn>
          {onCollapse && (
            <IconBtn title="Hide workspace" onClick={onCollapse}>
              <PanelLeftClose className="h-4 w-4" />
            </IconBtn>
          )}
        </span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files"
          className="w-full bg-transparent text-xs focus:outline-none"
        />
      </div>

      {/* Tree / results. min-h-0 is required here: without it, a flex child
          defaults to min-height:auto and grows to fit all files instead of
          scrolling once the list is taller than the sidebar. */}
      <div
        className={`min-h-0 flex-1 overflow-y-auto p-1 ${dragOver === "root" ? "ring-1 ring-inset ring-quantum" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver("root");
        }}
        onDragLeave={() => setDragOver((d) => (d === "root" ? null : d))}
        onDrop={onDropInto(null)}
      >
        {treeLoading && tree.folders.length === 0 && tree.files.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : searchLower ? (
          searchHits.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">No files match.</p>
          ) : (
            searchHits.map((f) => renderFile(f, 0))
          )
        ) : rootFolders.length === 0 && rootFiles.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No files yet. Use the <FilePlus className="inline h-3 w-3" /> button or Save your circuit.
          </p>
        ) : (
          <>
            {rootFolders.map((f) => renderFolder(f, 0))}
            {rootFiles.map((f) => renderFile(f, 0))}
          </>
        )}
      </div>

      <NewFileDialog
        open={newFileParent !== undefined}
        onClose={() => setNewFileParent(undefined)}
        onCreate={handleCreateFile(newFileParent)}
      />
    </div>
  );
}

function IconBtn({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

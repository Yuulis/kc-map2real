"use client";

import React, { useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { MapsData, MapGroup } from "@/app/types/maps";

interface SeaManagerDialogProps {
  open: boolean;
  onClose: () => void;
  mapsData: MapsData | null;
  onDataChanged: () => void;
}

// Inline rename state for groups and seas
type RenameTarget =
  | { kind: "group"; groupId: string }
  | { kind: "sea"; seaCode: string };

// Inline add-sea form state
type AddSeaTarget = { groupId: string };

export default function SeaManagerDialog({
  open,
  onClose,
  mapsData,
  onDataChanged,
}: SeaManagerDialogProps) {
  // Rename state
  const [renaming, setRenaming] = useState<RenameTarget | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Add sea inline form
  const [addingSea, setAddingSea] = useState<AddSeaTarget | null>(null);
  const [newSeaCode, setNewSeaCode] = useState("");
  const [newSeaName, setNewSeaName] = useState("");

  // Add group form
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  const resetAllForms = useCallback(() => {
    setRenaming(null);
    setRenameValue("");
    setAddingSea(null);
    setNewSeaCode("");
    setNewSeaName("");
    setAddingGroup(false);
    setNewGroupId("");
    setNewGroupName("");
  }, []);

  // --- Rename group ---
  const startRenameGroup = useCallback((group: MapGroup) => {
    setRenaming({ kind: "group", groupId: group.id });
    setRenameValue(group.name);
    setAddingSea(null);
    setAddingGroup(false);
  }, []);

  const confirmRenameGroup = useCallback(async () => {
    if (!renaming || renaming.kind !== "group" || !renameValue.trim()) return;
    try {
      const res = await fetch("/api/maps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "groups",
          groupId: renaming.groupId,
          updates: { name: renameValue.trim() },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to rename group");
        return;
      }
      toast.success("Group renamed");
      setRenaming(null);
      setRenameValue("");
      onDataChanged();
    } catch {
      toast.error("Network error");
    }
  }, [renaming, renameValue, onDataChanged]);

  // --- Rename sea ---
  const startRenameSea = useCallback(
    (seaCode: string, currentName: string) => {
      setRenaming({ kind: "sea", seaCode });
      setRenameValue(currentName);
      setAddingSea(null);
      setAddingGroup(false);
    },
    [],
  );

  const confirmRenameSea = useCallback(async () => {
    if (!renaming || renaming.kind !== "sea" || !renameValue.trim()) return;
    try {
      const res = await fetch("/api/maps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "seas",
          seaCode: renaming.seaCode,
          updates: { name: renameValue.trim() },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to rename sea");
        return;
      }
      toast.success("Sea renamed");
      setRenaming(null);
      setRenameValue("");
      onDataChanged();
    } catch {
      toast.error("Network error");
    }
  }, [renaming, renameValue, onDataChanged]);

  // --- Delete sea ---
  const handleDeleteSea = useCallback(
    async (seaCode: string, seaName: string) => {
      if (!window.confirm(`Delete sea "${seaCode} ${seaName}"? All nodes and edges will be removed.`)) {
        return;
      }
      try {
        const res = await fetch("/api/maps", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "seas", seaCode }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Failed to delete sea");
          return;
        }
        toast.success(`Sea "${seaCode}" deleted`);
        onDataChanged();
      } catch {
        toast.error("Network error");
      }
    },
    [onDataChanged],
  );

  // --- Delete group ---
  const handleDeleteGroup = useCallback(
    async (groupId: string, groupName: string, seaCount: number) => {
      const msg =
        seaCount > 0
          ? `Delete group "${groupName}" and all its ${seaCount} sea(s)? This cannot be undone.`
          : `Delete empty group "${groupName}"?`;
      if (!window.confirm(msg)) return;
      try {
        const res = await fetch("/api/maps", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: "groups",
            groupId,
            force: seaCount > 0,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Failed to delete group");
          return;
        }
        toast.success(`Group "${groupName}" deleted`);
        onDataChanged();
      } catch {
        toast.error("Network error");
      }
    },
    [onDataChanged],
  );

  // --- Add sea ---
  const startAddSea = useCallback((groupId: string) => {
    setAddingSea({ groupId });
    setNewSeaCode("");
    setNewSeaName("");
    setRenaming(null);
    setAddingGroup(false);
  }, []);

  const confirmAddSea = useCallback(async () => {
    if (!addingSea || !newSeaCode.trim() || !newSeaName.trim()) return;
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "seas",
          groupId: addingSea.groupId,
          sea: { code: newSeaCode.trim(), name: newSeaName.trim() },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to add sea");
        return;
      }
      toast.success(`Sea "${newSeaCode.trim()}" added`);
      setAddingSea(null);
      setNewSeaCode("");
      setNewSeaName("");
      onDataChanged();
    } catch {
      toast.error("Network error");
    }
  }, [addingSea, newSeaCode, newSeaName, onDataChanged]);

  // --- Add group ---
  const startAddGroup = useCallback(() => {
    setAddingGroup(true);
    setNewGroupId("");
    setNewGroupName("");
    setRenaming(null);
    setAddingSea(null);
  }, []);

  const confirmAddGroup = useCallback(async () => {
    if (!newGroupId.trim() || !newGroupName.trim()) return;
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "groups",
          group: { id: newGroupId.trim(), name: newGroupName.trim() },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to add group");
        return;
      }
      toast.success(`Group "${newGroupName.trim()}" added`);
      setAddingGroup(false);
      setNewGroupId("");
      setNewGroupName("");
      onDataChanged();
    } catch {
      toast.error("Network error");
    }
  }, [newGroupId, newGroupName, onDataChanged]);

  const btnBase =
    "inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium transition-colors focus:outline-none";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetAllForms();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[80]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[90vw] max-w-lg max-h-[80vh] bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 flex flex-col focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
            <Dialog.Title className="text-base font-semibold">
              海域管理
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="p-1 rounded hover:bg-gray-700 transition-colors"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!mapsData || mapsData.groups.length === 0 ? (
              <p className="text-sm text-gray-400">No groups found.</p>
            ) : (
              mapsData.groups.map((group) => (
                <div
                  key={group.id}
                  className="border border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800">
                    {renaming?.kind === "group" &&
                    renaming.groupId === group.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRenameGroup();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          autoFocus
                          className="flex-1 min-w-0 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={confirmRenameGroup}
                          className={`${btnBase} bg-green-700 hover:bg-green-600 text-white`}
                          title="Confirm"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          onClick={() => setRenaming(null)}
                          className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white`}
                          title="Cancel"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-semibold truncate flex-1 min-w-0">
                          Group: {group.name}{" "}
                          <span className="text-gray-400 font-normal">
                            ({group.id})
                          </span>
                        </span>
                        <button
                          onClick={() => startRenameGroup(group)}
                          className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white`}
                          title="Rename group"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => startAddSea(group.id)}
                          className={`${btnBase} bg-blue-700 hover:bg-blue-600 text-white`}
                          title="Add sea"
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteGroup(
                              group.id,
                              group.name,
                              group.seas.length,
                            )
                          }
                          className={`${btnBase} bg-red-800 hover:bg-red-700 text-white`}
                          title="Delete group"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Sea list */}
                  <div className="divide-y divide-gray-700/50">
                    {group.seas.map((sea) => (
                      <div
                        key={sea.code}
                        className="flex items-center gap-2 px-3 py-1.5 pl-6 bg-gray-900 hover:bg-gray-800/60"
                      >
                        {renaming?.kind === "sea" &&
                        renaming.seaCode === sea.code ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className="text-xs text-gray-400 shrink-0">
                              {sea.code}
                            </span>
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmRenameSea();
                                if (e.key === "Escape") setRenaming(null);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 bg-gray-700 border border-gray-500 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={confirmRenameSea}
                              className={`${btnBase} bg-green-700 hover:bg-green-600 text-white`}
                              title="Confirm"
                            >
                              <Check className="size-3" />
                            </button>
                            <button
                              onClick={() => setRenaming(null)}
                              className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white`}
                              title="Cancel"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs truncate flex-1 min-w-0">
                              <span className="text-gray-400">
                                {sea.code}
                              </span>{" "}
                              {sea.name}
                              <span className="text-gray-500 ml-1">
                                ({sea.nodes.length}N, {sea.edges.length}E)
                              </span>
                            </span>
                            <button
                              onClick={() =>
                                startRenameSea(sea.code, sea.name)
                              }
                              className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white`}
                              title="Rename sea"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSea(sea.code, sea.name)
                              }
                              className={`${btnBase} bg-red-800 hover:bg-red-700 text-white`}
                              title="Delete sea"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}

                    {group.seas.length === 0 && (
                      <div className="px-3 py-1.5 pl-6 text-xs text-gray-500">
                        No seas
                      </div>
                    )}

                    {/* Inline add sea form */}
                    {addingSea?.groupId === group.id && (
                      <div className="flex items-center gap-1 px-3 py-1.5 pl-6 bg-gray-800/40">
                        <input
                          type="text"
                          value={newSeaCode}
                          onChange={(e) => setNewSeaCode(e.target.value)}
                          placeholder="Code (e.g. 1-5)"
                          autoFocus
                          className="w-20 bg-gray-700 border border-gray-500 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={newSeaName}
                          onChange={(e) => setNewSeaName(e.target.value)}
                          placeholder="Name"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmAddSea();
                            if (e.key === "Escape") setAddingSea(null);
                          }}
                          className="flex-1 min-w-0 bg-gray-700 border border-gray-500 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={confirmAddSea}
                          disabled={!newSeaCode.trim() || !newSeaName.trim()}
                          className={`${btnBase} bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white`}
                          title="Add"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          onClick={() => setAddingSea(null)}
                          className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white`}
                          title="Cancel"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Add group form */}
            {addingGroup ? (
              <div className="flex items-center gap-1 border border-gray-700 rounded-lg p-3 bg-gray-800/40">
                <input
                  type="text"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  placeholder="ID (e.g. 8)"
                  autoFocus
                  className="w-20 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAddGroup();
                    if (e.key === "Escape") setAddingGroup(false);
                  }}
                  className="flex-1 min-w-0 bg-gray-700 border border-gray-500 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={confirmAddGroup}
                  disabled={!newGroupId.trim() || !newGroupName.trim()}
                  className={`${btnBase} bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5`}
                  title="Add group"
                >
                  <Check className="size-3 mr-1" />
                  Add
                </button>
                <button
                  onClick={() => setAddingGroup(false)}
                  className={`${btnBase} bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5`}
                  title="Cancel"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={startAddGroup}
                className="w-full flex items-center justify-center gap-1 border border-dashed border-gray-600 rounded-lg py-2 text-sm text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
              >
                <Plus className="size-4" />
                Add Group
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

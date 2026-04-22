"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { MapNode, NodeType } from "@/app/types/maps";

const NODE_TYPES: readonly NodeType[] = [
  "start",
  "normal",
  "boss",
  "supply",
  "relay",
  "whirlpool",
  "port",
  "aerial",
  "air-rade",
  "night-battle",
] as const;

interface SubMapOption {
  id: string;
  name: string;
}

interface NodeEditDialogProps {
  open: boolean;
  mode: "add" | "edit";
  lat?: number;
  lng?: number;
  node?: MapNode;
  seaCode?: string;
  submapIds?: string[];
  availableSeas: ReadonlyArray<{ code: string; name: string }>;
  availableSubmaps?: ReadonlyArray<SubMapOption>;
  onConfirm: (seaCode: string, node: MapNode, submapIds: string[]) => void;
  onDelete?: (seaCode: string, nodeId: string, submapIds: string[]) => void;
  onClose: () => void;
}

export default function NodeEditDialog({
  open,
  mode,
  lat,
  lng,
  node,
  seaCode,
  submapIds,
  availableSeas,
  availableSubmaps,
  onConfirm,
  onDelete,
  onClose,
}: NodeEditDialogProps) {
  const [selectedSea, setSelectedSea] = useState(seaCode ?? "");
  const [selectedSubmaps, setSelectedSubmaps] = useState<Set<string>>(new Set());
  const [nodeId, setNodeId] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [nodeType, setNodeType] = useState<NodeType>("normal");
  const [nodeLat, setNodeLat] = useState(0);
  const [nodeLng, setNodeLng] = useState(0);

  // Reset form when dialog opens or props change
  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && node) {
      setNodeId(node.id);
      setNodeName(node.name);
      setNodeType(node.type);
      setNodeLat(node.lat);
      setNodeLng(node.lng);
      setSelectedSea(seaCode ?? "");
      setSelectedSubmaps(new Set(submapIds ?? []));
    } else {
      // Add mode
      setNodeId("");
      setNodeName("");
      setNodeType("normal");
      setNodeLat(lat ?? 0);
      setNodeLng(lng ?? 0);
      setSelectedSea(seaCode ?? availableSeas[0]?.code ?? "");
      setSelectedSubmaps(new Set(submapIds ?? []));
    }
  }, [open, mode, node, lat, lng, seaCode, submapIds, availableSeas]);

  const handleSubmapToggle = useCallback((smId: string) => {
    setSelectedSubmaps((prev) => {
      const next = new Set(prev);
      if (next.has(smId)) {
        next.delete(smId);
      } else {
        next.add(smId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedSea || !nodeId.trim()) return;

      const result: MapNode = {
        id: nodeId.trim(),
        type: nodeType,
        lat: nodeLat,
        lng: nodeLng,
        name: nodeName.trim() || nodeId.trim(),
        meta: node?.meta ?? {},
      };

      onConfirm(selectedSea, result, [...selectedSubmaps]);
    },
    [selectedSea, selectedSubmaps, nodeId, nodeType, nodeLat, nodeLng, nodeName, node, onConfirm],
  );

  const handleDelete = useCallback(() => {
    if (!onDelete || !selectedSea || !nodeId.trim()) return;
    if (!window.confirm(`Delete node "${nodeId}"? This will also remove all connected edges.`)) {
      return;
    }
    onDelete(selectedSea, nodeId.trim(), [...selectedSubmaps]);
  }, [onDelete, selectedSea, selectedSubmaps, nodeId]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[80]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[90vw] max-w-md bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 p-0 focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <Dialog.Title className="text-base font-semibold">
              {mode === "add" ? "Add Node" : "Edit Node"}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Sea selector */}
            <div className="space-y-1">
              <label
                htmlFor="node-sea"
                className="block text-xs font-medium text-gray-400"
              >
                Sea Area
              </label>
              <select
                id="node-sea"
                value={selectedSea}
                onChange={(e) => setSelectedSea(e.target.value)}
                disabled={mode === "edit"}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">-- Select --</option>
                {availableSeas.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Submap membership checkboxes (only shown when submaps are available) */}
            {availableSubmaps && availableSubmaps.length > 0 && (
              <div className="space-y-1">
                <span className="block text-xs font-medium text-gray-400">
                  Sub-map membership (optional)
                </span>
                <div className="space-y-1 max-h-32 overflow-y-auto bg-gray-800 border border-gray-600 rounded px-3 py-2">
                  {availableSubmaps.map((sm) => (
                    <label
                      key={sm.id}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSubmaps.has(sm.id)}
                        onChange={() => handleSubmapToggle(sm.id)}
                        className="w-3.5 h-3.5 rounded border-gray-500"
                      />
                      {sm.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Unchecked = base only
                </p>
              </div>
            )}

            {/* Node ID */}
            <div className="space-y-1">
              <label
                htmlFor="node-id"
                className="block text-xs font-medium text-gray-400"
              >
                Node ID
              </label>
              <input
                id="node-id"
                type="text"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                placeholder='e.g. "A", "Start", "Boss"'
                disabled={mode === "edit"}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Node name */}
            <div className="space-y-1">
              <label
                htmlFor="node-name"
                className="block text-xs font-medium text-gray-400"
              >
                Display Name
              </label>
              <input
                id="node-name"
                type="text"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                placeholder="Display name (optional)"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Node type */}
            <div className="space-y-1">
              <label
                htmlFor="node-type"
                className="block text-xs font-medium text-gray-400"
              >
                Node Type
              </label>
              <select
                id="node-type"
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value as NodeType)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Coordinates (read-only in add mode, editable in edit mode) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="node-lat"
                  className="block text-xs font-medium text-gray-400"
                >
                  Latitude
                </label>
                <input
                  id="node-lat"
                  type="number"
                  step="any"
                  value={nodeLat}
                  onChange={(e) => setNodeLat(parseFloat(e.target.value) || 0)}
                  readOnly={mode === "add"}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 read-only:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="node-lng"
                  className="block text-xs font-medium text-gray-400"
                >
                  Longitude
                </label>
                <input
                  id="node-lng"
                  type="number"
                  step="any"
                  value={nodeLng}
                  onChange={(e) => setNodeLng(parseFloat(e.target.value) || 0)}
                  readOnly={mode === "add"}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 read-only:opacity-60"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={!selectedSea || !nodeId.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded px-4 py-2 text-sm transition-colors"
              >
                {mode === "add" ? "Add Node" : "Save Changes"}
              </button>
              {mode === "edit" && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="bg-red-700 hover:bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded px-4 py-2 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

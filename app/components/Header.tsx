"use client";

import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Menu, Settings, Check } from "lucide-react";
import { Toaster, toast } from "sonner";

type SectionKey = string;

export default function Header() {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [sectionKeys, setSectionKeys] = useState<SectionKey[]>([]);
  const [selected, setSelected] = useState<SectionKey[]>([]); // 選択された海域のみ表示
  const [pinMode, setPinMode] = useState(false); // ピン配置モード

  // Load section keys from merged maps.json (initially all selected)
  useEffect(() => {
    fetch("/data/maps.json")
      .then((res) => res.json())
      .then((data) => {
        const keys: string[] = [];
        if (data && Array.isArray(data.groups)) {
          for (const group of data.groups) {
            if (Array.isArray(group.seas)) {
              for (const sea of group.seas) {
                keys.push(sea.code);
              }
            }
          }
        }
        setSectionKeys(keys);
        setSelected(keys);
      })
      .catch(() => {
        setSectionKeys([]);
      });
  }, []);

  const applySelection = () => {
    const evt = new CustomEvent<SectionKey[]>("kc:set-active-sections", {
      detail: selected,
    });
    window.dispatchEvent(evt);
    setLeftOpen(false);
    toast.success("海域表示を更新しました");
  };

  const toggleOne = (key: SectionKey, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        // 追加
        if (prev.includes(key)) return prev;
        return [...prev, key];
      } else {
        // 除外
        return prev.filter((k) => k !== key);
      }
    });
  };

  const isSelected = (key: SectionKey) => selected.includes(key);

  const selectAll = () => setSelected([...sectionKeys]);
  const deselectAll = () => setSelected([]);

  const toggleGroup = (keys: string[], allChecked: boolean) => {
    if (allChecked) {
      setSelected((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setSelected((prev) => {
        const next = [...prev];
        for (const k of keys) {
          if (!next.includes(k)) next.push(k);
        }
        return next;
      });
    }
  };

  return (
    <>
      <Toaster richColors position="top-center" />

      {/* ヘッダー */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-black text-white z-50 flex items-center justify-between px-3">
        {/* 左: ハンバーガー */}
        <Dialog.Root open={leftOpen} onOpenChange={setLeftOpen}>
          <Dialog.Trigger asChild>
            <button
              aria-label="海域メニューを開く"
              className="p-2 hover:opacity-80"
            >
              <Menu className="size-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
            <Dialog.Content aria-describedby={undefined} className="fixed top-0 left-0 h-full w-72 bg-gray-950 text-white z-50 shadow-xl border-r border-gray-700">
              <Dialog.Title className="p-3 border-b border-gray-700 font-semibold text-white">
                海域選択
              </Dialog.Title>
              <div className="p-3 space-y-3 overflow-y-auto h-[calc(100%-3rem)]">
                {sectionKeys.length === 0 && (
                  <div className="text-sm text-gray-400">
                    海域データを読み込み中…
                  </div>
                )}
                {/* 全選択 / 全解除 */}
                {sectionKeys.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                      onClick={selectAll}
                    >
                      全選択
                    </button>
                    <button
                      className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                      onClick={deselectAll}
                    >
                      全解除
                    </button>
                  </div>
                )}
                {/* Group by world (prefix before "-") */}
                {Array.from(
                  sectionKeys.reduce((acc, key) => {
                    const world = key.split("-")[0];
                    if (!acc.has(world)) acc.set(world, []);
                    acc.get(world)!.push(key);
                    return acc;
                  }, new Map<string, string[]>())
                ).map(([world, keys]) => {
                  const allChecked = keys.every((k) => isSelected(k));
                  const someChecked = keys.some((k) => isSelected(k));
                  return (
                    <div key={world}>
                      <label className="flex items-center gap-2 px-2 pb-1 border-b border-gray-700 mb-1 cursor-pointer hover:bg-gray-800 rounded">
                        <Checkbox.Root
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={() => toggleGroup(keys, allChecked)}
                          className="inline-flex items-center justify-center size-4 rounded border border-gray-500 data-[state=checked]:bg-white data-[state=checked]:border-white data-[state=indeterminate]:bg-gray-500 data-[state=indeterminate]:border-gray-400"
                          aria-label={`第${world}海域を一斉選択`}
                        >
                          <Checkbox.Indicator>
                            <Check className="size-3 text-black" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                          第{world}海域
                        </span>
                      </label>
                      {keys.map((key) => {
                        const checked = isSelected(key);
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer"
                          >
                            <Checkbox.Root
                              checked={checked}
                              onCheckedChange={(v) => toggleOne(key, !!v)}
                              className="inline-flex items-center justify-center size-4 rounded border border-gray-500 data-[state=checked]:bg-white data-[state=checked]:border-white"
                              aria-label={`${key} を表示`}
                            >
                              <Checkbox.Indicator>
                                <Check className="size-3 text-black" />
                              </Checkbox.Indicator>
                            </Checkbox.Root>
                            <span className="text-sm">{key}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="pt-2">
                  <button
                    className="w-full bg-white text-black px-2 py-1 rounded hover:opacity-90 font-semibold"
                    onClick={applySelection}
                  >
                    適用
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* 中央: タイトル */}
        <div className="text-sm font-semibold select-none">KC Map2real</div>

        {/* 右: 歯車 */}
        <Dialog.Root open={rightOpen} onOpenChange={setRightOpen}>
          <Dialog.Trigger asChild>
            <button aria-label="設定を開く" className="p-2 hover:opacity-80">
              <Settings className="size-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
            <Dialog.Content aria-describedby={undefined} className="fixed top-0 right-0 h-full w-80 bg-white text-black z-50 shadow-xl border-l border-gray-200">
              <Dialog.Title className="p-3 border-b border-gray-200 font-semibold">
                設定
              </Dialog.Title>
              <div className="p-3 space-y-3 text-sm">
                <div className="text-gray-600">
                  ここに設定項目を追加できます。
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={pinMode}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setPinMode(next);
                      const evt = new CustomEvent<boolean>("kc:set-pin-mode", {
                        detail: next,
                      });
                      window.dispatchEvent(evt);
                      toast[next ? "success" : "info"](
                        next
                          ? "ピン配置モードをONにしました"
                          : "ピン配置モードをOFFにしました"
                      );
                    }}
                  />
                  ピン配置モード
                </label>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";

export default function EditorPanel({ onChange, onCopy, onMagic, tokenCount, value }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`bg-terminal-black flex flex-col h-full relative${focused ? " glow-active" : ""}`}>
      <div className="h-10 flex items-center justify-between px-4 border-b border-border-subtle bg-surface-glass/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary/80" />
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            System Instruction
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="text-on-surface-variant hover:text-primary transition-colors"
            onClick={onCopy}
            title="Copy prompt"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
          </button>
          <button
            className="text-on-surface-variant hover:text-primary transition-colors"
            onClick={onMagic}
            title="Auto-focus this prompt"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">magic_button</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 relative font-label-md text-label-md text-on-surface overflow-auto">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-surface-glass border-r border-border-subtle/50 flex flex-col items-center py-4 text-on-surface-variant/50 select-none">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          className="editor-textarea w-full h-full bg-transparent border-none text-on-surface pl-6 font-label-md text-label-md leading-relaxed focus:ring-0"
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          spellCheck={false}
          value={value}
        />
      </div>

      <div className="h-8 border-t border-border-subtle bg-surface-glass/50 flex items-center px-4 font-label-sm text-label-sm text-on-surface-variant gap-4">
        <span>Tokens: {tokenCount}</span>
        <span>Language: English</span>
      </div>
    </div>
  );
}

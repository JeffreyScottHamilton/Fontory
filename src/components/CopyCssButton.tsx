"use client";

import { useEffect, useRef, useState } from "react";

interface CopyCssButtonProps {
  text: string;
  label?: string;
}

function copyWithTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

export default function CopyCssButton({ text, label = "Copy CSS" }: CopyCssButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyWithTextarea(text);
    if (!ok) return;

    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center border border-rule px-3 py-1.5 text-sm text-ink hover:border-ink"
      >
        {label}
      </button>
      <span aria-live="polite" className="text-sm text-muted">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}

"use client";

import s from "./documents.module.css";

/** A visible label styled as a button or a link, with the file input inside it, still reachable by keyboard. */
export function FilePick({ label, primary, onFile }: { label: string; primary?: boolean; onFile: (f: File) => void }) {
  return (
    <label className={`${primary ? "btn" : "link"} ${s.pick}`}>
      {label}
      <input
        type="file"
        accept="application/pdf,image/*"
        className={s.fileInput}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

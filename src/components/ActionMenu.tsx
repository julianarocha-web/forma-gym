import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
export default function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={ref} className={`action-menu ${open ? "menu-open" : ""}`}>
      <button
        className="menu-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={22} />
      </button>
      {open && (
        <div className="menu-items" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

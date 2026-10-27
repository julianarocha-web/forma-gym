import { useState } from "react";
import { Plus } from "lucide-react";
export function Chips({ tags }: { tags: string[] }) {
  return (
    <div className="chips">
      {tags.map((tag) => (
        <span
          className={`tag-chip tone-${tag === "Musculación" ? "strength" : tag === "Aeróbico" ? "cardio" : tag === "Movilidad" ? "mobility" : "neutral"}`}
          key={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
export function TagPicker({
  label,
  options,
  value,
  onChange,
  allowCustom = true,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (tags: string[]) => void;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState("");
  const tags = [...new Set([...options, ...value])];
  return (
    <fieldset className="tag-picker">
      <legend>{label}</legend>
      <div className="chips">
        {tags.map((tag) => (
          <button
            type="button"
            key={tag}
            className={`tag-chip ${value.includes(tag) ? "chosen" : ""}`}
            aria-pressed={value.includes(tag)}
            onClick={() =>
              onChange(
                value.includes(tag)
                  ? value.filter((t) => t !== tag)
                  : [...value, tag],
              )
            }
          >
            {tag}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="custom-tag">
          <input
            aria-label={`Nueva etiqueta: ${label}`}
            placeholder="Otra etiqueta…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (custom.trim()) {
                  onChange([...new Set([...value, custom.trim()])]);
                  setCustom("");
                }
              }
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={`Agregar etiqueta: ${label}`}
            disabled={!custom.trim()}
            onClick={() => {
              onChange([...new Set([...value, custom.trim()])]);
              setCustom("");
            }}
          >
            <Plus size={17} />
          </button>
        </div>
      )}
    </fieldset>
  );
}

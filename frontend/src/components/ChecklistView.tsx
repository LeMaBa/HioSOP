import { useState } from "react";
import { ChecklistItem } from "../api/sops";
import clsx from "clsx";

interface Props {
  items: ChecklistItem[];
}

export default function ChecklistView({ items }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (items.length === 0) {
    return (
      <p className="text-gray-500 italic text-sm">
        Keine Checklisten-Einträge vorhanden.
      </p>
    );
  }

  const completed = Object.values(checked).filter(Boolean).length;
  const total = countAll(items);

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm text-gray-500 tabular-nums">
          {completed}/{total}
        </span>
      </div>

      <ol className="space-y-2">
        {sorted(items).map((item, idx) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            index={idx + 1}
            checked={checked}
            toggle={toggle}
          />
        ))}
      </ol>

      <p className="mt-4 text-xs text-gray-400">
        Checkboxen werden beim Verlassen der SOP zurückgesetzt und nicht gespeichert.
      </p>
    </div>
  );
}

function ChecklistItemRow({
  item,
  index,
  checked,
  toggle,
  depth = 0,
}: {
  item: ChecklistItem;
  index: number | string;
  checked: Record<string, boolean>;
  toggle: (id: string) => void;
  depth?: number;
}) {
  const isChecked = checked[item.id] ?? false;

  return (
    <li style={{ marginLeft: depth * 20 }}>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggle(item.id)}
          className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
        />
        <span
          className={clsx(
            "text-sm leading-relaxed",
            isChecked ? "line-through text-gray-400" : "text-gray-800"
          )}
        >
          <span className="font-mono text-gray-400 mr-1 text-xs">{index}.</span>
          {item.text}
        </span>
      </label>

      {item.sub_items && item.sub_items.length > 0 && (
        <ol className="mt-1 space-y-1">
          {sorted(item.sub_items).map((sub, si) => (
            <ChecklistItemRow
              key={sub.id}
              item={sub}
              index={`${index}.${si + 1}`}
              checked={checked}
              toggle={toggle}
              depth={depth + 1}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function sorted(items: ChecklistItem[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function countAll(items: ChecklistItem[]): number {
  return items.reduce(
    (acc, item) => acc + 1 + countAll(item.sub_items ?? []),
    0
  );
}

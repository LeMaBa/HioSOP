import { ChecklistItem } from "../api/sops";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

function makeId() {
  return Math.random().toString(36).slice(2);
}

export default function ChecklistEditor({ items, onChange }: Props) {
  const sorted = [...items].sort((a, b) => a.order - b.order);

  const update = (id: string, patch: Partial<ChecklistItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((it) => it.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const next = sorted.map((it, i) => {
      if (i === idx) return { ...it, order: sorted[target].order };
      if (i === target) return { ...it, order: sorted[idx].order };
      return it;
    });
    onChange(next);
  };

  const remove = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  const add = () => {
    const maxOrder = items.length > 0 ? Math.max(...items.map((it) => it.order)) : 0;
    onChange([
      ...items,
      { id: makeId(), text: "", order: maxOrder + 1, required: true, sub_items: [] },
    ]);
  };

  return (
    <div className="space-y-2">
      {sorted.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2"
        >
          {/* Index */}
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-5 text-right flex-shrink-0">
            {idx + 1}.
          </span>

          {/* Text */}
          <input
            type="text"
            value={item.text}
            onChange={(e) => update(item.id, { text: e.target.value })}
            placeholder="Schritt beschreiben…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none border-b border-transparent focus:border-gray-300 dark:focus:border-gray-500"
          />

          {/* Required toggle */}
          <label className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 cursor-pointer select-none" title="Pflichtschritt">
            <input
              type="checkbox"
              checked={item.required}
              onChange={(e) => update(item.id, { required: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            Pflicht
          </label>

          {/* Move up */}
          <button
            type="button"
            onClick={() => move(item.id, -1)}
            disabled={idx === 0}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 flex-shrink-0"
            title="Nach oben"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Move down */}
          <button
            type="button"
            onClick={() => move(item.id, 1)}
            disabled={idx === sorted.length - 1}
            className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 flex-shrink-0"
            title="Nach unten"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => remove(item.id)}
            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0"
            title="Entfernen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary-600 dark:text-primary-400 border border-dashed border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Schritt hinzufügen
      </button>
    </div>
  );
}

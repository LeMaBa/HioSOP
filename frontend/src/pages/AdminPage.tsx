import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sopsApi, SOPCreate, ChecklistItem } from "../api/sops";
import { categoriesApi } from "../api/categories";
import { useAuthStore } from "../store/auth";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import { Plus, Upload, Send, Settings2, Eye, Pencil } from "lucide-react";
import ChecklistEditor from "../components/ChecklistEditor";
import clsx from "clsx";

function makeId() {
  return Math.random().toString(36).slice(2);
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    code: string;
    title: string;
    category: string;
    linkedCodes: string;
    tags: string;
    checklistItems: ChecklistItem[];
  }>({
    code: "",
    title: "",
    category: "",
    linkedCodes: "",
    tags: "",
    checklistItems: [],
  });
  const [diagramFile, setDiagramFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sops, isLoading } = useQuery({
    queryKey: ["sops-admin"],
    queryFn: () => sopsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: SOPCreate) => sopsApi.create(data),
    onSuccess: async (sop) => {
      if (diagramFile) {
        await sopsApi.uploadDiagram(sop.id, diagramFile);
      }
      queryClient.invalidateQueries({ queryKey: ["sops-admin"] });
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      setShowForm(false);
      resetForm();
      navigate(`/sop/${sop.code}`);
    },
    onError: (e: any) => {
      setFormError(e.response?.data?.detail || "Fehler beim Anlegen der SOP");
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => sopsApi.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sops-admin"] });
      queryClient.invalidateQueries({ queryKey: ["sops"] });
    },
  });

  const [showCatManager, setShowCatManager] = useState(false);
  const [catForm, setCatForm] = useState({ key: "", label: "", color: "bg-gray-100 text-gray-700" });
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: allCategories } = useQuery({
    queryKey: ["categories-all"],
    queryFn: categoriesApi.listAll,
    enabled: showCatManager,
  });

  const createCatMutation = useMutation({
    mutationFn: () => categoriesApi.create({ key: catForm.key, label: catForm.label, color: catForm.color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
      setCatForm({ key: "", label: "", color: "bg-gray-100 text-gray-700" });
    },
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Parameters<typeof categoriesApi.update>[1] }) =>
      categoriesApi.update(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
      setEditingCat(null);
    },
  });

  const deactivateCatMutation = useMutation({
    mutationFn: (key: string) => categoriesApi.deactivate(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-all"] });
    },
  });

  const resetForm = () => {
    setForm({ code: "", title: "", category: categories?.[0]?.key ?? "", linkedCodes: "", tags: "", checklistItems: [] });
    setDiagramFile(null);
    setFormError("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const checklistItems = form.checklistItems
      .filter((it) => it.text.trim())
      .map((it, i) => ({ ...it, order: i + 1 }));

    const linkedCodes = form.linkedCodes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    createMutation.mutate({
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      category: form.category,
      checklist_items: checklistItems,
      linked_sop_codes: linkedCodes,
      tags,
    });
  };

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="max-w-4xl space-y-8">
      {/* ── SOP-Verwaltung ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings2 size={22} />
            SOP-Verwaltung
          </h1>
          <button
            onClick={() => { setShowForm((v) => !v); resetForm(); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg"
          >
            <Plus size={16} />
            Neue SOP
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 space-y-4"
          >
            <h2 className="font-medium text-gray-800 dark:text-gray-200">Neue SOP anlegen</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SOP-Code *</label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="z.B. B-01"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kategorie *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className={inputCls}
                >
                  {(categories ?? []).map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Titel *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titel der SOP"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Checklisten-Schritte
              </label>
              <ChecklistEditor
                items={form.checklistItems}
                onChange={(items) => setForm((f) => ({ ...f, checklistItems: items }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Verlinkte SOPs (kommagetrennt)
                </label>
                <input
                  value={form.linkedCodes}
                  onChange={(e) => setForm((f) => ({ ...f, linkedCodes: e.target.value }))}
                  placeholder="GG-01, THL-03"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Tags/Stichwörter (kommagetrennt)
                </label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="Wohnungsbrand, Kellerbrand"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                draw.io-Diagramm (.drawio)
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  <Upload size={14} />
                  {diagramFile ? diagramFile.name : "Datei auswählen…"}
                  <input
                    type="file"
                    accept=".drawio"
                    className="hidden"
                    onChange={(e) => setDiagramFile(e.target.files?.[0] || null)}
                  />
                </label>
                {diagramFile && (
                  <button type="button" onClick={() => setDiagramFile(null)} className="text-xs text-red-500">
                    Entfernen
                  </button>
                )}
              </div>
            </div>

            {formError && (
              <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
              >
                {createMutation.isPending ? "Wird angelegt…" : "SOP anlegen"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {/* SOPs List */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {sops && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Titel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 hidden md:table-cell">Kategorie</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 hidden lg:table-cell">Version</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sops.map((sop) => (
                  <tr key={sop.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600 dark:text-gray-400">{sop.code}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 truncate max-w-xs">{sop.title}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <CategoryBadge category={sop.category} />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {sop.status && <StatusBadge status={sop.status} />}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400 dark:text-gray-500 text-xs">
                      {sop.version_number ? `v${sop.version_number}` : "–"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <a
                          href={`/sop/${sop.code}`}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded"
                          title="Ansehen"
                        >
                          <Eye size={14} />
                        </a>
                        {(sop.status === "DRAFT" || sop.status === "ACTIVE") && (
                          <a
                            href={`/sop/${sop.code}?edit=1`}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 rounded"
                            title="Bearbeiten"
                          >
                            <Pencil size={14} />
                          </a>
                        )}
                        {sop.status === "DRAFT" && (
                          <button
                            onClick={() => submitMutation.mutate(sop.id)}
                            disabled={submitMutation.isPending}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 rounded"
                            title="Zur Freigabe einreichen"
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sops.length === 0 && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                Noch keine SOPs vorhanden. Legen Sie die erste SOP an.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Kategorie-Verwaltung ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Kategorien</h2>
          <button
            onClick={() => setShowCatManager((v) => !v)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {showCatManager ? "Schließen" : "Verwalten"}
          </button>
        </div>

        {showCatManager && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            {/* Add new category */}
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kürzel (z. B. BRAND)</label>
                <input
                  value={catForm.key}
                  onChange={(e) => setCatForm((f) => ({ ...f, key: e.target.value.toUpperCase().replace(/\s/g, "_") }))}
                  placeholder="NEUES_KAT"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-36"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Anzeigename</label>
                <input
                  value={catForm.label}
                  onChange={(e) => setCatForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Neue Kategorie"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-44"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Farbe</label>
                <select
                  value={catForm.color}
                  onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {COLOR_PRESETS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                disabled={!catForm.key || !catForm.label || createCatMutation.isPending}
                onClick={() => createCatMutation.mutate()}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                <Plus size={14} />
                Hinzufügen
              </button>
            </div>

            {/* Category list */}
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Kürzel</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Badge</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(allCategories ?? []).map((cat) => (
                  <tr key={cat.key} className={clsx("hover:bg-gray-50 dark:hover:bg-gray-700/30", !cat.is_active && "opacity-50")}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{cat.key}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      {editingCat === cat.key ? (
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm w-40 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          autoFocus
                        />
                      ) : (
                        <span>{cat.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cat.color)}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                      {cat.is_active ? "Aktiv" : "Inaktiv"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        {editingCat === cat.key ? (
                          <>
                            <button
                              onClick={() => updateCatMutation.mutate({ key: cat.key, data: { label: editLabel } })}
                              className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            >Speichern</button>
                            <button onClick={() => setEditingCat(null)} className="text-xs text-gray-400 hover:underline">Abbrechen</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingCat(cat.key); setEditLabel(cat.label); }}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            >Umbenennen</button>
                            {cat.is_active ? (
                              <button
                                onClick={() => deactivateCatMutation.mutate(cat.key)}
                                className="text-xs text-red-500 dark:text-red-400 hover:underline"
                              >Deaktivieren</button>
                            ) : (
                              <button
                                onClick={() => updateCatMutation.mutate({ key: cat.key, data: { is_active: true } })}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline"
                              >Aktivieren</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const COLOR_PRESETS = [
  { value: "bg-gray-100 text-gray-700",   label: "Grau" },
  { value: "bg-red-100 text-red-700",     label: "Rot" },
  { value: "bg-orange-100 text-orange-700", label: "Orange" },
  { value: "bg-yellow-100 text-yellow-700", label: "Gelb" },
  { value: "bg-green-100 text-green-700", label: "Grün" },
  { value: "bg-teal-100 text-teal-700",   label: "Türkis" },
  { value: "bg-blue-100 text-blue-700",   label: "Blau" },
  { value: "bg-cyan-100 text-cyan-700",   label: "Cyan" },
  { value: "bg-indigo-100 text-indigo-700", label: "Indigo" },
  { value: "bg-purple-100 text-purple-700", label: "Lila" },
  { value: "bg-pink-100 text-pink-700",   label: "Pink" },
  { value: "bg-lime-100 text-lime-700",   label: "Limette" },
];

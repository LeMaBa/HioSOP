import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sopsApi, SOPCreate, SOPCategory, ChecklistItem } from "../api/sops";
import { useAuthStore } from "../store/auth";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import { Plus, Upload, Send, Settings2, Trash2, Eye } from "lucide-react";
import clsx from "clsx";
import { v4 as uuid } from "crypto";

const CATEGORIES: SOPCategory[] = ["BRAND", "THL", "GEFAHRGUT", "MANV", "WASSER", "ALLGEMEIN"];
const CATEGORY_LABELS: Record<SOPCategory, string> = {
  BRAND: "Brand",
  THL: "Technische Hilfeleistung",
  GEFAHRGUT: "Gefahrgut",
  MANV: "MANV",
  WASSER: "Wasser/Hochwasser",
  ALLGEMEIN: "Allgemein",
};

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
    category: SOPCategory;
    linkedCodes: string;
    tags: string;
    checklistText: string;
  }>({
    code: "",
    title: "",
    category: "BRAND",
    linkedCodes: "",
    tags: "",
    checklistText: "",
  });
  const [diagramFile, setDiagramFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

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

  const resetForm = () => {
    setForm({ code: "", title: "", category: "BRAND", linkedCodes: "", tags: "", checklistText: "" });
    setDiagramFile(null);
    setFormError("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const checklistItems: ChecklistItem[] = form.checklistText
      .split("\n")
      .map((line, i) => line.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: makeId(), text, order: i + 1, sub_items: [] }));

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

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
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
          className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-medium text-gray-800">Neue SOP anlegen</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SOP-Code *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="z.B. B-01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SOPCategory }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titel *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titel der SOP"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Checklisten-Schritte (eine Zeile = ein Schritt)
            </label>
            <textarea
              value={form.checklistText}
              onChange={(e) => setForm((f) => ({ ...f, checklistText: e.target.value }))}
              placeholder={"Schritt 1\nSchritt 2\nSchritt 3"}
              rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Verlinkte SOPs (kommagetrennt, z.B. GG-01, THL-03)
              </label>
              <input
                value={form.linkedCodes}
                onChange={(e) => setForm((f) => ({ ...f, linkedCodes: e.target.value }))}
                placeholder="GG-01, THL-03"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tags/Stichwörter (kommagetrennt)
              </label>
              <input
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Wohnungsbrand, Kellerbrand"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              draw.io-Diagramm (.drawio)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors">
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
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
              className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
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
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {sops && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Titel</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Kategorie</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Version</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sops.map((sop) => (
                <tr key={sop.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-600">{sop.code}</td>
                  <td className="px-4 py-3 text-gray-800 truncate max-w-xs">{sop.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <CategoryBadge category={sop.category} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {sop.status && <StatusBadge status={sop.status} />}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                    {sop.version_number ? `v${sop.version_number}` : "–"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={`/sop/${sop.code}`}
                        className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                        title="Ansehen"
                      >
                        <Eye size={14} />
                      </a>
                      {sop.status === "DRAFT" && (
                        <button
                          onClick={() => submitMutation.mutate(sop.id)}
                          disabled={submitMutation.isPending}
                          className="p-1.5 text-gray-400 hover:text-amber-600 rounded"
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
            <div className="text-center py-10 text-gray-400 text-sm">
              Noch keine SOPs vorhanden. Legen Sie die erste SOP an.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

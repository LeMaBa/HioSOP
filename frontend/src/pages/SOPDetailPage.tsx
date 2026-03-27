import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sopsApi, ChecklistItem } from "../api/sops";
import { categoriesApi } from "../api/categories";
import { useAuthStore, isAdmin, isOwner } from "../store/auth";
import Breadcrumb from "../components/Breadcrumb";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import ChecklistView from "../components/ChecklistView";
import ChecklistEditor from "../components/ChecklistEditor";
import DiagramViewer from "../components/DiagramViewer";
import {
  LayoutList, GitBranch, Star, ThumbsUp, ThumbsDown,
  Send, CheckCheck, XCircle, Archive, AlertCircle,
  Pencil, History, Save, X, Upload, Trash2,
} from "lucide-react";
import clsx from "clsx";

type Tab = "diagram" | "checklist" | "versions";

function makeId() { return Math.random().toString(36).slice(2); }

export default function SOPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("checklist");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    category: string;
    checklistItems: ChecklistItem[];
    tags: string;
    linkedCodes: string;
    changeComment: string;
    nextReviewDate: string;
    diagramFile: File | null;
  } | null>(null);

  const enterEdit = () => {
    if (!sop || !version) return;
    // If there's already a pending DRAFT, edit from that; otherwise edit from active version
    const editSource = (sop.pending_version?.status === "DRAFT" ? sop.pending_version : version);
    setEditForm({
      title: sop.title,
      category: sop.category,
      checklistItems: editSource.checklist_items.map((it) => ({ ...it, sub_items: it.sub_items ?? [] })),
      tags: editSource.tags.join(", "),
      linkedCodes: editSource.linked_sop_codes.join(", "),
      changeComment: editSource.change_comment ?? "",
      nextReviewDate: editSource.next_review_date
        ? new Date(editSource.next_review_date).toISOString().slice(0, 10)
        : "",
      diagramFile: null,
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditForm(null); };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: sop, isLoading, error } = useQuery({
    queryKey: ["sop", id],
    queryFn: () => sopsApi.get(id!),
    enabled: !!id,
  });

  const { data: versions } = useQuery({
    queryKey: ["sop-versions", id],
    queryFn: () => sopsApi.versions(id!),
    enabled: !!id && tab === "versions",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const hasDiagram = !!(sop?.current_version?.diagram_xml);

  // Auto-open edit mode when navigated here with ?edit=1
  useEffect(() => {
    if (sop && searchParams.get("edit") === "1" && !editing) {
      setSearchParams({}, { replace: true });
      enterEdit();
    }
  }, [sop]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!sop || !editForm) return;
      const items = editForm.checklistItems.map((it, i) => ({ ...it, order: i + 1 }));
      const tags = editForm.tags.split(",").map((s) => s.trim()).filter(Boolean);
      const linked = editForm.linkedCodes.split(",").map((s) => s.trim()).filter(Boolean);
      await sopsApi.update(sop.id, {
        title: editForm.title,
        category: editForm.category,
        checklist_items: items,
        tags,
        linked_sop_codes: linked,
        change_comment: editForm.changeComment || undefined,
        next_review_date: editForm.nextReviewDate || undefined,
      });
      if (editForm.diagramFile) {
        await sopsApi.uploadDiagram(sop.id, editForm.diagramFile);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sop", id] });
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      queryClient.invalidateQueries({ queryKey: ["sop-versions", id] });
      cancelEdit();
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => sopsApi.submit(sop!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sop", id] }),
  });

  const reviewMutation = useMutation({
    mutationFn: (vars: { action: "approve" | "reject"; comment?: string }) =>
      sopsApi.review(sop!.id, vars.action, vars.comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sop", id] });
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      queryClient.invalidateQueries({ queryKey: ["sop-versions", id] });
      setShowRejectModal(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => sopsApi.archive(sop!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      navigate("/");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => sopsApi.delete(sop!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      navigate("/");
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => sopsApi.toggleFavorite(sop!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sops"] });
      queryClient.invalidateQueries({ queryKey: ["sop", id] });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (rating: 1 | -1) =>
      sopsApi.submitFeedback(sop!.id, { rating, comment: feedbackComment || undefined }),
    onSuccess: () => { setShowFeedback(false); setFeedbackComment(""); },
  });

  // ── Loading / error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }
  if (error || !sop) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle size={18} />
        SOP nicht gefunden oder kein Zugriff.
      </div>
    );
  }

  const version = sop.current_version;
  const pendingVersion = sop.pending_version;
  const status = version?.status;
  const isFav = sop.is_favorite;
  // Can edit: admin + (DRAFT or ACTIVE). But if ACTIVE already has a pending draft/review, editing
  // would patch that draft — allow it but only when pending is DRAFT (not IN_REVIEW).
  const canEdit = isAdmin(user) && (
    status === "DRAFT" ||
    (status === "ACTIVE" && (!pendingVersion || pendingVersion.status === "DRAFT"))
  );

  const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumb crumbs={[{ label: sop.code + " – " + sop.title }]} />

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="font-mono text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {sop.code}
              </span>
              <CategoryBadge category={sop.category} />
              {status && <StatusBadge status={status} />}
              {version && (
                <span className="text-xs text-gray-400 dark:text-gray-500 self-center">v{version.version_number}</span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{sop.title}</h1>
            {version?.released_at && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Freigegeben: {new Date(version.released_at).toLocaleDateString("de-DE")}
                {version.next_review_date && (
                  <span className="ml-3">
                    · Nächste Prüfung: {new Date(version.next_review_date).toLocaleDateString("de-DE")}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => favoriteMutation.mutate()}
              title={isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Star size={16} className={isFav ? "text-amber-400 fill-amber-400" : "text-gray-400"} />
            </button>

            <button
              onClick={() => setShowFeedback((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ThumbsUp size={14} />
              Feedback
            </button>

            {/* Edit button */}
            {canEdit && !editing && (
              <button
                onClick={enterEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Pencil size={14} />
                Bearbeiten
              </button>
            )}

            {isAdmin(user) && status === "DRAFT" && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
              >
                <Send size={14} />
                Zur Freigabe einreichen
              </button>
            )}

            {isOwner(user) && status === "IN_REVIEW" && (
              <>
                <button
                  onClick={() => reviewMutation.mutate({ action: "approve" })}
                  disabled={reviewMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
                >
                  <CheckCheck size={14} />
                  Freigeben
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  <XCircle size={14} />
                  Ablehnen
                </button>
              </>
            )}

            {isOwner(user) && status === "ACTIVE" && (
              <button
                onClick={() => { if (confirm("SOP wirklich archivieren?")) archiveMutation.mutate(); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Archive size={14} />
                Archivieren
              </button>
            )}

            {isOwner(user) && status === "ARCHIVED" && (
              <button
                onClick={() => {
                  if (confirm(`SOP „${sop.title}" endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`))
                    deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60"
              >
                <Trash2 size={14} />
                Löschen
              </button>
            )}
          </div>
        </div>

        {/* Notice when ACTIVE: editing creates new revision (only if no pending draft exists yet) */}
        {editing && status === "ACTIVE" && !pendingVersion && (
          <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            Speichern erstellt automatisch eine neue Revision (v{version?.version_number} → neue Entwurfsversion).
          </div>
        )}
        {editing && status === "ACTIVE" && pendingVersion?.status === "DRAFT" && (
          <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-blue-700 dark:text-blue-400">
            Du bearbeitest die ausstehende Revision v{pendingVersion.version_number}.
          </div>
        )}

        {/* Feedback form */}
        {showFeedback && !editing && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Feedback geben</p>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Optionaler Kommentar…"
              rows={2}
              className={inputCls + " mb-2"}
            />
            <div className="flex gap-2">
              <button onClick={() => feedbackMutation.mutate(1)} disabled={feedbackMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg">
                <ThumbsUp size={14} /> Hilfreich
              </button>
              <button onClick={() => feedbackMutation.mutate(-1)} disabled={feedbackMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg">
                <ThumbsDown size={14} /> Nicht hilfreich
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Pending version banner ───────────────────────────────────────────── */}
      {sop.pending_version && !editing && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Ausstehende Revision v{sop.pending_version.version_number}
                </span>
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                  <StatusBadge status={sop.pending_version.status} />
                </span>
              </div>
              {sop.pending_version.change_comment && (
                <span className="text-xs text-amber-700 dark:text-amber-400 italic ml-2">
                  „{sop.pending_version.change_comment}"
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isAdmin(user) && sop.pending_version.status === "DRAFT" && (
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-60"
                >
                  <Send size={14} />
                  Zur Freigabe einreichen
                </button>
              )}
              {isOwner(user) && sop.pending_version.status === "IN_REVIEW" && (
                <>
                  <button
                    onClick={() => reviewMutation.mutate({ action: "approve" })}
                    disabled={reviewMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60"
                  >
                    <CheckCheck size={14} />
                    Freigeben
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
                  >
                    <XCircle size={14} />
                    Ablehnen
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit form ────────────────────────────────────────────────────────── */}
      {editing && editForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-primary-200 dark:border-primary-800 p-5 space-y-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Pencil size={16} />
            SOP bearbeiten
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Titel *</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => f && ({ ...f, title: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kategorie</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((f) => f && ({ ...f, category: e.target.value }))}
                className={inputCls}
              >
                {(categories ?? []).map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nächste Überprüfung</label>
              <input
                type="date"
                value={editForm.nextReviewDate}
                onChange={(e) => setEditForm((f) => f && ({ ...f, nextReviewDate: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Checklist editor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Checklisten-Schritte
            </label>
            <ChecklistEditor
              items={editForm.checklistItems}
              onChange={(items) => setEditForm((f) => f && ({ ...f, checklistItems: items }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tags (kommagetrennt)</label>
              <input
                value={editForm.tags}
                onChange={(e) => setEditForm((f) => f && ({ ...f, tags: e.target.value }))}
                placeholder="Wohnungsbrand, Kellerbrand"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Verlinkte SOPs (kommagetrennt)</label>
              <input
                value={editForm.linkedCodes}
                onChange={(e) => setEditForm((f) => f && ({ ...f, linkedCodes: e.target.value }))}
                placeholder="GG-01, THL-03"
                className={inputCls}
              />
            </div>
          </div>

          {/* Diagram */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Diagramm ersetzen (.drawio) — optional
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400">
              <Upload size={14} />
              {editForm.diagramFile ? editForm.diagramFile.name : "Datei auswählen…"}
              <input type="file" accept=".drawio" className="hidden"
                onChange={(e) => setEditForm((f) => f && ({ ...f, diagramFile: e.target.files?.[0] ?? null }))} />
            </label>
            {editForm.diagramFile && (
              <button type="button" onClick={() => setEditForm((f) => f && ({ ...f, diagramFile: null }))}
                className="ml-2 text-xs text-red-500">Entfernen</button>
            )}
          </div>

          {/* Change comment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Änderungsnotiz {status === "ACTIVE" && <span className="text-gray-400">(empfohlen)</span>}
            </label>
            <textarea
              value={editForm.changeComment}
              onChange={(e) => setEditForm((f) => f && ({ ...f, changeComment: e.target.value }))}
              placeholder="Was wurde geändert und warum?"
              rows={2}
              className={inputCls}
            />
          </div>

          {updateMutation.error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {(updateMutation.error as any)?.response?.data?.detail ?? "Fehler beim Speichern"}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editForm.title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg disabled:opacity-60"
            >
              <Save size={14} />
              {updateMutation.isPending ? "Speichern…" : "Speichern"}
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X size={14} />
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      {!editing && (
        <>
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <TabButton active={tab === "diagram"} onClick={() => setTab("diagram")}
              icon={<GitBranch size={15} />} label="Flussdiagramm" disabled={!hasDiagram} />
            <TabButton active={tab === "checklist"} onClick={() => setTab("checklist")}
              icon={<LayoutList size={15} />} label="Checkliste" />
            <TabButton active={tab === "versions"} onClick={() => setTab("versions")}
              icon={<History size={15} />} label="Versionen" />
          </div>

          {/* Tab content */}
          <div>
            {tab === "diagram" && hasDiagram && (
              <DiagramViewer xml={version!.diagram_xml!} />
            )}
            {tab === "diagram" && !hasDiagram && (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-400 dark:text-gray-500">
                <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
                <p>Kein Diagramm hinterlegt</p>
                <button className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  onClick={() => setTab("checklist")}>Zur Checklisten-Ansicht</button>
              </div>
            )}

            {tab === "checklist" && version && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <ChecklistView items={version.checklist_items} />
              </div>
            )}

            {tab === "versions" && (
              <VersionHistory sopId={id!} />
            )}
          </div>

          {/* Tags */}
          {version && version.tags.length > 0 && tab !== "versions" && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {version.tags.map((tag) => (
                  <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`}
                    className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-colors">
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Linked SOPs */}
          {version && version.linked_sop_codes.length > 0 && tab !== "versions" && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Verlinkte SOPs</h2>
              <div className="flex flex-wrap gap-2">
                {version.linked_sop_codes.map((code) => (
                  <Link key={code} to={`/sop/${code}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800 text-sm hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                    {code}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Review comment */}
          {version?.review_comment && status === "DRAFT" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-400">
              <p className="font-medium mb-1">Ablehnungskommentar:</p>
              <p>{version.review_comment}</p>
            </div>
          )}
        </>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">SOP ablehnen</h2>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Begründung (Pflichtfeld)…"
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                Abbrechen
              </button>
              <button
                disabled={!rejectComment.trim() || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ action: "reject", comment: rejectComment })}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Checklist diff ────────────────────────────────────────────────────────────
type DiffLine = { text: string; kind: "added" | "removed" | "same" };

function diffChecklists(prev: ChecklistItem[], next: ChecklistItem[]): DiffLine[] {
  // Flatten to ordered text lines (including sub-items)
  function flatten(items: ChecklistItem[], prefix = ""): string[] {
    return [...items]
      .sort((a, b) => a.order - b.order)
      .flatMap((it) => [
        prefix + it.text,
        ...flatten(it.sub_items ?? [], prefix + "  "),
      ]);
  }
  const prevLines = flatten(prev);
  const nextLines = flatten(next);
  const prevSet = new Set(prevLines);
  const nextSet = new Set(nextLines);

  const lines: DiffLine[] = [];
  // Removed from prev
  for (const t of prevLines) if (!nextSet.has(t)) lines.push({ text: t, kind: "removed" });
  // Added in next
  for (const t of nextLines) if (!prevSet.has(t)) lines.push({ text: t, kind: "added" });
  // Unchanged (in next order)
  for (const t of nextLines) if (prevSet.has(t)) lines.push({ text: t, kind: "same" });

  // Re-sort: removed first (to show what was lost), then same, then added
  return [
    ...lines.filter((l) => l.kind === "removed"),
    ...lines.filter((l) => l.kind === "same"),
    ...lines.filter((l) => l.kind === "added"),
  ];
}

// ── Version History ───────────────────────────────────────────────────────────
function VersionHistory({ sopId }: { sopId: string }) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["sop-versions", sopId],
    queryFn: () => sopsApi.versions(sopId),
  });

  // Index of the currently expanded version (null = none open)
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
        Keine Versionshistorie vorhanden.
      </div>
    );
  }

  // versions[0] = newest. prev version = versions[idx+1]
  return (
    <div className="space-y-3">
      {/* Navigation hint */}
      {versions.length > 1 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
          {versions.length} Versionen — aufklappen zum Vergleich
        </p>
      )}

      {versions.map((v, idx) => {
        const isOpen = openIdx === idx;
        const prevVersion = versions[idx + 1] ?? null; // older version
        const diff = prevVersion
          ? diffChecklists(prevVersion.checklist_items, v.checklist_items)
          : null;
        const hasChanges = diff ? diff.some((l) => l.kind !== "same") : false;

        const dateLabel = v.released_at
          ? `Freigegeben ${new Date(v.released_at).toLocaleDateString("de-DE")}`
          : v.submitted_at
          ? `Eingereicht ${new Date(v.submitted_at).toLocaleDateString("de-DE")}`
          : `Erstellt ${new Date(v.created_at).toLocaleDateString("de-DE")}`;

        return (
          <div
            key={v.id}
            className={clsx(
              "bg-white dark:bg-gray-800 rounded-xl border overflow-hidden",
              idx === 0
                ? "border-primary-200 dark:border-primary-800"
                : "border-gray-200 dark:border-gray-700"
            )}
          >
            {/* Header row — always visible, click to expand */}
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-gray-700 dark:text-gray-300">
                  v{v.version_number}
                </span>
                <StatusBadge status={v.status} />
                {idx === 0 && (
                  <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded font-medium">
                    Aktuell
                  </span>
                )}
                {hasChanges && !isOpen && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    · {diff!.filter((l) => l.kind === "added").length} hinzugefügt,{" "}
                    {diff!.filter((l) => l.kind === "removed").length} entfernt
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">{dateLabel}</span>
                <svg
                  className={clsx("w-4 h-4 text-gray-400 transition-transform", isOpen && "rotate-180")}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4">

                {/* Metadata row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {v.released_by && <span>Freigegeben von: {v.released_by}</span>}
                  {v.reviewed_by && <span>Geprüft von: {v.reviewed_by}</span>}
                  {v.submitted_by && <span>Eingereicht von: {v.submitted_by}</span>}
                  {v.next_review_date && (
                    <span>Nächste Prüfung: {new Date(v.next_review_date).toLocaleDateString("de-DE")}</span>
                  )}
                </div>

                {/* Change comment */}
                {v.change_comment && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                    „{v.change_comment}"
                  </div>
                )}

                {/* Rejection note */}
                {v.review_comment && v.status === "DRAFT" && (
                  <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-3 py-2">
                    Abgelehnt: {v.review_comment}
                  </div>
                )}

                {/* Tags */}
                {v.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {v.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Checklist diff (if previous version exists) */}
                {diff ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Checkliste — Änderungen gegenüber v{prevVersion!.version_number}
                    </p>
                    <ol className="space-y-1">
                      {diff.map((line, i) => (
                        <li
                          key={i}
                          className={clsx(
                            "flex items-start gap-2 px-3 py-1.5 rounded text-sm",
                            line.kind === "added"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                              : line.kind === "removed"
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 line-through opacity-70"
                              : "text-gray-700 dark:text-gray-300"
                          )}
                        >
                          <span className="flex-shrink-0 text-xs font-mono mt-0.5 w-4 text-center">
                            {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : "·"}
                          </span>
                          <span>{line.text}</span>
                        </li>
                      ))}
                    </ol>
                    {!hasChanges && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Keine Änderungen an der Checkliste gegenüber der Vorversion.
                      </p>
                    )}
                  </div>
                ) : (
                  // First-ever version — just show the checklist
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Checkliste (Erstversion)
                    </p>
                    <ol className="space-y-1">
                      {[...v.checklist_items]
                        .sort((a, b) => a.order - b.order)
                        .map((item, i) => (
                          <li key={item.id} className="flex items-start gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-4 text-right flex-shrink-0">{i + 1}.</span>
                            <span>{item.text}</span>
                          </li>
                        ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── TabButton ─────────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon, label, disabled }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-700 text-primary-700 dark:border-primary-400 dark:text-primary-400"
          : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sopsApi } from "../api/sops";
import { useAuthStore, isAdmin, isOwner } from "../store/auth";
import Breadcrumb from "../components/Breadcrumb";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import ChecklistView from "../components/ChecklistView";
import DiagramViewer from "../components/DiagramViewer";
import {
  LayoutList, GitBranch, Star, StarOff, ThumbsUp, ThumbsDown,
  Send, CheckCheck, XCircle, Archive, AlertCircle
} from "lucide-react";
import clsx from "clsx";

type Tab = "diagram" | "checklist";

export default function SOPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("checklist");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const { data: sop, isLoading, error } = useQuery({
    queryKey: ["sop", id],
    queryFn: () => sopsApi.get(id!),
    enabled: !!id,
  });

  // Auto-switch to checklist if no diagram
  const hasDiagram = !!(sop?.current_version?.diagram_xml);

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
    onSuccess: () => {
      setShowFeedback(false);
      setFeedbackComment("");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !sop) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle size={18} />
        SOP nicht gefunden oder kein Zugriff.
      </div>
    );
  }

  const version = sop.current_version;
  const status = version?.status;
  const isFav = false; // TODO: derive from list cache

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <Breadcrumb crumbs={[{ label: sop.code + " – " + sop.title }]} />

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="font-mono text-sm font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {sop.code}
              </span>
              <CategoryBadge category={sop.category} />
              {status && <StatusBadge status={status} />}
              {version && (
                <span className="text-xs text-gray-400 self-center">v{version.version_number}</span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{sop.title}</h1>
            {version?.released_at && (
              <p className="text-xs text-gray-400 mt-1">
                Freigegeben: {new Date(version.released_at).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => favoriteMutation.mutate()}
              title="Favorit"
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Star size={16} className="text-amber-400" />
            </button>

            <button
              onClick={() => setShowFeedback((v) => !v)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <ThumbsUp size={14} />
              Feedback
            </button>

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
                onClick={() => {
                  if (confirm("SOP wirklich archivieren?")) archiveMutation.mutate();
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
              >
                <Archive size={14} />
                Archivieren
              </button>
            )}
          </div>
        </div>

        {/* Feedback form */}
        {showFeedback && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Feedback geben</p>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Optionaler Kommentar…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => feedbackMutation.mutate(1)}
                disabled={feedbackMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg"
              >
                <ThumbsUp size={14} /> Hilfreich
              </button>
              <button
                onClick={() => feedbackMutation.mutate(-1)}
                disabled={feedbackMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
              >
                <ThumbsDown size={14} /> Nicht hilfreich
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex border-b border-gray-200">
        <TabButton
          active={tab === "diagram"}
          onClick={() => setTab("diagram")}
          icon={<GitBranch size={15} />}
          label="Flussdiagramm"
          disabled={!hasDiagram}
        />
        <TabButton
          active={tab === "checklist"}
          onClick={() => setTab("checklist")}
          icon={<LayoutList size={15} />}
          label="Checkliste"
        />
      </div>

      {/* Content */}
      <div>
        {tab === "diagram" && hasDiagram && (
          <DiagramViewer xml={version!.diagram_xml!} />
        )}
        {tab === "diagram" && !hasDiagram && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-400">
            <GitBranch size={32} className="mx-auto mb-2 opacity-30" />
            <p>Kein Diagramm hinterlegt</p>
            <button
              className="mt-2 text-sm text-primary-600 hover:underline"
              onClick={() => setTab("checklist")}
            >
              Zur Checklisten-Ansicht
            </button>
          </div>
        )}
        {tab === "checklist" && version && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <ChecklistView items={version.checklist_items} />
          </div>
        )}
      </div>

      {/* Linked SOPs */}
      {version && version.linked_sop_codes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Verlinkte SOPs</h2>
          <div className="flex flex-wrap gap-2">
            {version.linked_sop_codes.map((code) => (
              <Link
                key={code}
                to={`/sop/${code}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200 text-sm hover:bg-primary-100 transition-colors"
              >
                {code}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Review comment */}
      {version?.review_comment && status === "DRAFT" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Ablehnungskommentar:</p>
          <p>{version.review_comment}</p>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">SOP ablehnen</h2>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Begründung (Pflichtfeld)…"
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                disabled={!rejectComment.trim() || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ action: "reject", comment: rejectComment })}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                Ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-700 text-primary-700"
          : "border-transparent text-gray-500 hover:text-gray-700",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

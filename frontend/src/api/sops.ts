import { apiClient } from "./client";

export type SOPCategory = string;
export type SOPStatus = "DRAFT" | "IN_REVIEW" | "ACTIVE" | "ARCHIVED";

export interface ChecklistItem {
  id: string;
  text: string;
  order: number;
  required: boolean;
  sub_items: ChecklistItem[];
}

export interface SOPVersion {
  id: string;
  sop_id: string;
  version_number: string;
  status: SOPStatus;
  checklist_items: ChecklistItem[];
  diagram_xml: string | null;
  linked_sop_codes: string[];
  tags: string[];
  change_comment: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  released_at: string | null;
  released_by: string | null;
  next_review_date: string | null;
}

export interface SOPListItem {
  id: string;
  code: string;
  title: string;
  category: SOPCategory;
  status: SOPStatus | null;
  version_number: string | null;
  tags: string[];
  created_at: string;
  released_at: string | null;
  is_favorite: boolean;
}

export interface SOPResponse {
  id: string;
  code: string;
  title: string;
  category: SOPCategory;
  created_by: string;
  created_at: string;
  active_version_id: string | null;
  current_version: SOPVersion | null;
  pending_version: SOPVersion | null;
  is_favorite: boolean;
}

export interface SOPCreate {
  code: string;
  title: string;
  category: SOPCategory;
  checklist_items: ChecklistItem[];
  diagram_xml?: string;
  linked_sop_codes: string[];
  tags: string[];
}

export interface SOPUpdate {
  title?: string;
  category?: SOPCategory;
  checklist_items?: ChecklistItem[];
  diagram_xml?: string;
  linked_sop_codes?: string[];
  tags?: string[];
  change_comment?: string;
  next_review_date?: string;
}

export interface FeedbackCreate {
  rating: 1 | -1;
  comment?: string;
}

export const sopsApi = {
  list: (params?: { q?: string; category?: string; tag?: string }) =>
    apiClient.get<SOPListItem[]>("/sops", { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<SOPResponse>(`/sops/${id}`).then((r) => r.data),

  create: (data: SOPCreate) => apiClient.post<SOPResponse>("/sops", data).then((r) => r.data),

  update: (id: string, data: SOPUpdate) =>
    apiClient.patch<SOPResponse>(`/sops/${id}`, data).then((r) => r.data),

  submit: (id: string) => apiClient.post(`/sops/${id}/submit`).then((r) => r.data),

  review: (id: string, action: "approve" | "reject", comment?: string) =>
    apiClient.post(`/sops/${id}/review`, { action, comment }).then((r) => r.data),

  archive: (id: string) => apiClient.post(`/sops/${id}/archive`).then((r) => r.data),

  versions: (id: string) => apiClient.get<SOPVersion[]>(`/sops/${id}/versions`).then((r) => r.data),

  uploadDiagram: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post(`/sops/${id}/diagram`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  delete: (id: string) => apiClient.delete(`/sops/${id}`),

  toggleFavorite: (id: string) => apiClient.post(`/sops/${id}/favorite`),

  exportPdf: (params?: { category?: string; ids?: string }) =>
    apiClient.get("/sops/export", { params, responseType: "blob" }).then((r) => r.data as Blob),

  submitFeedback: (id: string, data: FeedbackCreate) =>
    apiClient.post(`/sops/${id}/feedback`, data).then((r) => r.data),

  getFeedback: (id: string) =>
    apiClient.get(`/sops/${id}/feedback`).then((r) => r.data),

  getAuditLog: (id: string) =>
    apiClient.get(`/sops/${id}/audit`).then((r) => r.data),
};

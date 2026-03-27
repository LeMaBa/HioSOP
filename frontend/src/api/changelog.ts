import { apiClient } from "./client";

export interface ChangelogEntry {
  id: string;
  timestamp: string;
  username: string;
  sop_id: string | null;
  sop_code: string | null;
  sop_title: string | null;
  sop_category: string | null;
  version_number: string | null;
  change_comment: string | null;
}

export const changelogApi = {
  list: (params?: { skip?: number; limit?: number }) =>
    apiClient.get<ChangelogEntry[]>("/changelog", { params }).then((r) => r.data),
};

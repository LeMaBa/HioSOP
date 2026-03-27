import { apiClient } from "./client";

export interface Category {
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryCreate {
  key: string;
  label: string;
  color?: string;
  sort_order?: number;
}

export interface CategoryUpdate {
  label?: string;
  color?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const categoriesApi = {
  list: () => apiClient.get<Category[]>("/categories").then((r) => r.data),
  listAll: () => apiClient.get<Category[]>("/categories/all").then((r) => r.data),
  create: (data: CategoryCreate) => apiClient.post<Category>("/categories", data).then((r) => r.data),
  update: (key: string, data: CategoryUpdate) =>
    apiClient.patch<Category>(`/categories/${key}`, data).then((r) => r.data),
  deactivate: (key: string) => apiClient.delete(`/categories/${key}`),
};

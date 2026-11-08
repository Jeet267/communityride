import { api } from './api';

/** Uploads a private document (licence, RC, insurance) and returns its storage key. */
export async function uploadDoc(file: File) {
  const form = new FormData();
  form.append('file', file);
  return (await api<{ key: string }>('/uploads/documents', { form })).key;
}

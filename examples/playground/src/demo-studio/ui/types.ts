export type Toast = {
  id: string;
  title: string;
  body?: string;
  tone?: 'success' | 'error' | 'info';
};

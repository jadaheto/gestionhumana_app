export interface PageRequest {
  page: number;
  size: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export function emptyPage<T>(req: PageRequest): Page<T> {
  return { items: [], total: 0, page: req.page, size: req.size };
}

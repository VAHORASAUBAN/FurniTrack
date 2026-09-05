export interface Page<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface ListParams {
  page?: number
  page_size?: number
  search?: string
  sort?: string
  include_archived?: boolean
  /** Not every endpoint supports these — each accepts and ignores whatever
   * query params it doesn't recognise, so it's harmless to always include
   * them here rather than forking the type per module. */
  status?: string
  date_from?: string
  date_to?: string
}

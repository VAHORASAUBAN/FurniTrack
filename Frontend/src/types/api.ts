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
}

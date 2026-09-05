export type ContactType = 'CUSTOMER' | 'VENDOR' | 'BOTH'

export interface Contact {
  id: number
  name: string
  contact_type: ContactType
  email: string | null
  mobile: string | null
  street: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  profile_image_url: string | null
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ContactInput {
  name: string
  contact_type: ContactType
  email?: string
  mobile?: string
  street?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
  create_portal_user?: boolean
}

export interface PortalCredentials {
  login_id: string
  temporary_password: string
}

export interface ContactCreateResponse {
  contact: Contact
  portal_credentials: PortalCredentials | null
}

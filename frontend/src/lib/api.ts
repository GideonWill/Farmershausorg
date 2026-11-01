import { clearAuthTokens, getAuthTokens, saveAuthTokens } from './auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export type Branch = {
  id: string
  slug: string
  name: string
  address: string
  phone: string
  latitude: string | null
  longitude: string | null
  opening_hours: Record<string, { open: string; close: string } | null>
  hours_are_placeholder: boolean
  is_open: boolean
  is_active: boolean
}

export type Category = {
  id: string
  slug: string
  name: string
  description: string
  display_order: number
}

export type Product = {
  id: string
  sku: string
  slug: string
  category: string
  name: string
  description: string
  unit: string
  unit_type: string
  base_price_minor: number
  image_url: string
  gallery_image_urls: string[]
  nutrition: Record<string, string | number>
  origin: string
  tags: string[]
  branch_availability: { is_available: boolean; price_minor: number; available_quantity: number }
  available_at_other_branches: Array<{
    id: string
    slug: string
    name: string
    price_minor: number
  }>
}

export type BasketPackage = {
  id: string
  sku: string
  slug: string
  name: string
  category: string | null
  category_name: string | null
  description: string
  base_price_minor: number
  image_url: string
  is_placeholder: boolean
  gift_message_allowed: boolean
  components: Array<{
    product: string
    product_name: string
    product_unit: string
    quantity: number
    is_optional: boolean
  }>
  branch_availability: { is_available: boolean; price_minor: number }
}

export type CartItem = {
  id: string
  product: null | {
    id: string
    slug: string
    name: string
    unit: string
    unit_type: string
    image_url: string
    unit_price_minor: number
    is_available: boolean
  }
  basket_package: null | { id: string; name: string; slug: string; is_placeholder: boolean }
  quantity: number
  gift_recipient_name: string
  gift_message: string
}

export type Cart = {
  id: string
  branch: string
  status: string
  items: CartItem[]
  updated_at: string
}

export type SiteSettings = {
  contact: {
    primary_phone: string
    secondary_phone: string
    whatsapp_numbers: string[]
    email: string
    social_links: Record<string, string>
    announcement_bar_text: string
    delivery_policy_text: string
  }
  site: { currency_code: string; currency_symbol: string; tagline: string }
}

export type CartValidation = {
  cart_id: string
  branch_id: string
  is_valid: boolean
  unavailable_items: Array<{
    cart_item_id: string
    product_id?: string
    basket_package_id?: string
    product_name: string
    requested_quantity: number
    reason: string
  }>
}

export type FulfillmentSlot = {
  id: string
  method: 'delivery' | 'pickup'
  starts_at: string
  ends_at: string
  remaining_capacity: number
}

export type DeliveryZone = {
  id: string
  name: string
  area_description: string
  postcodes: string[]
  delivery_fee_minor: number
  minimum_order_minor: number
}

export type Address = {
  id: string
  recipient_name: string
  phone: string
  address_line_1: string
  address_line_2: string
  area: string
  directions: string
  latitude: string | null
  longitude: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type CustomerProfile = {
  id: string
  username: string
  email: string
  phone: string
  display_name: string
  first_name: string
  last_name: string
  is_super_admin: boolean
  branch_memberships: Array<{
    branch_id: string
    branch_name: string
    branch_slug: string
    role: 'staff' | 'manager'
  }>
}

export type OrderLine = {
  id: string
  product_id: string | null
  sku_snapshot: string
  name_snapshot: string
  unit_snapshot: string
  quantity: number
  unit_price_minor: number
  line_total_minor: number
  gift_recipient_name: string
  gift_message: string
  components: Array<{ name: string; unit: string; quantity: number }>
  is_removed: boolean
}

export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'picking' | 'ready_for_dispatch' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'expired'
export type PaymentStatus = 'created' | 'pending' | 'succeeded' | 'failed' | 'expired' | 'refund_pending' | 'partially_refunded' | 'refunded'

export type CustomerOrder = {
  id: string
  order_number: string
  branch: string
  branch_snapshot: { id: string; name: string; address: string; phone: string }
  fulfillment_method: 'delivery' | 'pickup'
  fulfillment_slot: string | null
  delivery_snapshot: { zone: string; fee_minor: number; method: string; slot_starts_at: string | null; slot_ends_at: string | null }
  address_snapshot: { recipient_name: string; phone: string; address_line_1: string; address_line_2: string; area: string; directions: string; latitude: string | null; longitude: string | null }
  status: OrderStatus
  payment_status: PaymentStatus | null
  currency: string
  subtotal_minor: number
  delivery_fee_minor: number
  discount_minor: number
  total_amount_minor: number
  voucher_code_snapshot: string
  customer_note: string
  customer_name: string
  customer_phone: string
  rider_name: string
  rider_phone: string
  staff_confirmed_at: string | null
  refund_difference_minor: number
  refund_review_required: boolean
  stock_adjustment_note: string
  lines: OrderLine[]
  status_history: Array<{ from_status: OrderStatus | null; to_status: OrderStatus; note: string; created_at: string }>
  created_at: string
  paid_at: string | null
  confirmed_at: string | null
  picking_at: string | null
  ready_for_dispatch_at: string | null
  out_for_delivery_at: string | null
  cancelled_at: string | null
  delivered_at: string | null
  expired_at: string | null
}

export type PaymentAttempt = {
  id: string
  status: 'created' | 'pending' | 'succeeded' | 'failed'
  checkout_reference: string
  provider_reference: string
  checkout_url: string
  result_code: string
  created_at: string
  completed_at: string | null
}

export type OrderPayment = {
  id: string
  order: string
  provider: string
  method: 'mobile_money' | 'card'
  network: string
  amount_minor: number
  currency: string
  status: PaymentStatus
  succeeded_at: string | null
  attempts: PaymentAttempt[]
  current_attempt?: PaymentAttempt | null
}

type ApiOptions = RequestInit & { cartSessionKey?: string }

async function apiRequest(path: string, options: ApiOptions = {}): Promise<Response> {
  const { cartSessionKey, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (requestOptions.body && !(requestOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (cartSessionKey) headers.set('X-Cart-Session', cartSessionKey)

  const tokens = getAuthTokens()
  if (tokens?.access && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${tokens.access}`)
  }

  let response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers })
  if (response.status === 401 && tokens?.refresh && !path.includes('/auth/token/refresh/')) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
    if (refreshed.ok) {
      const nextTokens = await refreshed.json() as { access: string; refresh?: string }
      saveAuthTokens({ access: nextTokens.access, refresh: nextTokens.refresh ?? tokens.refresh })
      headers.set('Authorization', `Bearer ${nextTokens.access}`)
      response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers })
    } else {
      clearAuthTokens()
    }
  }

  return response
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await apiRequest(path, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { detail?: string; [key: string]: unknown }
      | null
    const message = body?.detail ?? Object.values(body ?? {}).flat().join(' ') ?? response.statusText
    throw new Error(String(message) || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await apiRequest(path)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Download failed (${response.status})`)
  }
  const file = await response.blob()
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function getList<T>(payload: T[] | { results: T[] }): T[] {
  return Array.isArray(payload) ? payload : payload.results
}

export function money(amountMinor: number, symbol = 'GH₵'): string {
  return `${symbol} ${(amountMinor / 100).toFixed(2)}`
}

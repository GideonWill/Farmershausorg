import type { Address } from './api'

export interface CustomerPrivilege {
  id: string
  title: string
  description: string
  badge: string
  icon: string
}

export interface CustomerAccount {
  id: string
  username: string
  phone: string
  email: string
  display_name: string
  password?: string
  membership_tier: 'Harvest Member' | 'Harvest Silver' | 'Harvest Gold'
  loyalty_points: number
  joined_at: string
  addresses: Address[]
  privileges: CustomerPrivilege[]
}

const ACCOUNTS_STORAGE_KEY = 'farmershaus_customer_accounts'
const CURRENT_CUSTOMER_KEY = 'farmershaus_current_customer'

const DEFAULT_PRIVILEGES: CustomerPrivilege[] = [
  {
    id: 'priv-discount',
    title: '5% Harvest Member Savings',
    description: 'Exclusive 5% automatic discount on all single-origin farm fruits and fresh vegetables.',
    badge: 'Active Now',
    icon: 'tag',
  },
  {
    id: 'priv-delivery',
    title: 'Free Priority Dispatch on Orders > GH₵ 100',
    description: 'Complimentary expedited delivery from your local FarmersHaus branch on qualifying baskets.',
    badge: 'Member Perk',
    icon: 'truck',
  },
  {
    id: 'priv-wishlist',
    title: 'Seasonal Wishlist & Restock Priority',
    description: 'Save favorite seasonal items to your wishlist and receive priority packing alerts upon fresh harvest arrival.',
    badge: 'Always On',
    icon: 'heart',
  },
  {
    id: 'priv-quality',
    title: '100% Freshness Guarantee & Direct Exchange',
    description: 'Hassle-free replacement guarantee on any produce item that does not meet our strict crispness standard.',
    badge: 'Protected',
    icon: 'shield',
  },
  {
    id: 'priv-points',
    title: 'Harvest Loyalty Points',
    description: 'Earn 1 Harvest Point for every GH₵ 1 spent. Redeem points for free produce totes and chef recipe bundles.',
    badge: 'Earn 1pt / GH₵ 1',
    icon: 'star',
  },
]

const SEED_CUSTOMERS: CustomerAccount[] = [
  {
    id: 'cust-seed-001',
    username: '0550488906',
    phone: '+233 55 048 8906',
    email: 'client@farmershaus.org',
    display_name: 'Akosua Mensah',
    password: 'password123',
    membership_tier: 'Harvest Gold',
    loyalty_points: 320,
    joined_at: '2026-08-15T09:00:00Z',
    addresses: [
      {
        id: 'addr-seed-1',
        recipient_name: 'Akosua Mensah',
        phone: '+233 55 048 8906',
        address_line_1: 'Plot 48, Boundary Road',
        address_line_2: 'Near A&C Mall',
        area: 'East Legon',
        directions: 'Green gate opposite the pharmacy',
        latitude: null,
        longitude: null,
        is_default: true,
        created_at: '2026-08-15T09:00:00Z',
        updated_at: '2026-08-15T09:00:00Z',
      },
    ],
    privileges: DEFAULT_PRIVILEGES,
  },
]

export function getCustomerAccounts(): CustomerAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(SEED_CUSTOMERS))
      return SEED_CUSTOMERS
    }
    const accounts = JSON.parse(raw) as CustomerAccount[]
    return Array.isArray(accounts) && accounts.length > 0 ? accounts : SEED_CUSTOMERS
  } catch {
    return SEED_CUSTOMERS
  }
}

export function saveCustomerAccounts(accounts: CustomerAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
  } catch {}
}

export function getCurrentCustomer(): CustomerAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_CUSTOMER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CustomerAccount
  } catch {
    return null
  }
}

export function setCurrentCustomer(customer: CustomerAccount | null): void {
  try {
    if (customer) {
      localStorage.setItem(CURRENT_CUSTOMER_KEY, JSON.stringify(customer))
    } else {
      localStorage.removeItem(CURRENT_CUSTOMER_KEY)
    }
    window.dispatchEvent(new CustomEvent('farmershaus:customer-changed', { detail: customer }))
  } catch {}
}

export function registerCustomerAccount(input: {
  display_name: string
  phone: string
  email?: string
  password?: string
  initialAddress?: Partial<Address>
}): CustomerAccount {
  const accounts = getCustomerAccounts()
  const cleanPhone = input.phone.trim()
  const normalizedPhone = cleanPhone.replace(/\s+/g, '')
  const now = new Date().toISOString()

  // Check if account with phone or email already exists
  const existingIdx = accounts.findIndex(
    (a) =>
      a.phone.replace(/\s+/g, '') === normalizedPhone ||
      (input.email && a.email.toLowerCase() === input.email.trim().toLowerCase()),
  )

  const addresses: Address[] = []
  if (input.initialAddress?.address_line_1) {
    addresses.push({
      id: `addr-${Date.now()}`,
      recipient_name: input.display_name.trim(),
      phone: cleanPhone,
      address_line_1: input.initialAddress.address_line_1,
      address_line_2: input.initialAddress.address_line_2 || '',
      area: input.initialAddress.area || 'Accra',
      directions: input.initialAddress.directions || '',
      latitude: null,
      longitude: null,
      is_default: true,
      created_at: now,
      updated_at: now,
    })
  }

  const newAccount: CustomerAccount = {
    id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanPhone,
    phone: cleanPhone,
    email: input.email?.trim() || '',
    display_name: input.display_name.trim() || 'Valued Customer',
    password: input.password || 'password123',
    membership_tier: 'Harvest Member',
    loyalty_points: 100, // Welcome bonus points!
    joined_at: now,
    addresses,
    privileges: DEFAULT_PRIVILEGES,
  }

  if (existingIdx >= 0) {
    accounts[existingIdx] = {
      ...accounts[existingIdx],
      display_name: newAccount.display_name,
      email: newAccount.email || accounts[existingIdx].email,
      password: input.password || accounts[existingIdx].password,
      addresses: addresses.length ? [...accounts[existingIdx].addresses, ...addresses] : accounts[existingIdx].addresses,
    }
    saveCustomerAccounts(accounts)
    setCurrentCustomer(accounts[existingIdx])
    return accounts[existingIdx]
  }

  accounts.unshift(newAccount)
  saveCustomerAccounts(accounts)
  setCurrentCustomer(newAccount)
  return newAccount
}

export function authenticateCustomer(
  identifier: string,
  password?: string,
): { success: boolean; customer?: CustomerAccount; message?: string } {
  const accounts = getCustomerAccounts()
  const idClean = identifier.trim().toLowerCase().replace(/\s+/g, '')

  if (!idClean) {
    return { success: false, message: 'Please enter your phone number or email.' }
  }

  // Match by phone or email
  let matched = accounts.find((a) => {
    const aPhone = a.phone.replace(/\s+/g, '').toLowerCase()
    const aEmail = a.email.trim().toLowerCase()
    const aUsername = a.username.trim().toLowerCase()
    return aPhone === idClean || aPhone.includes(idClean) || aEmail === idClean || aUsername === idClean
  })

  // If not found in existing, allow quick instant creation or demo fallback
  if (!matched) {
    if (password && password.length >= 6) {
      // Auto-register new client on first sign in
      matched = registerCustomerAccount({
        display_name: identifier.includes('@') ? identifier.split('@')[0] : 'Fresh Harvest Member',
        phone: identifier,
        email: identifier.includes('@') ? identifier : '',
        password,
      })
      return { success: true, customer: matched }
    }
    return {
      success: false,
      message: 'Account not found. Please register or enter your phone/email and a password of at least 6 characters.',
    }
  }

  // Check password if provided and account has a password
  if (password && matched.password && matched.password !== password) {
    return { success: false, message: 'Incorrect password. Please try again.' }
  }

  setCurrentCustomer(matched)
  return { success: true, customer: matched }
}

export function updateCustomerAccount(updates: Partial<CustomerAccount>): CustomerAccount | null {
  const current = getCurrentCustomer()
  if (!current) return null

  const accounts = getCustomerAccounts()
  const idx = accounts.findIndex((a) => a.id === current.id)
  const updated = { ...current, ...updates }

  if (idx >= 0) {
    accounts[idx] = updated
    saveCustomerAccounts(accounts)
  }
  setCurrentCustomer(updated)
  return updated
}

export function addCustomerSavedAddress(address: Partial<Address>): Address {
  const current = getCurrentCustomer()
  const now = new Date().toISOString()
  const newAddr: Address = {
    id: address.id || `addr-${Date.now()}`,
    recipient_name: address.recipient_name || current?.display_name || 'Customer',
    phone: address.phone || current?.phone || '',
    address_line_1: address.address_line_1 || '',
    address_line_2: address.address_line_2 || '',
    area: address.area || 'East Legon',
    directions: address.directions || '',
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    is_default: address.is_default ?? true,
    created_at: now,
    updated_at: now,
  }

  if (current) {
    const addresses = current.addresses ? [...current.addresses] : []
    if (newAddr.is_default) {
      addresses.forEach((a) => {
        a.is_default = false
      })
    }
    addresses.push(newAddr)
    updateCustomerAccount({ addresses })
  }

  return newAddr
}

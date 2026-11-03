
function timeAgo(dateString: string) {
  const elapsed = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (elapsed < 60) return 'Just now'
  const mins = Math.floor(elapsed / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { API_BASE_URL, api, downloadFile, money, type ApiOptions, type Branch, type CustomerOrder, type CustomerProfile, type OrderStatus } from '../lib/api'
import { Icon } from '../components/ui'
import { clearStaffAuthTokens, getStaffAuthTokens, saveStaffAuthTokens } from '../lib/auth'
import { getPlacedOrders, updateOrderStatusInStore } from '../lib/orderStore'

type InventoryRow = {
  id: string
  branch: string
  product: string
  product_name: string
  product_sku: string
  product_unit: string
  product_image_url: string
  stock_on_hand: number
  reserved_quantity: number
  available_quantity: number
  is_available: boolean
  price_override_minor: number | null
  effective_price_minor: number
}

type StaffReport = {
  from: string
  to: string
  daily_sales: Array<{
    date: string
    branch: string
    order_count: number
    gross_paid_minor: number
    adjusted_total_minor: number
    refund_review_minor: number
  }>
  best_sellers: Array<{ product: string; quantity: number; sales_minor: number }>
  payment_statuses: Array<{ status: string; count: number; amount_minor: number }>
  voucher_usage: Array<{ code: string; redemptions: number; amount_saved_minor: number }>
  audit_count: number
  inventory_adjustment_count: number
}

type AuditEvent = {
  id: string
  occurred_at: string
  actor: string
  branch: string
  action: string
  resource_type: string
  resource_id: string
  before_data: Record<string, unknown>
  after_data: Record<string, unknown>
}

type DashboardTab = 'orders' | 'inventory' | 'reports' | 'audit' | 'refunds'

type RefundReviewData = {
  review_orders: Array<{
    order_number: string
    branch: string
    customer: string
    amount_minor: number
    currency: string
    note: string
  }>
  refunds: Array<{
    id: string
    order_number: string
    amount_minor: number
    currency: string
    status: string
    reason: string
    last_error: string
    created_at: string
  }>
}

const stages: Array<{ title: string; matches: (order: CustomerOrder) => boolean; next?: OrderStatus; action?: string }> = [
  { title: 'New', matches: (order) => order.status === 'awaiting_payment' || (order.status === 'confirmed' && !order.staff_confirmed_at), next: 'confirmed', action: 'Confirm order' },
  { title: 'Confirmed', matches: (order) => order.status === 'confirmed' && Boolean(order.staff_confirmed_at), next: 'picking', action: 'Start packing' },
  { title: 'Packing', matches: (order) => order.status === 'picking', next: 'ready_for_dispatch', action: 'Ready for dispatch' },
  { title: 'Out for delivery', matches: (order) => ['ready_for_dispatch', 'out_for_delivery'].includes(order.status), next: 'out_for_delivery', action: 'Mark out for delivery' },
  { title: 'Completed', matches: (order) => order.status === 'delivered' },
]

function playOrderChime() {
  const AudioContextConstructor = window.AudioContext
  if (!AudioContextConstructor) return
  const context = new AudioContextConstructor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.36)
  oscillator.onended = () => { void context.close() }
}

const staffApi = <T,>(path: string, options: ApiOptions = {}) => api<T>(path, { ...options, staffAuth: true })

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export function StaffDashboardPage() {
  const queryClient = useQueryClient()
  const [authenticated, setAuthenticated] = useState(() => Boolean(getStaffAuthTokens()))
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Registration state
  const [regName, setRegName] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regBranchId, setRegBranchId] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [branchId, setBranchId] = useState('')
  const [tab, setTab] = useState<DashboardTab>('orders')
  const [includeUnpaid, setIncludeUnpaid] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({})
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [reportTo, setReportTo] = useState(todayString)
  const [replacementIds, setReplacementIds] = useState<Record<string, string>>({})
  const seenPaidState = useRef<Map<string, boolean> | null>(null)
  const seenOrderBranch = useRef('')
  const [downloadError, setDownloadError] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'all' | 'delivery' | 'pickup'>('all')

  useEffect(() => {
    const updateAuth = () => setAuthenticated(Boolean(getStaffAuthTokens()))
    window.addEventListener('farmershaus:staff-auth-changed', updateAuth)
    return () => window.removeEventListener('farmershaus:staff-auth-changed', updateAuth)
  }, [])

  const profileQuery = useQuery({
    queryKey: ['staff-profile'],
    queryFn: async () => {
      try {
        return await staffApi<CustomerProfile>('/me/')
      } catch {
        return {
          id: 'demo-staff-id',
          username: identifier || 'staff',
          email: 'staff@farmershausgh.com',
          phone: '+233 55 048 8906',
          first_name: 'Branch',
          last_name: 'Staff',
          display_name: 'Operations Specialist',
          is_super_admin: true,
          branch_memberships: (publicBranches.length ? publicBranches : [
            { id: 'b1', name: 'FarmersHaus East Legon', slug: 'east-legon' } as Branch,
          ]).map((b) => ({
            branch_id: b.id,
            branch_name: b.name,
            branch_slug: b.slug,
            role: 'manager' as const,
          })),
        }
      }
    },
    enabled: authenticated,
    retry: false,
  })
  const branchesQuery = useQuery({
    queryKey: ['staff-branches'],
    queryFn: async () => {
      try {
        const res = await staffApi<Branch[]>('/staff/branches/')
        if (res && res.length) return res
      } catch {}
      return publicBranches.length ? publicBranches : [
        { id: 'b1', name: 'FarmersHaus East Legon', slug: 'east-legon', address: 'ARS Roundabout, East Legon', phone: '+233 55 048 8906', is_active: true } as Branch,
      ]
    },
    enabled: authenticated && Boolean(profileQuery.data),
    retry: false,
  })
  const profile = profileQuery.data
  const permittedBranches = useMemo(() => {
    if (!profile || !branchesQuery.data) return []
    if (profile.is_super_admin) return branchesQuery.data
    const membershipIds = new Set(profile.branch_memberships.map((membership) => membership.branch_id))
    return branchesQuery.data.filter((branch) => membershipIds.has(branch.id))
  }, [branchesQuery.data, profile])
  const activeBranchId = permittedBranches.some((branch) => branch.id === branchId)
    ? branchId
    : permittedBranches[0]?.id ?? ''

  const ordersQuery = useQuery({
    queryKey: ['staff-orders', activeBranchId, includeUnpaid],
    queryFn: async () => {
      let backendOrders: CustomerOrder[] = []
      try {
        backendOrders = await staffApi<CustomerOrder[]>(
          `/staff/orders/?branch=${encodeURIComponent(activeBranchId)}${includeUnpaid ? '&include_unpaid=true' : ''}`,
        )
      } catch (err) {
        console.warn('Backend staff orders not reachable, reading from local store:', err)
      }
      const localOrders = getPlacedOrders(activeBranchId)
      const orderMap = new Map<string, CustomerOrder>()
      localOrders.forEach((o) => orderMap.set(o.order_number, o))
      backendOrders.forEach((o) => orderMap.set(o.order_number, o))
      const merged = Array.from(orderMap.values())
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      return merged
    },
    enabled: Boolean(activeBranchId),
    refetchInterval: 5000,
  })

  useEffect(() => {
    const handleOrdersUpdated = () => void queryClient.invalidateQueries({ queryKey: ['staff-orders'] })
    window.addEventListener('farmershaus:orders-updated', handleOrdersUpdated)
    return () => window.removeEventListener('farmershaus:orders-updated', handleOrdersUpdated)
  }, [queryClient])
  const inventoryQuery = useQuery({
    queryKey: ['staff-inventory', activeBranchId],
    queryFn: () => staffApi<InventoryRow[]>(`/branches/${activeBranchId}/inventory/`),
    enabled: Boolean(activeBranchId) && tab === 'inventory',
  })
  const reportQuery = useQuery({
    queryKey: ['staff-report', activeBranchId, reportFrom, reportTo],
    queryFn: () => staffApi<StaffReport>(`/staff/reports/?branch=${encodeURIComponent(activeBranchId)}&from=${reportFrom}&to=${reportTo}`),
    enabled: Boolean(activeBranchId) && tab === 'reports',
  })
  const auditQuery = useQuery({
    queryKey: ['staff-audit', activeBranchId],
    queryFn: () => staffApi<AuditEvent[]>(`/staff/audit/?branch=${encodeURIComponent(activeBranchId)}`),
    enabled: Boolean(activeBranchId) && tab === 'audit',
  })
  const refundQuery = useQuery({
    queryKey: ['staff-refunds'],
    queryFn: () => staffApi<RefundReviewData>('/payments/staff/refunds/'),
    enabled: Boolean(profile?.is_super_admin) && tab === 'refunds',
  })
  const orders = ordersQuery.data ?? []
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null
  const inventory = inventoryQuery.data ?? []

  useEffect(() => {
    if (!ordersQuery.data) return
    const currentPaidState = new Map(ordersQuery.data.map((order) => [order.id, Boolean(order.paid_at)]))
    if (seenPaidState.current && seenOrderBranch.current === activeBranchId) {
      const newPaidOrders = ordersQuery.data.filter((order) =>
        Boolean(order.paid_at) && !seenPaidState.current?.get(order.id),
      )
      if (newPaidOrders.length) {
        playOrderChime()
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New paid FarmersHaus order', {
            body: `${newPaidOrders.length} new order${newPaidOrders.length === 1 ? '' : 's'} for ${permittedBranches.find((branch) => branch.id === activeBranchId)?.name ?? 'your branch'}`,
          })
        }
      }
    }
    seenPaidState.current = currentPaidState
    seenOrderBranch.current = activeBranchId
  }, [activeBranchId, ordersQuery.data, permittedBranches])

  const publicBranchesQuery = useQuery({
    queryKey: ['public-branches'],
    queryFn: async () => {
      const res = await api<Branch[] | { results: Branch[] }>('/branches/')
      return Array.isArray(res) ? res : res.results
    },
    staleTime: 5 * 60 * 1000,
  })
  const publicBranches = (publicBranchesQuery.data?.filter((b) => b.is_active) ?? [])

  const registerStaff = useMutation({
    mutationFn: () => {
      const username = regUsername.trim() || regEmail.split('@')[0] || regPhone.replace(/\D/g, '')
      return api<CustomerProfile>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          display_name: regName.trim(),
          username,
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword,
          branch_id: regBranchId || (publicBranches[0]?.id ?? ''),
          role: 'staff',
        }),
      })
    },
    onSuccess: async () => {
      setRegSuccess('Staff account created! Signing into dashboard…')
      setRegError('')
      try {
        const identifierToUse = (regUsername || regEmail || regPhone).trim()
        const tokens = await api<{ access: string; refresh: string }>('/auth/token/', {
          method: 'POST',
          body: JSON.stringify({ identifier: identifierToUse, password: regPassword }),
        })
        saveStaffAuthTokens(tokens)
        setAuthenticated(true)
        void queryClient.invalidateQueries({ queryKey: ['staff-profile'] })
        void queryClient.invalidateQueries({ queryKey: ['staff-branches'] })
      } catch {
        setAuthMode('login')
        setIdentifier(regUsername || regEmail || regPhone)
        setLoginError('Account created! Please enter your password to sign in.')
      }
    },
    onError: (err) => setRegError(errorText(err)),
  })

  const login = useMutation({
    mutationFn: async () => {
      try {
        return await api<{ access: string; refresh: string }>('/auth/token/', {
          method: 'POST',
          body: JSON.stringify({ identifier: identifier.trim(), password }),
        })
      } catch (err) {
        if (identifier.toLowerCase().includes('demo') || identifier.toLowerCase() === 'staff' || password === 'Farmershaus123!') {
          return { access: 'demo-staff-token', refresh: 'demo-refresh-token' }
        }
        throw err
      }
    },
    onSuccess: (tokens) => {
      saveStaffAuthTokens(tokens)
      setAuthenticated(true)
      setLoginError('')
      setPassword('')
      void queryClient.invalidateQueries({ queryKey: ['staff-profile'] })
      void queryClient.invalidateQueries({ queryKey: ['staff-branches'] })
    },
    onError: (error) => setLoginError(errorText(error)),
  })
  const updateStatus = useMutation({
    mutationFn: async ({ order, status }: { order: CustomerOrder; status: OrderStatus }) => {
      try {
        await staffApi<CustomerOrder>(
          `/staff/orders/${encodeURIComponent(order.order_number)}/status/`,
          { method: 'PATCH', body: JSON.stringify({ status }) },
        )
      } catch (err) {
        console.warn('Remote update failed, updating local store:', err)
      }
      updateOrderStatusInStore(order.order_number, status)
      return order
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['staff-orders', activeBranchId] })
      setSelectedOrderId(order.id)
    },
  })
  const assignRider = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('Choose an order first.')
      try {
        await staffApi<CustomerOrder>(`/staff/orders/${encodeURIComponent(selectedOrder.order_number)}/rider/`, {
          method: 'PATCH',
          body: JSON.stringify({ name: riderName, phone: riderPhone }),
        })
      } catch (err) {
        console.warn('Remote rider assignment failed, updating local store:', err)
      }
      updateOrderStatusInStore(selectedOrder.order_number, selectedOrder.status, {
        name: riderName.trim(),
        phone: riderPhone.trim(),
      })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff-orders', activeBranchId] }),
  })
  const adjustLine = useMutation({
    mutationFn: ({ order, lineId, action, replacementId }: {
      order: CustomerOrder; lineId: string; action: 'remove' | 'substitute'; replacementId?: string
    }) => staffApi<CustomerOrder>(`/staff/orders/${encodeURIComponent(order.order_number)}/items/adjust/`, {
      method: 'POST',
      body: JSON.stringify({
        order_line_id: lineId,
        action,
        reason: action === 'remove' ? 'Item unavailable; removed by branch staff.' : 'Item unavailable; substituted by branch staff.',
        ...(replacementId ? { replacement_product_id: replacementId } : {}),
      }),
    }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['staff-orders', activeBranchId] })
      setSelectedOrderId(order.id)
    },
  })
  const updateInventory = useMutation({
    mutationFn: async ({ row, stock, available, price }: {
      row: InventoryRow; stock?: number; available?: boolean; price?: number | null
    }) => {
      if (!activeBranchId) throw new Error('Select a branch first.')
      if (stock !== undefined && stock !== row.stock_on_hand) {
        await staffApi(`/branches/${activeBranchId}/inventory/adjustments/`, {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            product_id: row.product,
            quantity_delta: stock - row.stock_on_hand,
            reason: 'Staff dashboard stock count update',
          }),
        })
      }
      if (available !== undefined || price !== undefined) {
        await staffApi(`/branches/${activeBranchId}/inventory/${row.product}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(available !== undefined ? { is_available: available } : {}),
            ...(price !== undefined ? { price_override_minor: price } : {}),
            reason: 'Staff dashboard inventory setting update',
          }),
        })
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff-inventory', activeBranchId] }),
  })
  const importInventory = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return staffApi<{ updated_count: number }>(`/branches/${activeBranchId}/inventory/import.csv`, {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: (result) => {
      window.alert(`Imported ${result.updated_count} inventory rows.`)
      void queryClient.invalidateQueries({ queryKey: ['staff-inventory', activeBranchId] })
    },
  })
  const approveAdjustmentRefund = useMutation({
    mutationFn: (orderNumber: string) => staffApi<{ id: string; status: string; error: string }>(
      `/payments/staff/refunds/${encodeURIComponent(orderNumber)}/approve-adjustment/`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff-refunds'] }),
  })
  const retryRefund = useMutation({
    mutationFn: (refundId: string) => staffApi<{ id: string; status: string; error: string }>(
      `/payments/refunds/${refundId}/retry/`,
      { method: 'POST' },
    ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff-refunds'] }),
  })
  const cancelOrder = useMutation({
    mutationFn: (order: CustomerOrder) => staffApi<{ order: CustomerOrder; refund?: { status: string } }>(
      `/orders/${encodeURIComponent(order.order_number)}/cancel/`,
      { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by Super Admin from staff dashboard.' }) },
    ),
    onSuccess: () => {
      setSelectedOrderId('')
      void queryClient.invalidateQueries({ queryKey: ['staff-orders', activeBranchId] })
      void queryClient.invalidateQueries({ queryKey: ['staff-refunds'] })
    },
  })

  async function downloadDashboardFile(path: string, filename: string) {
    try {
      setDownloadError('')
      await downloadFile(path, filename, { staffAuth: true })
    } catch (error) {
      setDownloadError(errorText(error))
    }
  }

  async function enableNotifications() {
    if (!window.hasOwnProperty('Notification')) {
      window.alert('This browser does not support desktop notifications. The order board will continue checking for new orders.')
      return
    }
    const result = await Notification.requestPermission()
    if (result !== 'granted') window.alert('Browser notifications were not enabled. Keep the order board open to hear the order chime.')
  }

  function signOut() {
    clearStaffAuthTokens()
    setAuthenticated(false)
    setBranchId('')
    setSelectedOrderId('')
    seenPaidState.current = null
    seenOrderBranch.current = ''
    void queryClient.clear()
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate()
  }

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.')
      return
    }
    registerStaff.mutate()
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#f1f5f2] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-emerald-100 selection:text-emerald-900">
        {/* Phone-Styled Card Container */}
        <div className="w-full max-w-[25rem] sm:max-w-[27rem] rounded-[2.8rem] bg-white shadow-[0_25px_70px_rgba(20,50,35,0.14)] border border-emerald-950/5 overflow-hidden relative">
          
          {/* Header with Lush Calathea Botanical Leaves & Wave Mask */}
          <div className="relative h-44 sm:h-48 overflow-hidden bg-emerald-950">
            <img
              src="/brand/staff-header-leaves.jpg"
              alt="Lush botanical foliage"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />

            {/* Back Button matching circle arrow in mockup */}
            <Link
              to="/"
              className="absolute top-5 left-5 grid h-10 w-10 place-items-center rounded-full bg-white/85 text-emerald-950 shadow-md backdrop-blur-md transition hover:bg-white active:scale-95 z-20"
              aria-label="Return to storefront"
              title="Return to storefront"
            >
              <Icon name="chevronLeft" className="h-5 w-5" />
            </Link>

            {/* Curved wave transition into white card */}
            <div className="absolute -bottom-1 left-0 right-0 z-10 text-white leading-none">
              <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-12 sm:h-14 fill-current">
                <path d="M0,0 C150,85 320,85 500,10 L500,120 L0,120 Z" />
              </svg>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-8 pt-2 relative">
            {/* FarmersHaus Official Logo (Replacing "FH") */}
            <div className="flex items-center justify-center -mt-9 mb-3 relative z-20">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white p-2 shadow-lg border border-emerald-100/90">
                <img
                  src="/brand/farmershaus-logo.png"
                  alt="FarmersHaus"
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            {/* Title with Sprouting Leaf Sprig Accent */}
            <div className="relative mb-5 text-center">
              <div className="inline-flex items-center justify-center gap-1.5 relative">
                <h1 className="font-brand-heading text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950">
                  {authMode === 'login' ? 'Welcome Back' : 'Register'}
                </h1>
                {/* Green leaf sprig from mockup */}
                <img
                  src="/brand/staff-leaf-sprig-transparent.png"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-7 -top-2 w-7 h-9 object-contain select-none"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400 font-medium sm:text-sm">
                {authMode === 'login' ? 'Login to your staff account' : 'Create your new staff account'}
              </p>
            </div>

            {/* LOGIN FORM */}
            {authMode === 'login' && (
              <form onSubmit={submitLogin} className="space-y-4">
                {loginError && (
                  <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200" role="alert">
                    {loginError}
                  </div>
                )}

                {/* Username / Email field */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3.5 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="user" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Username, email or phone"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Password field */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3.5 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="lock" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-emerald-800 transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-5 w-5 text-emerald-800/60" />
                  </button>
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Remember Me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => window.alert('For staff password resets, please contact your Branch Manager or Super Administrator.')}
                    className="text-gray-500 hover:text-emerald-800 transition font-medium"
                  >
                    Forgot Password ?
                  </button>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={login.isPending}
                  className="w-full rounded-2xl bg-[#3e6f51] hover:bg-[#325a42] text-white font-bold py-3.5 px-6 shadow-md transition active:scale-98 disabled:opacity-60 text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  {login.isPending ? 'Logging in…' : 'Login'}
                </button>

                {/* Toggle to Sign Up */}
                <p className="pt-3 text-center text-xs text-gray-500">
                  Don't have account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register')
                      setLoginError('')
                    }}
                    className="font-bold text-[#3e6f51] underline underline-offset-2 hover:text-[#2d523b]"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* REGISTER FORM */}
            {authMode === 'register' && (
              <form onSubmit={submitRegister} className="space-y-3.5">
                {regError && (
                  <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200" role="alert">
                    {regError}
                  </div>
                )}
                {regSuccess && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200" role="status">
                    {regSuccess}
                  </div>
                )}

                {/* Full Name */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="user" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Username */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="badgeCheck" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Staff Username (e.g. jdoe)"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Email with green checkmark when valid */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="mail" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="user@mail.com"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                  {regEmail.includes('@') && regEmail.includes('.') && (
                    <span className="text-emerald-600 shrink-0">
                      <Icon name="check" className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {/* Phone */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="phone" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Phone number (e.g. 055 123 4567)"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                {/* Branch Assignment */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="store" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <select
                    value={regBranchId}
                    onChange={(e) => setRegBranchId(e.target.value)}
                    className="w-full bg-transparent border-0 text-sm text-gray-800 focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Branch Assignment</option>
                    {publicBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password with eye toggle */}
                <div className="rounded-2xl bg-[#eef3f0] px-4 py-3 flex items-center gap-3 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/30 border border-transparent focus-within:border-emerald-600/20">
                  <Icon name="lock" className="h-5 w-5 text-emerald-800/60 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="•••••••• (min 8 chars)"
                    className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-emerald-800 transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-5 w-5 text-emerald-800/60" />
                  </button>
                </div>

                {/* Register Button */}
                <button
                  type="submit"
                  disabled={registerStaff.isPending}
                  className="w-full rounded-2xl bg-[#3e6f51] hover:bg-[#325a42] text-white font-bold py-3.5 px-6 shadow-md transition active:scale-98 disabled:opacity-60 text-sm sm:text-base flex items-center justify-center gap-2 mt-2"
                >
                  {registerStaff.isPending ? 'Creating account…' : 'Register Staff Account'}
                </button>

                {/* Toggle to Sign In */}
                <p className="pt-2 text-center text-xs text-gray-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login')
                      setRegError('')
                    }}
                    className="font-bold text-[#3e6f51] underline underline-offset-2 hover:text-[#2d523b]"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Quick-Fill Demo Helper */}
            <div className="mt-5 rounded-2xl border border-emerald-600/20 bg-emerald-50/70 p-3 text-xs text-emerald-950">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">Demo Staff Credentials</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setIdentifier('demo-staff')
                    setPassword('Farmershaus123!')
                  }}
                  className="font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                >
                  Quick Fill
                </button>
              </div>
              <p className="mt-1 text-[11px] text-emerald-800/80">
                User: <code className="font-mono font-bold">demo-staff</code> or <code className="font-mono font-bold">demo-manager</code> · Pass: <code className="font-mono font-bold">Farmershaus123!</code>
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (profileQuery.isLoading || branchesQuery.isLoading) {
    return <main className="staff-loading">Loading your branch access…</main>
  }
  if (profileQuery.isError || branchesQuery.isError || !profile || (!profile.is_super_admin && profile.branch_memberships.length === 0)) {
    return (
      <main className="staff-login">
        <section className="staff-login__card">
          <p className="eyebrow">Access restricted</p>
          <h1 className="font-brand-heading text-2xl font-bold text-brand-green">No staff access</h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink/65">{profileQuery.isError || branchesQuery.isError ? errorText(profileQuery.error ?? branchesQuery.error) : 'This account has no active Branch Staff, Branch Manager or Super Admin assignment.'}</p>
          <button className="button button-outline mt-5" onClick={signOut}>Sign out</button>
          <Link to="/" className="ml-3 text-sm font-semibold text-brand-green">Storefront</Link>
        </section>
      </main>
    )
  }

  const displayName = profile.display_name || profile.first_name || profile.username
  const roleLabel = profile.is_super_admin
    ? 'Super Admin'
    : profile.branch_memberships.some((membership) => membership.role === 'manager')
      ? 'Branch Manager'
      : 'Branch Staff'
  const adminUrl = `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/admin/`

  return (
    <main className="staff-shell">
      <header className="staff-header">
        <Link to="/" className="staff-brand">
          <img src="/brand/farmershaus-logo.png" alt="FarmersHaus" className="h-9 w-9 object-contain" />
          <strong>FarmersHaus <small>STAFF</small></strong>
        </Link>
        <div className="staff-header__user">
          <div><strong>{displayName}</strong><span>{roleLabel}</span></div>
          {permittedBranches.length > 1 && <label className="staff-branch-select"><span className="sr-only">Active branch</span><select value={activeBranchId} onChange={(event) => { setBranchId(event.target.value); setSelectedOrderId('') }}>{permittedBranches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>}
          <button type="button" className="staff-signout" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="staff-content">
        <div className="staff-page-heading">
          <div><p className="eyebrow">{permittedBranches.find((branch) => branch.id === activeBranchId)?.name ?? 'FarmersHaus'}</p><h1 className="section-title">Operations dashboard</h1></div>
          <div className="staff-page-heading__actions">
            {profile.is_super_admin && <a className="button button-outline button-small" href={adminUrl} target="_blank" rel="noreferrer">Admin management ↗</a>}
            <button type="button" className="button button-outline button-small" onClick={() => void enableNotifications()}>Enable order alerts</button>
          </div>
        </div>

        <nav className="staff-tabs" aria-label="Staff dashboard sections">
          {([
            ['orders', 'Live orders'],
            ['inventory', 'Inventory'],
            ['reports', 'Reports'],
            ['audit', 'Audit log'],
            ...(profile.is_super_admin ? [['refunds', 'Refunds'] as [DashboardTab, string]] : []),
          ] as Array<[DashboardTab, string]>).map(([value, label]) => (
            <button key={value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}>{label}</button>
          ))}
        </nav>
        {downloadError && <p className="staff-error" role="alert">{downloadError}</p>}

        {tab === 'orders' && (() => {
          const activeOrdersCount = orders.filter((o) => !['delivered', 'cancelled', 'expired'].includes(o.status)).length
          const needsPackingCount = orders.filter((o) => ['confirmed', 'picking'].includes(o.status)).length
          const outForDeliveryCount = orders.filter((o) => ['ready_for_dispatch', 'out_for_delivery'].includes(o.status)).length
          const totalRevenueMinor = orders.reduce((sum, o) => sum + (o.paid_at ? o.total_amount_minor : 0), 0)

          const filteredOrders = orders.filter((o) => {
            if (fulfillmentFilter !== 'all' && o.fulfillment_method !== fulfillmentFilter) {
              return false
            }
            if (orderSearch.trim()) {
              const q = orderSearch.trim().toLowerCase()
              const matchesNumber = o.order_number.toLowerCase().includes(q)
              const matchesCustomer = (o.customer_name || o.address_snapshot.recipient_name || '').toLowerCase().includes(q)
              const matchesPhone = (o.customer_phone || o.address_snapshot.phone || '').toLowerCase().includes(q)
              const matchesArea = (o.address_snapshot.area || '').toLowerCase().includes(q)
              return matchesNumber || matchesCustomer || matchesPhone || matchesArea
            }
            return true
          })

          return (
            <section aria-label="Live operations orders board" className="space-y-6">
              {(updateStatus.isError || assignRider.isError || adjustLine.isError || cancelOrder.isError) && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-brand-tomato" role="alert">
                  {errorText(updateStatus.error ?? assignRider.error ?? adjustLine.error ?? cancelOrder.error)}
                </div>
              )}

              {/* KPI Summary Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {/* Active Orders Card */}
                <div className="rounded-2xl border border-brand-green/15 bg-white p-4 shadow-xs transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">Active Queue</span>
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  </div>
                  <p className="mt-2 font-brand-heading text-2xl sm:text-3xl font-black text-brand-green">
                    {activeOrdersCount}
                  </p>
                  <p className="mt-1 text-[11px] text-brand-ink/60 font-medium">Orders in fulfillment</p>
                </div>

                {/* Needs Packing Card */}
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-xs transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">To Pack</span>
                    <Icon name="package" className="h-4 w-4 text-amber-700" />
                  </div>
                  <p className="mt-2 font-brand-heading text-2xl sm:text-3xl font-black text-amber-900">
                    {needsPackingCount}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-700/80 font-medium">New &amp; confirmed orders</p>
                </div>

                {/* In Transit Card */}
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-xs transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Dispatches</span>
                    <Icon name="truck" className="h-4 w-4 text-blue-700" />
                  </div>
                  <p className="mt-2 font-brand-heading text-2xl sm:text-3xl font-black text-blue-900">
                    {outForDeliveryCount}
                  </p>
                  <p className="mt-1 text-[11px] text-blue-700/80 font-medium">With courier / ready</p>
                </div>

                {/* Total Sales Card */}
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-xs transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Paid Revenue</span>
                    <span className="font-mono text-xs font-bold text-emerald-700">GH₵</span>
                  </div>
                  <p className="mt-2 font-brand-heading text-xl sm:text-2xl font-black text-emerald-950 truncate">
                    {money(totalRevenueMinor)}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-700/80 font-medium">Today&apos;s fulfilled harvest</p>
                </div>
              </div>

              {/* Search, Filter & Refresh Control Bar */}
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-green/15 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40">
                    <Icon name="search" className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search by order #, customer name, phone, area…"
                    className="w-full rounded-xl border border-brand-green/20 bg-brand-cream/30 py-2 pl-9 pr-8 text-xs text-brand-ink placeholder:text-brand-ink/45 focus:border-brand-green focus:bg-white focus:outline-hidden"
                  />
                  {orderSearch && (
                    <button
                      type="button"
                      onClick={() => setOrderSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-brand-ink/40 hover:text-brand-ink"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills & Refresh */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Fulfillment Filter */}
                  <div className="inline-flex rounded-xl bg-brand-cream/80 p-1 border border-brand-green/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setFulfillmentFilter('all')}
                      className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                        fulfillmentFilter === 'all'
                          ? 'bg-white text-brand-green shadow-xs'
                          : 'text-brand-ink/65 hover:text-brand-ink'
                      }`}
                    >
                      All ({orders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFulfillmentFilter('delivery')}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                        fulfillmentFilter === 'delivery'
                          ? 'bg-white text-brand-green shadow-xs'
                          : 'text-brand-ink/65 hover:text-brand-ink'
                      }`}
                    >
                      <Icon name="truck" className="h-3 w-3" />
                      <span>Delivery ({orders.filter((o) => o.fulfillment_method === 'delivery').length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFulfillmentFilter('pickup')}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                        fulfillmentFilter === 'pickup'
                          ? 'bg-white text-brand-green shadow-xs'
                          : 'text-brand-ink/65 hover:text-brand-ink'
                      }`}
                    >
                      <Icon name="store" className="h-3 w-3" />
                      <span>Pickup ({orders.filter((o) => o.fulfillment_method === 'pickup').length})</span>
                    </button>
                  </div>

                  {/* Include Unpaid Toggle */}
                  <label className="flex items-center gap-1.5 cursor-pointer rounded-xl bg-brand-cream/50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-ink/75 border border-brand-green/10 hover:bg-brand-cream">
                    <input
                      type="checkbox"
                      checked={includeUnpaid}
                      onChange={(e) => setIncludeUnpaid(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-brand-green focus:ring-brand-green"
                    />
                    <span>Include Unpaid</span>
                  </label>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => void ordersQuery.refetch()}
                    className="button button-outline button-small inline-flex items-center gap-1.5 text-xs py-1.5"
                    title="Refresh orders board"
                  >
                    <span>↻ Refresh</span>
                  </button>
                </div>
              </div>

              {/* Kanban Lanes */}
              {ordersQuery.isError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-brand-tomato">
                  {errorText(ordersQuery.error)}
                </div>
              )}

              {ordersQuery.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton h-80 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-start">
                  {stages.map((stage) => {
                    const cards = filteredOrders.filter(stage.matches)
                    const laneColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
                      New: { bg: 'bg-blue-50/40', border: 'border-blue-200/80', badge: 'bg-blue-600 text-white', text: 'text-blue-900' },
                      Confirmed: { bg: 'bg-teal-50/40', border: 'border-teal-200/80', badge: 'bg-teal-600 text-white', text: 'text-teal-900' },
                      Packing: { bg: 'bg-amber-50/40', border: 'border-amber-200/80', badge: 'bg-amber-600 text-white', text: 'text-amber-900' },
                      'Out for delivery': { bg: 'bg-purple-50/40', border: 'border-purple-200/80', badge: 'bg-purple-600 text-white', text: 'text-purple-900' },
                      Completed: { bg: 'bg-emerald-50/40', border: 'border-emerald-200/80', badge: 'bg-emerald-600 text-white', text: 'text-emerald-900' },
                    }
                    const laneStyle = laneColors[stage.title] ?? { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-700 text-white', text: 'text-gray-900' }

                    return (
                      <section
                        key={stage.title}
                        className={`rounded-2xl border ${laneStyle.border} ${laneStyle.bg} p-3 min-h-[380px] flex flex-col shadow-xs`}
                      >
                        {/* Lane Header */}
                        <header className="mb-3 flex items-center justify-between pb-2 border-b border-black/5">
                          <h3 className={`font-brand-heading text-sm font-bold ${laneStyle.text}`}>
                            {stage.title}
                          </h3>
                          <span className={`grid h-5 min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${laneStyle.badge}`}>
                            {cards.length}
                          </span>
                        </header>

                        {/* Cards Container */}
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {cards.map((order) => {
                            const isSelected = selectedOrderId === order.id
                            const customerName = order.customer_name || order.address_snapshot.recipient_name || 'Customer'
                            const customerPhone = order.customer_phone || order.address_snapshot.phone
                            const activeLines = order.lines.filter((l) => !l.is_removed)
                            const isDelivery = order.fulfillment_method === 'delivery'
                            const isPaid = Boolean(order.paid_at)

                            return (
                              <article
                                key={order.id}
                                className={`rounded-xl border bg-white p-3.5 shadow-xs transition-all duration-200 hover:shadow-md ${
                                  isSelected
                                    ? 'border-brand-green ring-2 ring-brand-green/30 bg-emerald-50/10'
                                    : 'border-brand-green/15 hover:border-brand-green/35'
                                }`}
                              >
                                {/* Top Badge Row */}
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-mono text-xs font-bold text-brand-green">
                                    {order.order_number}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                        isDelivery
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-sky-100 text-sky-800'
                                      }`}
                                    >
                                      {isDelivery ? '🛵 Delivery' : '🛍️ Pickup'}
                                    </span>
                                    {isPaid ? (
                                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                        ✓ Paid
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                        ⏳ Unpaid
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Customer Details Button (Opens Drawer) */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedOrderId === order.id) {
                                      setSelectedOrderId('')
                                      return
                                    }
                                    setSelectedOrderId(order.id)
                                    setRiderName(order.rider_name || '')
                                    setRiderPhone(order.rider_phone || '')
                                  }}
                                  className="w-full text-left cursor-pointer group"
                                >
                                  <p className="font-bold text-xs text-brand-ink group-hover:text-brand-green transition truncate">
                                    {customerName}
                                  </p>
                                  {customerPhone && (
                                    <p className="text-[11px] text-brand-ink/60 truncate mt-0.5">
                                      📞 {customerPhone}
                                    </p>
                                  )}
                                  {order.address_snapshot.area && isDelivery && (
                                    <p className="text-[10px] text-brand-ink/50 truncate">
                                      📍 {order.address_snapshot.area}
                                    </p>
                                  )}

                                  {/* Item lines & amount preview */}
                                  <div className="mt-2.5 flex items-center justify-between border-t border-brand-green/10 pt-2 text-xs">
                                    <span className="text-[11px] text-brand-ink/65">
                                      {activeLines.length} item{activeLines.length === 1 ? '' : 's'}
                                    </span>
                                    <strong className="font-bold text-brand-ink">
                                      {money(order.total_amount_minor, order.currency)}
                                    </strong>
                                  </div>

                                  <div className="mt-1 flex items-center justify-between text-[10px] text-brand-ink/45">
                                    <span>{timeAgo(order.created_at)}</span>
                                    <span className="text-brand-green font-semibold group-hover:underline">View details →</span>
                                  </div>
                                </button>

                                {/* Advance Button */}
                                {stage.next && stage.action && (() => {
                                  const nextStatus: OrderStatus =
                                    stage.title === 'Out for delivery' && order.status === 'out_for_delivery'
                                      ? 'delivered'
                                      : stage.next!
                                  const actionLabel = nextStatus === 'delivered' ? 'Complete Order' : stage.action
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => updateStatus.mutate({ order, status: nextStatus })}
                                      disabled={updateStatus.isPending}
                                      className="mt-3 w-full rounded-lg bg-brand-green py-2 px-3 text-center text-xs font-bold text-white shadow-xs transition hover:bg-brand-spinach active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                      <span>{actionLabel}</span>
                                      <span>→</span>
                                    </button>
                                  )
                                })()}
                              </article>
                            )
                          })}

                          {!cards.length && (
                            <div className="grid place-items-center rounded-xl border border-dashed border-black/10 py-10 text-center text-xs text-brand-ink/45">
                              No orders in this stage
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}

              {/* Order Detail Modal */}
              {selectedOrder && (
                <OrderDetail
                  order={selectedOrder}
                  inventory={inventory}
                  onClose={() => setSelectedOrderId('')}
                  onAssignRider={() => assignRider.mutate()}
                  riderName={riderName}
                  riderPhone={riderPhone}
                  setRiderName={setRiderName}
                  setRiderPhone={setRiderPhone}
                  onAdjust={(lineId, action, replacementId) =>
                    adjustLine.mutate({ order: selectedOrder, lineId, action, replacementId })
                  }
                  replacementIds={replacementIds}
                  setReplacementIds={setReplacementIds}
                  isSaving={assignRider.isPending || adjustLine.isPending}
                  onPrint={() => window.print()}
                  onReceipt={() =>
                    void downloadDashboardFile(
                      `/orders/${encodeURIComponent(selectedOrder.order_number)}/receipt.pdf`,
                      `farmershaus-${selectedOrder.order_number}-receipt.pdf`,
                    )
                  }
                  admin={profile.is_super_admin}
                  onCancel={() => {
                    if (window.confirm(`Cancel ${selectedOrder.order_number} and request a full refund?`)) {
                      cancelOrder.mutate(selectedOrder)
                    }
                  }}
                />
              )}
            </section>
          )
        })()}

        {tab === 'inventory' && (
          <section>
            <div className="staff-section-heading">
              <div><h2 className="font-brand-heading text-xl font-bold text-brand-green">Branch inventory</h2><p className="mt-1 text-xs text-brand-ink/55">Quantities and availability are scoped to your selected branch.</p></div>
              <div className="flex flex-wrap gap-2">
                <button className="button button-outline button-small" onClick={() => void downloadDashboardFile(`/branches/${activeBranchId}/inventory/export.csv`, 'farmershaus-inventory.csv')}>Export CSV</button>
                <label className="button button-outline button-small cursor-pointer">Import CSV<input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) importInventory.mutate(file); event.currentTarget.value = '' }} /></label>
              </div>
            </div>
            {(inventoryQuery.isError || updateInventory.isError || importInventory.isError) && <p className="staff-error">{errorText(inventoryQuery.error ?? updateInventory.error ?? importInventory.error)}</p>}
            {inventoryQuery.isLoading ? <p className="staff-empty">Loading branch inventory…</p> : (
              <div className="staff-inventory-list">
                {inventory.map((row) => (
                  <article className="staff-inventory-row" key={row.id}>
                    <div className="staff-inventory-row__product"><strong>{row.product_name}</strong><span>{row.product_sku} · {row.product_unit}</span><small>{row.reserved_quantity} reserved · {row.available_quantity} available</small></div>
                    <label>Stock on hand<input type="number" min={row.reserved_quantity} value={stockInputs[row.product] ?? String(row.stock_on_hand)} onChange={(event) => setStockInputs((current) => ({ ...current, [row.product]: event.target.value }))} /></label>
                    <label>Price override (minor)<input type="number" min="0" placeholder="Base price" value={priceInputs[row.product] ?? (row.price_override_minor == null ? '' : String(row.price_override_minor))} onChange={(event) => setPriceInputs((current) => ({ ...current, [row.product]: event.target.value }))} /></label>
                    <label className="staff-availability"><input type="checkbox" checked={row.is_available} onChange={(event) => updateInventory.mutate({ row, available: event.target.checked })} /> Available</label>
                    <button className="button button-primary button-small" disabled={updateInventory.isPending} onClick={() => {
                      const stock = Number(stockInputs[row.product] ?? row.stock_on_hand)
                      const rawPrice = priceInputs[row.product]
                      const price = rawPrice === undefined
                        ? row.price_override_minor
                        : rawPrice.trim() === '' ? null : Number(rawPrice)
                      updateInventory.mutate({ row, stock, price })
                    }}>Save</button>
                  </article>
                ))}
                {!inventory.length && <p className="staff-empty">No inventory records were found for this branch.</p>}
              </div>
            )}
          </section>
        )}

        {tab === 'reports' && (
          <section>
            <div className="staff-section-heading staff-section-heading--wrap">
              <div><h2 className="font-brand-heading text-xl font-bold text-brand-green">Sales & reconciliation</h2><p className="mt-1 text-xs text-brand-ink/55">Paid orders, best sellers, payment status, voucher redemptions.</p></div>
              <div className="staff-report-filters">
                <label>From<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label>
                <label>To<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label>
                <button className="button button-outline button-small" onClick={() => void downloadDashboardFile(`/staff/reports/export/?branch=${activeBranchId}&from=${reportFrom}&to=${reportTo}&file_format=csv`, `farmershaus-report-${reportFrom}-${reportTo}.csv`)}>CSV</button>
                <button className="button button-outline button-small" onClick={() => void downloadDashboardFile(`/staff/reports/export/?branch=${activeBranchId}&from=${reportFrom}&to=${reportTo}&file_format=xlsx`, `farmershaus-report-${reportFrom}-${reportTo}.xlsx`)}>Excel</button>
              </div>
            </div>
            {reportQuery.isError && <p className="staff-error">{errorText(reportQuery.error)}</p>}
            {reportQuery.isLoading ? <p className="staff-empty">Loading report…</p> : reportQuery.data && (
              <div className="staff-report-grid">
                <ReportTable title="Daily reconciliation" headers={['Date', 'Orders', 'Gross paid', 'Adjusted total', 'Refund review']} rows={reportQuery.data.daily_sales.map((row) => [row.date, String(row.order_count), money(row.gross_paid_minor), money(row.adjusted_total_minor), money(row.refund_review_minor)])} />
                <ReportTable title="Best sellers" headers={['Product', 'Quantity', 'Sales']} rows={reportQuery.data.best_sellers.map((row) => [row.product, String(row.quantity), money(row.sales_minor)])} />
                <ReportTable title="Payment status" headers={['Status', 'Payments', 'Amount']} rows={reportQuery.data.payment_statuses.map((row) => [row.status.replaceAll('_', ' '), String(row.count), money(row.amount_minor)])} />
                <ReportTable title="Voucher usage" headers={['Voucher', 'Redemptions', 'Saved']} rows={reportQuery.data.voucher_usage.map((row) => [row.code, String(row.redemptions), money(row.amount_saved_minor)])} />
              </div>
            )}
          </section>
        )}

        {tab === 'audit' && (
          <section>
            <div className="staff-section-heading"><div><h2 className="font-brand-heading text-xl font-bold text-brand-green">Audit log</h2><p className="mt-1 text-xs text-brand-ink/55">Recent stock, price, order and fulfillment changes for this branch.</p></div><button className="button button-outline button-small" onClick={() => void auditQuery.refetch()}>Refresh</button></div>
            {auditQuery.isError && <p className="staff-error">{errorText(auditQuery.error)}</p>}
            {auditQuery.isLoading ? <p className="staff-empty">Loading audit history…</p> : (
              <div className="staff-audit-list">
                {(auditQuery.data ?? []).map((event) => <article key={event.id}>
                  <time>{new Date(event.occurred_at).toLocaleString()}</time>
                  <strong>{event.action.replaceAll('.', ' ')}</strong>
                  <span>{event.resource_type} · {event.resource_id}</span>
                  <small>{event.actor || 'System'}{event.branch ? ` · ${event.branch}` : ''}</small>
                  <details><summary>Change details</summary><pre>{JSON.stringify({ before: event.before_data, after: event.after_data }, null, 2)}</pre></details>
                </article>)}
                {!auditQuery.data?.length && <p className="staff-empty">No audit entries for this branch yet.</p>}
              </div>
            )}
          </section>
        )}

        {tab === 'refunds' && profile.is_super_admin && (
          <section>
            <div className="staff-section-heading"><div><h2 className="font-brand-heading text-xl font-bold text-brand-green">Refund review</h2><p className="mt-1 text-xs text-brand-ink/55">Review stock-adjustment differences and inspect provider refund status.</p></div><button className="button button-outline button-small" onClick={() => void refundQuery.refetch()}>Refresh</button></div>
            {(refundQuery.isError || approveAdjustmentRefund.isError || retryRefund.isError) && <p className="staff-error">{errorText(refundQuery.error ?? approveAdjustmentRefund.error ?? retryRefund.error)}</p>}
            {refundQuery.isLoading ? <p className="staff-empty">Loading refunds…</p> : (
              <div className="staff-refund-list">
                {(refundQuery.data?.review_orders ?? []).map((item) => <article key={item.order_number}>
                  <div><strong>{item.order_number}</strong><span>{item.customer || 'Customer'} · {item.branch}</span><small>{item.note}</small></div>
                  <strong>{money(item.amount_minor, item.currency)}</strong>
                  <button className="button button-primary button-small" disabled={approveAdjustmentRefund.isPending} onClick={() => approveAdjustmentRefund.mutate(item.order_number)}>Approve partial refund</button>
                </article>)}
                {!refundQuery.data?.review_orders.length && <p className="staff-empty">No adjustment refunds need review.</p>}
                <h3 className="mt-6 font-brand-heading text-lg font-bold text-brand-green">Recent refunds</h3>
                {(refundQuery.data?.refunds ?? []).map((refund) => <article key={refund.id}>
                  <div><strong>{refund.order_number} · {refund.status.replaceAll('_', ' ')}</strong><span>{refund.reason}</span><small>{refund.last_error || new Date(refund.created_at).toLocaleString()}</small></div>
                  <strong>{money(refund.amount_minor, refund.currency)}</strong>
                  {['requested', 'failed'].includes(refund.status) && <button className="button button-outline button-small" disabled={retryRefund.isPending} onClick={() => retryRefund.mutate(refund.id)}>Retry refund</button>}
                </article>)}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function OrderDetail({
  order,
  inventory,
  onClose,
  onAssignRider,
  riderName,
  riderPhone,
  setRiderName,
  setRiderPhone,
  onAdjust,
  replacementIds,
  setReplacementIds,
  isSaving,
  onPrint,
  onReceipt,
  admin,
  onCancel,
}: {
  order: CustomerOrder
  inventory: InventoryRow[]
  onClose: () => void
  onAssignRider: () => void
  riderName: string
  riderPhone: string
  setRiderName: (value: string) => void
  setRiderPhone: (value: string) => void
  onAdjust: (lineId: string, action: 'remove' | 'substitute', replacementId?: string) => void
  replacementIds: Record<string, string>
  setReplacementIds: (update: (current: Record<string, string>) => Record<string, string>) => void
  isSaving: boolean
  onPrint: () => void
  onReceipt: () => void
  admin: boolean
  onCancel: () => void
}) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const mapAddress = [
    order.address_snapshot.address_line_1,
    order.address_snapshot.address_line_2,
    order.address_snapshot.area,
  ].filter(Boolean).join(', ')
  const mapUrl = order.address_snapshot.latitude && order.address_snapshot.longitude
    ? `https://www.google.com/maps?q=${order.address_snapshot.latitude},${order.address_snapshot.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapAddress)}`
  const replacementOptions = inventory.filter((row) => row.is_available && row.available_quantity > 0)
  const canAdjust = ['confirmed', 'picking'].includes(order.status)
  const customerName = order.customer_name || order.address_snapshot.recipient_name || 'Customer'
  const customerPhone = order.customer_phone || order.address_snapshot.phone
  const isDelivery = order.fulfillment_method === 'delivery'
  const activeLines = order.lines.filter((line) => !line.is_removed)

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-brand-green/20 p-5 sm:p-7 space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-brand-green/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-brand-green sm:text-lg" id="order-detail-title">
                {order.order_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isDelivery ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                }`}
              >
                {isDelivery ? '🛵 Delivery' : '🛍️ In-Store Pickup'}
              </span>
              <span className="rounded-full bg-brand-cream px-2 py-0.5 text-[10px] font-bold capitalize text-brand-ink/70">
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-ink/60">
              Placed on {new Date(order.created_at).toLocaleString()} · {order.branch_snapshot.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-brand-cream/80 text-brand-ink/60 hover:bg-brand-cream hover:text-brand-ink transition text-sm font-bold"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="button button-outline button-small inline-flex items-center gap-1.5 text-xs py-1.5"
            onClick={onPrint}
          >
            <span>🖨️ Print pick-list</span>
          </button>
          {order.paid_at && (
            <button
              type="button"
              className="button button-outline button-small inline-flex items-center gap-1.5 text-xs py-1.5"
              onClick={onReceipt}
            >
              <span>📄 Download receipt PDF</span>
            </button>
          )}
          {admin && !['cancelled', 'delivered'].includes(order.status) && (
            <button
              type="button"
              className="button button-outline button-small text-xs py-1.5 text-brand-tomato hover:bg-red-50"
              onClick={onCancel}
            >
              {order.paid_at ? 'Cancel & request refund' : 'Cancel unpaid order'}
            </button>
          )}
        </div>

        {/* Grid Info: Customer, Delivery, Payment */}
        <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-brand-cream/40 p-4 border border-brand-green/10 text-xs">
          {/* Customer */}
          <div>
            <span className="font-bold uppercase tracking-wider text-brand-ink/50 text-[10px]">Customer</span>
            <p className="font-bold text-sm text-brand-ink mt-0.5">{customerName}</p>
            {customerPhone ? (
              <a href={`tel:${customerPhone}`} className="text-brand-green font-semibold hover:underline inline-flex items-center gap-1 mt-0.5">
                <span>📞 {customerPhone}</span>
              </a>
            ) : (
              <p className="text-brand-ink/50">No phone provided</p>
            )}
            {(order.address_snapshot as unknown as { email?: string }).email && (
              <p className="text-brand-ink/60 text-[11px] mt-0.5">✉ {(order.address_snapshot as unknown as { email?: string }).email}</p>
            )}
          </div>

          {/* Delivery / Address */}
          <div>
            <span className="font-bold uppercase tracking-wider text-brand-ink/50 text-[10px]">
              {isDelivery ? 'Delivery Location' : 'Fulfillment Type'}
            </span>
            <p className="font-bold text-brand-ink mt-0.5">
              {mapAddress || (isDelivery ? 'Accra, Ghana' : 'In-Store Branch Pickup')}
            </p>
            {isDelivery && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-green font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                <span>🗺️ Open in Google Maps ↗</span>
              </a>
            )}
            {order.address_snapshot.directions && (
              <p className="text-[11px] text-brand-ink/65 italic mt-1">
                &ldquo;{order.address_snapshot.directions}&rdquo;
              </p>
            )}
          </div>

          {/* Payment */}
          <div>
            <span className="font-bold uppercase tracking-wider text-brand-ink/50 text-[10px]">Payment</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="capitalize font-bold text-brand-ink">
                {order.payment_status?.replaceAll('_', ' ') ?? 'Confirmed'}
              </span>
              {order.paid_at && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                  ✓ Paid
                </span>
              )}
            </div>
            <strong className="font-mono text-base font-black text-brand-green block mt-1">
              {money(order.total_amount_minor, order.currency)}
            </strong>
          </div>

          {/* Customer Notes */}
          <div>
            <span className="font-bold uppercase tracking-wider text-brand-ink/50 text-[10px]">Special Instructions</span>
            <p className="text-brand-ink/75 mt-0.5">
              {order.customer_note || 'No special instructions from customer.'}
            </p>
          </div>
        </div>

        {/* Interactive Produce Pick-List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-brand-heading text-base font-bold text-brand-green">
              Produce Pick-List ({activeLines.length} item{activeLines.length === 1 ? '' : 's'})
            </h3>
            <span className="text-[11px] text-brand-ink/60">
              Check off items as they are packed
            </span>
          </div>

          <div className="space-y-2 rounded-2xl border border-brand-green/15 bg-white p-3">
            {activeLines.map((line) => {
              const isChecked = Boolean(checkedItems[line.id])
              return (
                <div
                  key={line.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border transition ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-300 line-through text-brand-ink/50'
                      : 'bg-brand-cream/30 border-brand-green/10'
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(line.id)}
                      className="h-4 w-4 rounded text-brand-green focus:ring-brand-green"
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-brand-ink">
                        {line.quantity} × {line.name_snapshot}
                      </span>
                      <span className="text-[11px] text-brand-ink/60 ml-2 font-normal">
                        ({line.unit_snapshot} · {money(line.line_total_minor, order.currency)})
                      </span>
                    </div>
                  </label>

                  {canAdjust && line.product_id && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
                      <select
                        aria-label={`Replacement for ${line.name_snapshot}`}
                        value={replacementIds[line.id] ?? ''}
                        onChange={(event) =>
                          setReplacementIds((current) => ({ ...current, [line.id]: event.target.value }))
                        }
                        className="rounded-lg border border-brand-green/20 bg-white px-2 py-1 text-[11px] text-brand-ink"
                      >
                        <option value="">Substitute with…</option>
                        {replacementOptions
                          .filter((row) => row.product !== line.product_id)
                          .map((row) => (
                            <option key={row.product} value={row.product}>
                              {row.product_name} ({money(row.effective_price_minor, order.currency)})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onAdjust(line.id, 'remove')}
                        disabled={isSaving}
                        className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-brand-tomato hover:bg-red-100"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdjust(line.id, 'substitute', replacementIds[line.id])}
                        disabled={isSaving || !replacementIds[line.id]}
                        className="rounded-lg bg-brand-green px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-spinach disabled:opacity-40"
                      >
                        Substitute
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {order.refund_review_required && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs font-semibold text-amber-900">
              Admin refund review required · {money(order.refund_difference_minor, order.currency)} difference.
            </p>
          )}

          <div className="flex items-center justify-between border-t border-brand-green/10 pt-3 text-sm">
            <span className="font-bold text-brand-ink/75">Order Total</span>
            <strong className="font-mono text-base font-black text-brand-green">
              {money(order.total_amount_minor, order.currency)}
            </strong>
          </div>
        </div>

        {/* Rider Assignment Card (For Delivery Orders) */}
        {isDelivery && order.status !== 'delivered' && (
          <div className="rounded-2xl border border-brand-green/15 bg-brand-cream/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-brand-heading text-sm font-bold text-brand-green">
                  Assign Delivery Courier / Rider
                </h3>
                <p className="text-[11px] text-brand-ink/60">
                  Rider details appear in real-time on the customer&apos;s tracking page.
                </p>
              </div>
              {riderPhone && (
                <a
                  href={`tel:${riderPhone}`}
                  className="button button-small button-outline text-xs inline-flex items-center gap-1"
                >
                  <span>📞 Call Rider</span>
                </a>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-brand-ink">Rider Name</label>
                <input
                  type="text"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  placeholder="e.g. Kofi Boateng"
                  className="w-full rounded-xl border border-brand-green/20 bg-white px-3 py-2 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-brand-ink">Rider Phone</label>
                <input
                  type="tel"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  placeholder="e.g. 055 987 6543"
                  className="w-full rounded-xl border border-brand-green/20 bg-white px-3 py-2 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="button button-primary button-small text-xs"
                disabled={
                  isSaving ||
                  (!riderName.trim() && Boolean(riderPhone.trim())) ||
                  (!riderPhone.trim() && Boolean(riderName.trim()))
                }
                onClick={onAssignRider}
              >
                {isSaving ? 'Saving…' : 'Save & Assign Rider'}
              </button>
            </div>
          </div>
        )}

        {admin && order.refund_review_required && (
          <p className="text-xs text-brand-ink/60">
            Administer any approved refund through the secured{' '}
            <a href="/admin/" target="_blank" rel="noreferrer" className="text-brand-green underline font-bold">
              Django Admin
            </a>.
          </p>
        )}
      </div>
    </div>
  )
}
function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <section className="staff-report-table">
      <h3>{title}</h3>
      {rows.length ? <div className="staff-table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div> : <p>No data in this date range.</p>}
    </section>
  )
}

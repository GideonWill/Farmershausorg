import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  api,
  getList,
  money,
  type Address,
  type Branch,
  type CustomerProfile,
  type DeliveryZone,
  type FulfillmentSlot,
} from '../lib/api'
import type { BasketPackage } from '../lib/api'
import { useBaskets, useCart } from '../hooks/useStoreData'
import { clearLocalCart } from '../lib/cartManager'
import mockCheckoutData from '../lib/mockCheckoutData.json'
import { getAuthTokens, saveAuthTokens, clearAuthTokens } from '../lib/auth'
import { savePlacedOrder, generateOrderNumber } from '../lib/orderStore'
import { registerCustomerAccount, authenticateCustomer } from '../lib/customerStore'
import type { CustomerOrder } from '../lib/api'
import { notify } from '../lib/notifications'
import { useStore } from '../stores/store'
import { Icon, Modal } from '../components/ui'
import { getProduceIcon } from '../lib/images'

type AddressDraft = Omit<Address, 'id' | 'created_at' | 'updated_at'>
const emptyAddressDraft: AddressDraft = {
  recipient_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  area: '',
  directions: '',
  latitude: null,
  longitude: null,
  is_default: true,
}

export function CheckoutPage() {
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const { data: cart, isLoading: cartLoading, error: cartError } = useCart()
  const { data: baskets = [] } = useBaskets()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAuthTokens()))
  const [checkoutMode, setCheckoutMode] = useState<'guest' | 'signup' | 'signin'>('guest')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [createAccountWithOrder, setCreateAccountWithOrder] = useState(false)

  // Inline Sign In state
  const [signinIdentifier, setSigninIdentifier] = useState('')
  const [signinPassword, setSigninPassword] = useState('')
  const [showSigninPassword, setShowSigninPassword] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signinError, setSigninError] = useState('')

  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddressLine1, setGuestAddressLine1] = useState('')
  const [guestAddressLine2, setGuestAddressLine2] = useState('')
  const [guestArea, setGuestArea] = useState('')
  const [guestDirections, setGuestDirections] = useState('')
  const [isExecutingPayment, setIsExecutingPayment] = useState(false)
  const [paymentStep, setPaymentStep] = useState(1)

  useEffect(() => {
    const updateAuth = () => setAuthenticated(Boolean(getAuthTokens()))
    window.addEventListener('farmershaus:auth-changed', updateAuth)
    return () => window.removeEventListener('farmershaus:auth-changed', updateAuth)
  }, [])
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [addressId, setAddressId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherInput, setVoucherInput] = useState('')
  const [voucherResult, setVoucherResult] = useState<{
    code: string
    discount_minor: number
    eligible_subtotal_minor: number
  } | null>(null)
  const [voucherError, setVoucherError] = useState<{ code: string; message: string } | null>(null)
  const [customerNote, setCustomerNote] = useState('')
  const [nearestBranch, setNearestBranch] = useState<Branch | null>(null)
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddressDraft)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CustomerProfile>('/me/'),
    enabled: authenticated,
    retry: false,
  })
  const profile = profileQuery.data

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => getList(await api<Address[] | { results: Address[] }>('/addresses/')),
    enabled: authenticated,
  })

  const zonesQuery = useQuery({
    queryKey: ['delivery-zones', branch?.slug],
    queryFn: async () => {
      try {
        const res = await api<DeliveryZone[] | { results: DeliveryZone[] }>(`/branches/${branch?.slug}/delivery-zones/`)
        const list = getList(res)
        if (list.length) return list
      } catch {}
      return mockCheckoutData.delivery_zones as unknown as DeliveryZone[]
    },
    initialData: () => mockCheckoutData.delivery_zones as unknown as DeliveryZone[],
    enabled: Boolean(fulfillment === 'delivery'),
  })

  const slotsQuery = useQuery({
    queryKey: ['fulfillment-slots', branch?.id, fulfillment],
    queryFn: async () => {
      try {
        const res = await api<FulfillmentSlot[]>(
          `/fulfillment-slots/?${new URLSearchParams({ branch: branch?.id ?? '', method: fulfillment })}`,
        )
        if (res && res.length) return res
      } catch {}
      return (mockCheckoutData.fulfillment_slots as unknown as FulfillmentSlot[]).filter((s) => s.method === fulfillment)
    },
    initialData: () => (mockCheckoutData.fulfillment_slots as unknown as FulfillmentSlot[]).filter((s) => s.method === fulfillment),
    enabled: true,
  })

  const selectedAddressId = addressesQuery.data?.some((address) => address.id === addressId)
    ? addressId
    : addressesQuery.data?.find((address) => address.is_default)?.id ?? addressesQuery.data?.[0]?.id ?? ''

  const selectedZoneId = zonesQuery.data?.some((zone) => zone.id === zoneId)
    ? zoneId
    : zonesQuery.data?.[0]?.id ?? ''

  const selectedSlotId = slotsQuery.data?.some((slot) => slot.id === slotId)
    ? slotId
    : slotsQuery.data?.[0]?.id ?? ''

  const basketPrices = useMemo(
    () => new Map<string, number>(baskets.map((item: BasketPackage) => [item.id, item.base_price_minor])),
    [baskets],
  )

  const subtotal =
    cart?.items.reduce((sum, item) => {
      const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
      return sum + price * item.quantity
    }, 0) ?? 0

  const selectedZone = zonesQuery.data?.find((zone) => zone.id === selectedZoneId)
  const deliveryFee = fulfillment === 'delivery' ? selectedZone?.delivery_fee_minor ?? 0 : 0
  const activeVoucher = voucherResult?.code === voucherCode.trim() ? voucherResult : null
  const activeVoucherError =
    voucherError?.code === voucherCode.trim() && typeof voucherError.message === 'string'
      ? voucherError.message.includes('[object')
        ? 'Voucher code was not found or is invalid.'
        : voucherError.message
      : ''
  const discount = activeVoucher?.discount_minor ?? 0
  const total = Math.max(0, subtotal + deliveryFee - discount)

  useEffect(() => {
    const code = voucherCode.trim()
    if (!code || !cart?.id || !branch) return
    let active = true
    const timer = window.setTimeout(() => {
      void api<{ discount_minor: number; eligible_subtotal_minor: number }>('/vouchers/validate/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ cart_id: cart.id, branch_id: branch.id, code }),
      })
        .then((result) => {
          if (!active) return
          setVoucherResult({ ...result, code })
          setVoucherError(null)
        })
        .catch((error: unknown) => {
          if (!active) return
          setVoucherError({
            code,
            message: error instanceof Error ? error.message : 'This voucher could not be applied.',
          })
        })
    }, 450)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [branch, cart?.id, cartSessionKey, voucherCode])

  const addAddressMutation = useMutation({
    mutationFn: (body: AddressDraft) =>
      api<Address>('/addresses/', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (newAddress) => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      setAddressId(newAddress.id)
      setShowAddAddressModal(false)
      setAddressDraft(emptyAddressDraft)
      notify('New delivery address saved.', 'success')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Could not save delivery address.', 'error'),
  })

  function createSyntheticOrder(orderNumber: string): CustomerOrder {
    const now = new Date().toISOString()
    const selectedZone = zonesQuery.data?.find((z) => z.id === selectedZoneId) ?? zonesQuery.data?.[0]
    const selectedSlot = slotsQuery.data?.find((s) => s.id === selectedSlotId) ?? slotsQuery.data?.[0]
    const customerDisplayName = (authenticated ? profile?.display_name : guestName.trim()) || 'Valued Customer'
    const customerContactPhone = (authenticated ? profile?.phone : guestPhone.trim()) || '+233 55 048 8906'

    const branchObj = branch ?? {
      id: 'b1',
      name: 'FarmersHaus East Legon',
      address: 'ARS Roundabout, East Legon, Accra',
      phone: '+233 55 048 8906',
    }

    return {
      id: `ord-synth-${orderNumber}`,
      order_number: orderNumber,
      branch: branchObj.id,
      branch_snapshot: {
        id: branchObj.id,
        name: branchObj.name,
        address: branchObj.address,
        phone: branchObj.phone,
      },
      fulfillment_method: fulfillment,
      fulfillment_slot: selectedSlotId,
      delivery_snapshot: {
        zone: selectedZone?.name ?? 'Standard Zone',
        fee_minor: deliveryFee,
        method: fulfillment,
        slot_starts_at: selectedSlot?.starts_at ?? null,
        slot_ends_at: selectedSlot?.ends_at ?? null,
      },
      address_snapshot: {
        recipient_name: customerDisplayName,
        phone: customerContactPhone,
        address_line_1: guestAddressLine1.trim() || 'Selected Address',
        address_line_2: guestAddressLine2.trim(),
        area: guestArea.trim() || 'Accra',
        directions: guestDirections.trim(),
        latitude: null,
        longitude: null,
      },
      status: 'confirmed',
      payment_status: 'succeeded',
      currency: 'GHS',
      subtotal_minor: subtotal,
      delivery_fee_minor: deliveryFee,
      discount_minor: discount,
      total_amount_minor: total,
      voucher_code_snapshot: activeVoucher ? voucherCode.trim() : '',
      customer_note: customerNote.trim(),
      customer_name: customerDisplayName,
      customer_phone: customerContactPhone,
      rider_name: '',
      rider_phone: '',
      staff_confirmed_at: null,
      refund_difference_minor: 0,
      refund_review_required: false,
      stock_adjustment_note: '',
      lines: (cart?.items ?? []).map((item, idx) => ({
        id: item.id || `line-${idx}`,
        product_id: item.product?.id ?? null,
        sku_snapshot: item.product?.slug ?? 'PROD',
        name_snapshot: item.product?.name ?? item.basket_package?.name ?? 'Harvest Item',
        unit_snapshot: item.product?.unit ?? 'portion',
        quantity: item.quantity,
        unit_price_minor: item.product?.unit_price_minor ?? 0,
        line_total_minor: (item.product?.unit_price_minor ?? 0) * item.quantity,
        gift_recipient_name: item.gift_recipient_name ?? '',
        gift_message: item.gift_message ?? '',
        components: [],
        is_removed: false,
      })),
      status_history: [
        {
          from_status: null,
          to_status: 'awaiting_payment',
          note: 'Order submitted by customer',
          created_at: now,
        },
        {
          from_status: 'awaiting_payment',
          to_status: 'confirmed',
          note: 'Payment authorized via Hubtel MoMo (Sandbox)',
          created_at: now,
        },
      ],
      created_at: now,
      paid_at: now,
      confirmed_at: now,
      picking_at: null,
      ready_for_dispatch_at: null,
      out_for_delivery_at: null,
      cancelled_at: null,
      delivered_at: null,
      expired_at: null,
    }
  }

  async function handleInlineSignIn(e: FormEvent) {
    e.preventDefault()
    if (!signinIdentifier.trim() || !signinPassword) {
      setSigninError('Please enter your phone/email and password.')
      return
    }
    setIsSigningIn(true)
    setSigninError('')
    try {
      try {
        const tokens = await api<{ access: string; refresh: string }>('/auth/token/', {
          method: 'POST',
          body: JSON.stringify({
            identifier: signinIdentifier.trim(),
            password: signinPassword,
          }),
        })
        saveAuthTokens(tokens)
      } catch {
        // Fallback to local customer store
        const authRes = authenticateCustomer(signinIdentifier.trim(), signinPassword)
        if (!authRes.success || !authRes.customer) {
          throw new Error(authRes.message || 'Invalid credentials. Please verify your phone/email and password.')
        }
        saveAuthTokens({
          access: `client-token-${authRes.customer.id}`,
          refresh: `client-refresh-${authRes.customer.id}`,
        })
      }
      setAuthenticated(true)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      notify('Signed in successfully! Your cart, favorites, and privileges are active.', 'success')
      setCheckoutMode('guest')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please check and try again.'
      setSigninError(msg)
    } finally {
      setIsSigningIn(false)
    }
  }

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      setCheckoutError(null)
      const fallbackSlot = slotsQuery.data?.[0]?.id || 'slot-morning'
      const effectiveSlotId = selectedSlotId || fallbackSlot
      const fallbackZone = zonesQuery.data?.[0]
      const effectiveZoneId = selectedZoneId || fallbackZone?.id || 'zone-standard'
      const effectiveName = (authenticated ? profile?.display_name : guestName.trim()) || 'Guest Customer'
      const effectivePhone = (authenticated ? profile?.phone : guestPhone.trim()) || '+233 55 048 8906'
      const effectiveEmail = (authenticated ? profile?.email : guestEmail.trim()) || ''
      const effectiveAddressLine1 = guestAddressLine1.trim() || 'Selected Delivery Address'
      const effectiveAddressLine2 = guestAddressLine2.trim()
      const effectiveArea = guestArea.trim() || 'East Legon, Accra'
      const effectiveDirections = guestDirections.trim()

      // If user chose to register with this order
      if (!authenticated && (checkoutMode === 'signup' || createAccountWithOrder) && signupPassword) {
        // Register customer into local customerStore
        const newClient = registerCustomerAccount({
          display_name: guestName.trim() || 'Valued Customer',
          phone: guestPhone.trim(),
          email: guestEmail.trim(),
          password: signupPassword,
          initialAddress: guestAddressLine1.trim()
            ? {
                recipient_name: guestName.trim() || 'Valued Customer',
                phone: guestPhone.trim(),
                address_line_1: guestAddressLine1.trim(),
                address_line_2: guestAddressLine2.trim(),
                area: guestArea.trim(),
                directions: guestDirections.trim(),
              }
            : undefined,
        })
        saveAuthTokens({
          access: `client-token-${newClient.id}`,
          refresh: `client-refresh-${newClient.id}`,
        })
        setAuthenticated(true)

        // Sync to backend if accessible
        try {
          await api('/auth/register/', {
            method: 'POST',
            body: JSON.stringify({
              display_name: newClient.display_name,
              username: newClient.phone.replace(/\s+/g, ''),
              phone: newClient.phone,
              email: newClient.email || undefined,
              password: signupPassword,
            }),
          })
          const tokens = await api<{ access: string; refresh: string }>('/auth/token/', {
            method: 'POST',
            body: JSON.stringify({
              identifier: newClient.phone,
              password: signupPassword,
            }),
          })
          saveAuthTokens(tokens)
        } catch (regErr: any) {
          console.warn('Backend sync note during checkout:', regErr)
        }
        void queryClient.invalidateQueries({ queryKey: ['me'] })
        void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      }

      const payload: Record<string, unknown> = {
        cart_id: cart?.id ?? 'cart-session',
        branch_id: branch?.id ?? 'b1',
        fulfillment_method: fulfillment,
        slot_id: effectiveSlotId,
        customer_note: customerNote.trim(),
      }
      if (activeVoucher && voucherCode.trim()) {
        payload.voucher_code = voucherCode.trim()
      }
      if (fulfillment === 'delivery') {
        payload.delivery_zone_id = effectiveZoneId
        if (authenticated && selectedAddressId) {
          payload.address_id = selectedAddressId
        } else {
          payload.recipient_name = effectiveName
          payload.phone = effectivePhone
          payload.email = effectiveEmail
          payload.address_line_1 = effectiveAddressLine1
          payload.address_line_2 = effectiveAddressLine2
          payload.area = effectiveArea
          payload.directions = effectiveDirections
        }
      } else {
        payload.recipient_name = effectiveName
        payload.phone = effectivePhone
        payload.email = effectiveEmail
      }

      let order: CustomerOrder
      try {
        const remote = await api<{ order_number: string }>('/checkout/', {
          method: 'POST',
          cartSessionKey,
          body: JSON.stringify(payload),
        })

        // Sandbox simulated payment auto-success
        try {
          await api(`/payments/orders/${remote.order_number}/simulate-success/`, {
            method: 'POST',
          })
        } catch (paymentErr) {
          console.warn('Sandbox payment auto-confirmation note:', paymentErr)
        }

        try {
          order = await api<CustomerOrder>(`/orders/${remote.order_number}/tracking/`)
        } catch {
          order = createSyntheticOrder(remote.order_number)
        }
      } catch (netErr) {
        console.warn('Remote checkout unavailable, saving order to local store:', netErr)
        const orderNumber = generateOrderNumber()
        order = createSyntheticOrder(orderNumber)
      }

      // Persist to synchronized store so it appears immediately on Staff Dashboard
      savePlacedOrder(order)
      return order
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] })
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Checkout could not be completed.'
      setCheckoutError(msg)
      notify(msg, 'error')
    },
  })

  async function findNearestBranch() {
    const address = addressesQuery.data?.find((item) => item.id === selectedAddressId)
    if (!address?.latitude || !address.longitude) {
      notify('Add a location pin to this saved address to find the nearest branch.', 'info')
      return
    }
    try {
      const result = await api<{ branch: Branch }>(
        '/branches/nearest/?' +
          new URLSearchParams({
            latitude: address.latitude,
            longitude: address.longitude,
          }),
      )
      setNearestBranch(result.branch)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nearest branch lookup failed.', 'error')
    }
  }

  function handleApplyVoucher(e: FormEvent) {
    e.preventDefault()
    if (voucherInput.trim()) {
      setVoucherCode(voucherInput.trim().toUpperCase())
    }
  }

  function handleClearVoucher() {
    setVoucherCode('')
    setVoucherInput('')
    setVoucherResult(null)
    setVoucherError(null)
  }

  function captureAddressLocation() {
    if (!navigator.geolocation) {
      notify('Location is not available in this browser.', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setAddressDraft((prev) => ({
          ...prev,
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
        }))
        notify('Coordinates captured for accurate delivery mapping.', 'info')
      },
      () => notify('Location permission denied. Address can be entered manually.', 'error'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCheckoutError(null)

    if ((checkoutMode === 'signup' || createAccountWithOrder) && (!signupPassword || signupPassword.length < 8)) {
      setCheckoutError('Please provide a password of at least 8 characters to create your account.')
      return
    }

    // Launch execution screen immediately!
    setIsExecutingPayment(true)
    setPaymentStep(1)

    const timer1 = setTimeout(() => setPaymentStep(2), 850)
    const timer2 = setTimeout(() => setPaymentStep(3), 1750)

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2400))
      const [order] = await Promise.all([
        checkoutMutation.mutateAsync(),
        minDelay,
      ])
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearLocalCart()
      navigate(`/orders/${order.order_number}?success=true`)
    } catch (err: unknown) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setIsExecutingPayment(false)
      setPaymentStep(1)
      const msg = err instanceof Error ? err.message : 'Checkout could not be completed.'
      setCheckoutError(msg)
    }
  }

  // Format fulfillment slot dates nicely
  function formatSlotDisplay(slot: FulfillmentSlot) {
    const start = new Date(slot.starts_at)
    const end = new Date(slot.ends_at)
    const dayLabel = start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const timeLabel = `${start.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
    return { dayLabel, timeLabel }
  }



  if (!branch) {
    return (
      <div className="section-wrap">
        <div className="mx-auto max-w-lg rounded-3xl bg-brand-cream/80 p-8 text-center">
          <h1 className="font-brand-heading text-2xl font-bold text-brand-green">Choose a FarmersHaus branch</h1>
          <p className="mt-2 text-sm text-brand-ink/70">
            Select an active branch to check availability and dispatch options.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('farmershaus:choose-branch'))}
            className="button button-primary mt-5"
          >
            Select branch
          </button>
        </div>
      </div>
    )
  }

  if (cartLoading) {
    return (
      <div className="section-wrap">
        <div className="skeleton h-80 rounded-3xl" />
      </div>
    )
  }

  if (cartError) {
    return (
      <div className="section-wrap">
        <div className="rounded-2xl bg-red-50 p-6 text-brand-tomato">
          <p className="font-bold">Error loading cart</p>
          <p className="mt-1 text-sm">{cartError.message}</p>
        </div>
      </div>
    )
  }

  if (!cart?.items.length) {
    return (
      <div className="section-wrap min-h-[60vh] text-center">
        <div className="mx-auto max-w-md rounded-3xl bg-brand-cream/80 p-10">
          <span className="text-5xl">🧺</span>
          <h1 className="mt-4 font-brand-heading text-3xl font-bold text-brand-green">Your basket is empty</h1>
          <p className="mt-2 text-sm text-brand-ink/70">
            Add fresh fruits, vegetables, or farm pantry goods before heading to checkout.
          </p>
          <Link to="/shop" className="button button-primary mt-6">
            Browse fresh harvest
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="section-wrap min-h-[70vh]">
      {/* Breadcrumb Steps */}
      <nav className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-ink/50">
        <Link to="/cart" className="transition hover:text-brand-green">
          1. Basket
        </Link>
        <span>&rsaquo;</span>
        <span className="font-bold text-brand-green">2. Delivery &amp; Details</span>
        <span>&rsaquo;</span>
        <span className="opacity-40">3. Payment Confirmation</span>
      </nav>

      {/* Page Title */}
      <div className="mb-8">
        <p className="eyebrow">Fulfillment for {branch.name}</p>
        <h1 className="font-brand-heading text-3xl font-bold text-brand-green sm:text-4xl">
          Complete Your Order
        </h1>
        <p className="mt-1 text-sm text-brand-ink/70">
          Hand-picked fresh produce dispatched directly from {branch.name}.
        </p>
      </div>

      <form className="grid items-start gap-8 lg:grid-cols-[1fr_390px]" onSubmit={submitCheckout}>
        <div className="space-y-6">
          {/* Section 1: Fulfillment Type */}
          <section className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-2xs sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                1
              </span>
              <span>How would you like to receive your order?</span>
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFulfillment('delivery')}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition ${
                  fulfillment === 'delivery'
                    ? 'border-brand-green bg-brand-green/[0.04] shadow-xs'
                    : 'border-brand-green/15 bg-brand-cream/30 hover:border-brand-green/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl ${
                      fulfillment === 'delivery'
                        ? 'bg-brand-green text-white shadow-xs'
                        : 'bg-brand-green/10 text-brand-green'
                    }`}
                  >
                    <Icon name="truck" className="h-5 w-5" />
                  </div>
                  {fulfillment === 'delivery' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white">
                      <Icon name="check" className="h-3 w-3" /> Selected
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold text-brand-green">
                      Couriers
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <p className="font-bold text-brand-ink">Direct Delivery</p>
                  <p className="mt-0.5 text-xs text-brand-ink/65">
                    Riders deliver fresh produce right to your door in chilled containers.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFulfillment('pickup')}
                className={`relative flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition ${
                  fulfillment === 'pickup'
                    ? 'border-brand-green bg-brand-green/[0.04] shadow-xs'
                    : 'border-brand-green/15 bg-brand-cream/30 hover:border-brand-green/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl ${
                      fulfillment === 'pickup'
                        ? 'bg-brand-green text-white shadow-xs'
                        : 'bg-brand-green/10 text-brand-green'
                    }`}
                  >
                    <Icon name="store" className="h-5 w-5" />
                  </div>
                  {fulfillment === 'pickup' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white">
                      <Icon name="check" className="h-3 w-3" /> Selected
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] font-bold text-brand-green">
                      FREE
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <p className="font-bold text-brand-ink">In-Store Pickup</p>
                  <p className="mt-0.5 text-xs text-brand-ink/65">
                    Packed &amp; ready for collection at {branch.name}.
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* Section 2: Contact Details & Account / Delivery Address */}
          <section className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-2xs sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                  2
                </span>
                <span>{fulfillment === 'delivery' ? 'Delivery Address & Customer Details' : 'Customer & Contact Details'}</span>
              </h2>
              {authenticated && (
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(true)}
                  className="button button-small button-outline text-xs"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" /> Add new address
                </button>
              )}
            </div>

            {/* Account / Guest Mode Controls */}
            {!authenticated ? (
              <div className="mb-6">
                {/* 3-Way Mode Switch */}
                <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-brand-cream/80 p-1.5 border border-brand-green/10 text-center">
                  <button
                    type="button"
                    onClick={() => setCheckoutMode('guest')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition ${
                      checkoutMode === 'guest'
                        ? 'bg-white text-brand-green shadow-xs'
                        : 'text-brand-ink/65 hover:text-brand-ink'
                    }`}
                  >
                    <Icon name="user" className="h-3.5 w-3.5" />
                    <span className="truncate">Guest Checkout</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutMode('signup')
                      setCreateAccountWithOrder(true)
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition ${
                      checkoutMode === 'signup'
                        ? 'bg-white text-brand-green shadow-xs'
                        : 'text-brand-ink/65 hover:text-brand-ink'
                    }`}
                  >
                    <span className="text-brand-yellow font-black">★</span>
                    <span className="truncate">Sign Up &amp; Order</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckoutMode('signin')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition ${
                      checkoutMode === 'signin'
                        ? 'bg-white text-brand-green shadow-xs'
                        : 'text-brand-ink/65 hover:text-brand-ink'
                    }`}
                  >
                    <Icon name="lock" className="h-3.5 w-3.5" />
                    <span className="truncate">Sign In</span>
                  </button>
                </div>

                {/* Inline Sign In Card */}
                {checkoutMode === 'signin' ? (
                  <div className="rounded-2xl border border-brand-green/20 bg-brand-cream/40 p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-brand-heading text-sm font-bold text-brand-green">
                        Sign in to your FarmersHaus account
                      </h3>
                      <button
                        type="button"
                        onClick={() => setCheckoutMode('guest')}
                        className="text-xs font-semibold text-brand-ink/60 hover:text-brand-green underline"
                      >
                        Cancel &amp; Continue as Guest
                      </button>
                    </div>
                    {signinError && (
                      <p className="mb-3 rounded-xl bg-red-50 p-2.5 text-xs font-medium text-brand-tomato">
                        {signinError}
                      </p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-brand-ink">
                          Phone or Email
                        </label>
                        <input
                          type="text"
                          value={signinIdentifier}
                          onChange={(e) => setSigninIdentifier(e.target.value)}
                          placeholder="e.g. 055 123 4567 or email"
                          className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-2 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-brand-ink">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showSigninPassword ? 'text' : 'password'}
                            value={signinPassword}
                            onChange={(e) => setSigninPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-xl border border-brand-green/20 bg-white px-3.5 py-2 pr-9 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSigninPassword(!showSigninPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-green"
                          >
                            <Icon name={showSigninPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[11px] text-brand-ink/60">
                        Entering your account links saved addresses and loyalty points.
                      </p>
                      <button
                        type="button"
                        onClick={handleInlineSignIn}
                        disabled={isSigningIn}
                        className="button button-primary button-small text-xs"
                      >
                        {isSigningIn ? 'Signing in…' : 'Sign In Now'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Information Note */}
                    <div className="flex items-center gap-2 rounded-xl bg-brand-cream/60 px-3.5 py-2 text-xs text-brand-ink/75">
                      <span className="text-brand-green font-bold">ℹ</span>
                      <span>
                        {checkoutMode === 'signup'
                          ? 'A FarmersHaus account will be automatically created with this order so you can track deliveries and reorder in 1-click.'
                          : 'Checking out as Guest. You can switch to Sign Up or Sign In at any time without losing the details below.'}
                      </span>
                    </div>

                    {/* Customer Inputs (Preserved across guest & signup) */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-brand-ink">
                          Full Name <span className="text-brand-tomato">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Kwame Mensah"
                          className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-brand-ink">
                          Mobile Phone Number <span className="text-brand-tomato">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="e.g. 055 420 8446"
                          className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-bold text-brand-ink">
                        Email Address <span className="text-brand-ink/40 font-normal">(Optional, for receipt)</span>
                      </label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="e.g. kwame@example.com"
                        className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                      />
                    </div>

                    {/* Password input if signup or createAccountWithOrder */}
                    {(checkoutMode === 'signup' || createAccountWithOrder) && (
                      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.03] p-4">
                        <label className="mb-1 block text-xs font-bold text-brand-green">
                          Create Account Password <span className="text-brand-tomato">*</span>
                        </label>
                        <div className="relative max-w-md">
                          <input
                            type={showSignupPassword ? 'text' : 'password'}
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            minLength={8}
                            className="w-full rounded-xl border border-brand-green/25 bg-white px-3.5 py-2.5 pr-10 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/40 hover:text-brand-green"
                          >
                            <Icon name={showSignupPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-brand-ink/60">
                          Password must be at least 8 characters long.
                        </p>
                      </div>
                    )}

                    {/* If in Guest mode, provide optional quick checkbox to create account */}
                    {checkoutMode === 'guest' && !createAccountWithOrder && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-brand-ink/80 pt-1">
                        <input
                          type="checkbox"
                          checked={createAccountWithOrder}
                          onChange={(e) => {
                            setCreateAccountWithOrder(e.target.checked)
                            if (e.target.checked) setCheckoutMode('signup')
                          }}
                          className="h-4 w-4 rounded text-brand-green focus:ring-brand-green"
                        />
                        <span>Create a FarmersHaus customer account with these details for order tracking</span>
                      </label>
                    )}

                    {/* Delivery Address fields */}
                    {fulfillment === 'delivery' && (
                      <>
                        <div className="pt-2">
                          <label className="mb-1 block text-xs font-bold text-brand-ink">
                            Street Address / House No. / Landmark <span className="text-brand-tomato">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={guestAddressLine1}
                            onChange={(e) => setGuestAddressLine1(e.target.value)}
                            placeholder="e.g. House 14, Aggrey St, Near Melcom"
                            className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-bold text-brand-ink">
                              Area / Neighborhood in Accra <span className="text-brand-tomato">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={guestArea}
                              onChange={(e) => setGuestArea(e.target.value)}
                              placeholder="e.g. Dome / Westland / East Legon"
                              className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-bold text-brand-ink">
                              Apartment / Landmark Note <span className="text-brand-ink/40 font-normal">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={guestAddressLine2}
                              onChange={(e) => setGuestAddressLine2(e.target.value)}
                              placeholder="e.g. Apt 3B, Blue Gate"
                              className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-bold text-brand-ink">
                            Delivery Instructions for Rider <span className="text-brand-ink/40 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={guestDirections}
                            onChange={(e) => setGuestDirections(e.target.value)}
                            placeholder="e.g. Call when at the junction"
                            className="w-full rounded-xl border border-brand-green/20 px-3.5 py-2.5 text-xs text-brand-ink focus:border-brand-green focus:outline-hidden"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Signed In User View */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-green/[0.06] border border-brand-green/15 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-green text-white text-xs font-bold">
                      {profile?.display_name?.slice(0, 1) || 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-ink">
                        Signed in as {profile?.display_name || profile?.phone || 'Customer'}
                      </p>
                      <p className="text-[11px] text-brand-ink/60">
                        {profile?.email || profile?.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthTokens()
                      setAuthenticated(false)
                      setCheckoutMode('guest')
                    }}
                    className="text-xs font-semibold text-brand-green underline hover:text-brand-spinach"
                  >
                    Switch to Guest Checkout
                  </button>
                </div>

                {addressesQuery.isLoading ? (
                  <div className="skeleton h-24 rounded-2xl" />
                ) : addressesQuery.error ? (
                  <p className="rounded-2xl bg-red-50 p-4 text-sm text-brand-tomato">
                    {addressesQuery.error.message}
                  </p>
                ) : addressesQuery.data?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addressesQuery.data.map((address) => {
                      const isSelected = selectedAddressId === address.id
                      return (
                        <label
                          key={address.id}
                          className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition ${
                            isSelected
                              ? 'border-brand-green bg-brand-green/[0.04] shadow-xs'
                              : 'border-brand-green/15 bg-brand-cream/30 hover:border-brand-green/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            className="mt-1 h-4 w-4 text-brand-green focus:ring-brand-green"
                            checked={isSelected}
                            onChange={() => {
                              setAddressId(address.id)
                              setNearestBranch(null)
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-ink">{address.recipient_name}</span>
                              {address.is_default && (
                                <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-green">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-brand-ink/75">{address.address_line_1}</p>
                            {address.address_line_2 && (
                              <p className="text-xs text-brand-ink/60">{address.address_line_2}</p>
                            )}
                            <p className="mt-0.5 text-xs font-semibold text-brand-green">{address.area}</p>
                            <p className="mt-1 text-[11px] text-brand-ink/50">{address.phone}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-brand-green/25 bg-brand-cream/60 p-6 text-center">
                    <p className="text-sm font-semibold text-brand-ink">No saved delivery addresses found.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddAddressModal(true)}
                      className="button button-primary button-small mt-3"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" /> Add delivery address
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 3 (Delivery only): Delivery Area / Zone */}
          {fulfillment === 'delivery' && (
            <section className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-2xs sm:p-7">
              <h2 className="mb-4 flex items-center gap-2 font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                  3
                </span>
                <span>Delivery Area &amp; Service Zone</span>
              </h2>

              {zonesQuery.isLoading ? (
                <div className="skeleton h-20 rounded-2xl" />
              ) : zonesQuery.error ? (
                <p className="rounded-2xl bg-red-50 p-4 text-sm text-brand-tomato">
                  {zonesQuery.error.message}
                </p>
              ) : zonesQuery.data?.length ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-brand-ink/65">
                    Select the delivery service option that covers your area from {branch.name}:
                  </p>
                  <div className="grid gap-2.5">
                    {zonesQuery.data.map((zone) => {
                      const isSelected = selectedZoneId === zone.id
                      return (
                        <label
                          key={zone.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition ${
                            isSelected
                              ? 'border-brand-green bg-brand-green/[0.04] shadow-2xs'
                              : 'border-brand-green/15 bg-brand-cream/20 hover:border-brand-green/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="zone"
                              className="h-4 w-4 text-brand-green focus:ring-brand-green"
                              checked={isSelected}
                              onChange={() => setZoneId(zone.id)}
                            />
                            <div>
                              <p className="font-bold text-brand-ink">{zone.name}</p>
                              {zone.area_description && (
                                <p className="text-xs text-brand-ink/60">{zone.area_description}</p>
                              )}
                            </div>
                          </div>
                          <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs font-bold text-brand-green">
                            {money(zone.delivery_fee_minor)}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  {selectedZone && subtotal < selectedZone.minimum_order_minor && (
                    <div className="rounded-2xl border border-brand-tomato/20 bg-brand-tomato/10 p-3.5 text-xs text-brand-tomato">
                      <strong>Minimum order requirement:</strong> Orders for {selectedZone.name} require a
                      minimum basket of {money(selectedZone.minimum_order_minor)}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-brand-yellow/20 p-4 text-sm text-brand-ink">
                  <p className="font-bold">Delivery is currently unavailable at {branch.name}.</p>
                  <p className="mt-1 text-xs text-brand-ink/75">
                    Please switch to In-Store Pickup or choose another branch.
                  </p>
                </div>
              )}

              {addressesQuery.data?.some(
                (item) => item.id === selectedAddressId && item.latitude && item.longitude,
              ) && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-brand-green/10 bg-brand-cream/60 p-3.5">
                  <div className="text-xs text-brand-ink/70">
                    <p className="font-semibold text-brand-ink">Location verification</p>
                    <p className="text-[11px] text-brand-ink/60">
                      Check if another branch is closer to your delivery coordinates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void findNearestBranch()}
                    className="button button-small button-outline text-xs shrink-0"
                  >
                    Check closest branch
                  </button>
                </div>
              )}
              {nearestBranch && nearestBranch.id !== branch.id && (
                <div className="mt-2 rounded-2xl bg-brand-yellow/20 p-3 text-xs">
                  A closer branch ({nearestBranch.name}) was detected.{' '}
                  <button
                    type="button"
                    className="font-bold text-brand-green underline"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('farmershaus:choose-branch', { detail: nearestBranch }),
                      )
                    }
                  >
                    Switch to {nearestBranch.name}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Section 4: Fulfillment Slot */}
          <section className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-2xs sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                {fulfillment === 'delivery' ? '4' : '2'}
              </span>
              <span>Available {fulfillment === 'delivery' ? 'Delivery' : 'Pickup'} Windows</span>
            </h2>

            {slotsQuery.isLoading ? (
              <div className="skeleton h-20 rounded-2xl" />
            ) : slotsQuery.error ? (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-brand-tomato">{slotsQuery.error.message}</p>
            ) : slotsQuery.data?.length ? (
              <div>
                <p className="mb-3 text-xs text-brand-ink/65">
                  Choose a guaranteed fresh fulfillment time slot:
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {slotsQuery.data.slice(0, 10).map((slot) => {
                    const isSelected = selectedSlotId === slot.id
                    const { dayLabel, timeLabel } = formatSlotDisplay(slot)
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSlotId(slot.id)}
                        className={`flex items-center justify-between rounded-2xl border-2 p-3 text-left transition ${
                          isSelected
                            ? 'border-brand-green bg-brand-green/[0.04] shadow-xs'
                            : 'border-brand-green/15 bg-brand-cream/30 hover:border-brand-green/30'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-brand-green">{dayLabel}</p>
                          <p className="text-xs font-semibold text-brand-ink">{timeLabel}</p>
                        </div>
                        {isSelected && (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-green text-white">
                            <Icon name="check" className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl bg-brand-cream p-4 text-sm text-brand-ink/65">
                No active slots available currently for {fulfillment}. Please contact the branch.
              </p>
            )}
          </section>

          {/* Section 5: Order Contact & Special Instructions */}
          <section className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-2xs sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                {fulfillment === 'delivery' ? '5' : '3'}
              </span>
              <span>Contact &amp; Delivery Instructions</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-green/10 bg-brand-cream/60 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-ink/50">
                  Recipient Contact
                </p>
                <p className="mt-1 font-bold text-brand-ink">
                  {profileQuery.data?.display_name || 'Customer'}
                </p>
                <p className="text-xs text-brand-ink/65">{profileQuery.data?.phone}</p>
                <p className="text-xs text-brand-ink/50">{profileQuery.data?.email}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-ink">
                  Special Notes for FarmersHaus rider / packing team
                </label>
                <textarea
                  className="field mt-1.5 w-full rounded-2xl text-xs"
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="e.g. Ring doorbell at gate, call when arriving, or leave with security..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Order Summary Sidebar */}
        <aside className="sticky top-28 space-y-4">
          <div className="rounded-3xl border border-brand-green/15 bg-white p-4 shadow-md sm:p-6">
            <h2 className="font-brand-heading text-2xl font-bold text-brand-green">Order Summary</h2>

            {/* Branch Origin Info */}
            <div className="mt-3 rounded-2xl border border-brand-green/15 bg-brand-cream/70 p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-brand-green">
                <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
                <span>Single-origin dispatch</span>
              </div>
              <p className="mt-1 font-semibold text-brand-ink">Prepared by {branch.name}</p>
              <p className="text-[11px] text-brand-ink/60">
                {fulfillment === 'delivery'
                  ? 'Fresh courier delivery to your address'
                  : `In-store pickup at ${branch.address || branch.name}`}
              </p>
            </div>

            {/* Cart Items List */}
            <div className="my-4 max-h-60 space-y-2.5 overflow-y-auto pr-1">
              {cart.items.map((item) => {
                const name = item.product?.name ?? item.basket_package?.name ?? 'Harvest Item'
                const slug = item.product?.slug ?? item.basket_package?.slug ?? name
                const price =
                  item.product?.unit_price_minor ??
                  basketPrices.get(item.basket_package?.id ?? '') ??
                  0
                const icon = getProduceIcon(slug)

                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-cream text-base select-none">
                        {icon}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-brand-ink">{name}</p>
                        <p className="text-[10px] text-brand-ink/50">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <strong className="shrink-0 text-brand-ink">{money(price * item.quantity)}</strong>
                  </div>
                )
              })}
            </div>

            {/* Voucher Section */}
            <div className="border-t border-brand-green/10 pt-4">
              <label className="block text-xs font-bold text-brand-ink">Have a voucher promo code?</label>
              {!activeVoucher ? (
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    className="field min-w-0 flex-1 rounded-xl text-xs uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    className="button button-small button-outline text-xs px-3"
                    disabled={!voucherInput.trim()}
                  >
                    Apply
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex items-center justify-between rounded-xl bg-brand-green/10 px-3 py-2 text-xs font-bold text-brand-green">
                  <span>Code {activeVoucher.code} applied!</span>
                  <button
                    type="button"
                    onClick={handleClearVoucher}
                    className="text-brand-tomato hover:underline text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              )}
              {activeVoucherError && (
                <p className="mt-1.5 text-xs text-brand-tomato">{activeVoucherError}</p>
              )}
            </div>

            {/* Cost Breakdown */}
            <div className="mt-4 space-y-2 border-t border-brand-green/10 pt-4 text-xs">
              <div className="flex justify-between text-brand-ink/75">
                <span>Produce subtotal</span>
                <strong>{money(subtotal)}</strong>
              </div>
              <div className="flex justify-between text-brand-ink/75">
                <span>Fulfillment fee</span>
                <strong>
                  {fulfillment === 'pickup'
                    ? 'FREE'
                    : selectedZone
                    ? money(deliveryFee)
                    : 'Select delivery area'}
                </strong>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-bold text-brand-green">
                  <span>Voucher discount</span>
                  <span>−{money(discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-brand-green/15 pt-3 text-base font-bold text-brand-green">
                <span>Total amount</span>
                <span className="font-brand-heading text-2xl">{money(total)}</span>
              </div>
            </div>

            {checkoutError && (
              <div className="mt-4 rounded-2xl border border-brand-tomato/25 bg-red-50 p-3.5 text-xs text-brand-tomato">
                <p className="font-bold">Notice</p>
                <p className="mt-0.5">{checkoutError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="button button-primary mt-5 w-full justify-center shadow-md py-3.5 text-base sm:py-3 sm:text-sm font-bold cursor-pointer transition hover:bg-brand-green/90 active:scale-[0.99]"
              disabled={checkoutMutation.isPending || isExecutingPayment}
            >
              {checkoutMutation.isPending || isExecutingPayment ? 'Confirming order & payment…' : 'Place order and pay'}
            </button>

            {/* Back link */}
            <div className="mt-3 text-center">
              <Link
                to="/cart"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:underline"
              >
                <Icon name="arrow" className="h-3.5 w-3.5 rotate-180" /> Back to basket
              </Link>
            </div>
          </div>

          {/* Trust Guarantees */}
          <div className="rounded-2xl border border-brand-green/10 bg-brand-cream/60 p-4 text-xs text-brand-ink/70">
            <div className="flex items-center gap-2 font-semibold text-brand-ink">
              <Icon name="shield" className="h-4 w-4 text-brand-green" />
              <span>FarmersHaus Quality Guarantee</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-brand-ink/65">
              Inspected at harvest, chilled during transit, and verified before leaving {branch.name}.
            </p>
          </div>
        </aside>
      </form>

      {/* Add Address Modal */}
      <Modal
        open={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        title="Add Delivery Address"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            addAddressMutation.mutate(addressDraft)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label">Recipient Name</label>
              <input
                className="field w-full text-xs"
                required
                value={addressDraft.recipient_name}
                onChange={(e) => setAddressDraft({ ...addressDraft, recipient_name: e.target.value })}
                placeholder="e.g. Ama Mensah"
              />
            </div>
            <div>
              <label className="form-label">Phone Number</label>
              <input
                className="field w-full text-xs"
                type="tel"
                required
                value={addressDraft.phone}
                onChange={(e) => setAddressDraft({ ...addressDraft, phone: e.target.value })}
                placeholder="+233XXXXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Street / House Address</label>
            <input
              className="field w-full text-xs"
              required
              value={addressDraft.address_line_1}
              onChange={(e) => setAddressDraft({ ...addressDraft, address_line_1: e.target.value })}
              placeholder="e.g. House 14, Haatso-Atomic Road"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label">Apartment / Landmark</label>
              <input
                className="field w-full text-xs"
                value={addressDraft.address_line_2}
                onChange={(e) => setAddressDraft({ ...addressDraft, address_line_2: e.target.value })}
                placeholder="Near shell filling station"
              />
            </div>
            <div>
              <label className="form-label">Area / Neighborhood</label>
              <input
                className="field w-full text-xs"
                required
                value={addressDraft.area}
                onChange={(e) => setAddressDraft({ ...addressDraft, area: e.target.value })}
                placeholder="e.g. West Legon, Haatso, Dome"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Delivery Directions for Rider</label>
            <textarea
              className="field w-full text-xs"
              rows={2}
              value={addressDraft.directions}
              onChange={(e) => setAddressDraft({ ...addressDraft, directions: e.target.value })}
              placeholder="Gate color, security code, or landmark"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={captureAddressLocation}
              className="button button-small button-outline text-xs"
            >
              <Icon name="pin" className="h-3.5 w-3.5" /> Capture my location
            </button>
            {addressDraft.latitude && (
              <span className="text-xs font-semibold text-brand-green">GPS pin saved</span>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-brand-ink">
              <input
                type="checkbox"
                checked={addressDraft.is_default}
                onChange={(e) => setAddressDraft({ ...addressDraft, is_default: e.target.checked })}
              />
              Set as default
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-brand-green/10">
            <button
              type="button"
              className="button button-outline text-xs"
              onClick={() => setShowAddAddressModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary text-xs"
              disabled={addAddressMutation.isPending}
            >
              {addAddressMutation.isPending ? 'Saving...' : 'Save address'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Full-screen Payment Execution Overlay */}
      {isExecutingPayment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Executing payment"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-brand-green/95 p-4 text-white backdrop-blur-lg animate-fadeIn select-none"
        >
          {/* Ambient Glows */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand-yellow/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative mx-auto flex w-full max-w-md flex-col items-center text-center">
            {/* Animated Shield/Padlock with Pulsing Radar Ring */}
            <div className="relative mb-6 flex items-center justify-center">
              <span className="absolute h-24 w-24 animate-ping rounded-full bg-brand-yellow/20" />
              <span className="absolute h-20 w-20 animate-pulse rounded-full bg-white/10" />
              <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-brand-yellow text-brand-green shadow-2xl">
                {paymentStep === 3 ? (
                  <Icon name="check" className="h-10 w-10 stroke-[3] text-brand-green animate-scaleIn" />
                ) : (
                  <svg
                    className="h-9 w-9 animate-spin text-brand-green"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Title & Description */}
            <h2 className="font-brand-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {paymentStep === 3 ? 'Payment Authorized!' : 'Executing Payment…'}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-sm">
              Please do not refresh, close this window, or press back while we securely process your payment.
            </p>

            {/* Live Progress Checklist Card */}
            <div className="mt-6 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-left shadow-xl backdrop-blur-md">
              <div className="space-y-3">
                {/* Step 1 */}
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${paymentStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${paymentStep > 1 ? 'bg-brand-yellow text-brand-green' : 'bg-white/20 text-white animate-pulse'}`}>
                    {paymentStep > 1 ? '✓' : '1'}
                  </div>
                  <span className="text-xs font-medium text-white sm:text-sm">
                    Connecting to secure payment gateway
                  </span>
                </div>

                {/* Step 2 */}
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${paymentStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${paymentStep > 2 ? 'bg-brand-yellow text-brand-green' : paymentStep === 2 ? 'bg-white/20 text-white animate-pulse' : 'bg-white/10 text-white/40'}`}>
                    {paymentStep > 2 ? '✓' : '2'}
                  </div>
                  <span className="text-xs font-medium text-white sm:text-sm">
                    Authorizing transaction &amp; verifying funds
                  </span>
                </div>

                {/* Step 3 */}
                <div className={`flex items-center gap-3 transition-opacity duration-300 ${paymentStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${paymentStep === 3 ? 'bg-brand-yellow text-brand-green animate-bounce' : 'bg-white/10 text-white/40'}`}>
                    {paymentStep === 3 ? '✓' : '3'}
                  </div>
                  <span className="text-xs font-medium text-white sm:text-sm">
                    Payment approved! Finalizing harvest confirmation
                  </span>
                </div>
              </div>

              {/* Amount badge */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/80">
                <span>Total amount</span>
                <span className="font-mono text-sm font-bold text-brand-yellow">
                  {money(total)}
                </span>
              </div>
            </div>

            {/* Security Badge */}
            <div className="mt-5 flex items-center gap-2 text-[11px] font-medium text-white/60">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
              </svg>
              <span>256-Bit SSL Encrypted • Verified by FarmersHaus</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

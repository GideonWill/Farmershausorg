import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  api,
  getList,
  money,
  type Address,
  type Cart,
  type CustomerOrder,
  type CustomerProfile,
  type Product,
} from '../lib/api'
import { useProducts } from '../hooks/useStoreData'
import { clearAuthTokens, getAuthTokens, saveAuthTokens } from '../lib/auth'
import { notify } from '../lib/notifications'
import { useStore } from '../stores/store'
import { Icon, Modal } from '../components/ui'
import { categoryImage, getProduceIcon } from '../lib/images'
import { addToCart } from '../lib/shopping'

type AddressDraft = Omit<Address, 'id' | 'created_at' | 'updated_at'>
const emptyAddress: AddressDraft = {
  recipient_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  area: '',
  directions: '',
  latitude: null,
  longitude: null,
  is_default: false,
}

type TabType = 'profile' | 'orders' | 'addresses' | 'wishlist'

export function AccountPage() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAuthTokens()))
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#wishlist') return 'wishlist'
      if (window.location.hash === '#orders') return 'orders'
      if (window.location.hash === '#addresses') return 'addresses'
    }
    return 'profile'
  })
  const [otpRequested, setOtpRequested] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddress)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [message, setMessage] = useState('')

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const favorites = useStore((state) => state.favorites)
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const toggleFavorite = useStore((state) => state.toggleFavorite)
  const productsQuery = useProducts()
  const products = productsQuery.data ?? []

  useEffect(() => {
    const updateAuth = () => setAuthenticated(Boolean(getAuthTokens()))
    window.addEventListener('farmershaus:auth-changed', updateAuth)
    return () => window.removeEventListener('farmershaus:auth-changed', updateAuth)
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#wishlist') setActiveTab('wishlist')
      else if (window.location.hash === '#orders') setActiveTab('orders')
      else if (window.location.hash === '#addresses') setActiveTab('addresses')
    }
    window.addEventListener('hashchange', onHashChange)
    if (window.location.hash) {
      const el = document.getElementById('account-tabs-section')
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 120)
      }
    }
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CustomerProfile>('/me/'),
    enabled: authenticated,
    retry: false,
  })

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => getList(await api<Address[] | { results: Address[] }>('/addresses/')),
    enabled: authenticated,
  })

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: () => api<CustomerOrder[]>('/orders/'),
    enabled: authenticated,
  })

  const authenticateMutation = useMutation({
    mutationFn: async (payload: { endpoint: string; body: Record<string, string> }) =>
      api<{ access: string; refresh: string }>(payload.endpoint, {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify(payload.body),
      }),
    onSuccess: async (tokens) => {
      saveAuthTokens(tokens)
      setAuthenticated(true)
      setOtpRequested(false)
      setOtpCode('')
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries()
      notify('Welcome to FarmersHaus!', 'success')
      if (searchParams.get('next') === '/checkout') {
        navigate('/checkout')
      }
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Sign in failed.', 'error'),
  })

  const requestOtpMutation = useMutation({
    mutationFn: () =>
      api<{ detail: string }>('/auth/otp/request/', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }),
    onSuccess: (result) => {
      setOtpRequested(true)
      notify(result.detail, 'info')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Could not request a sign-in code.', 'error'),
  })

  const registerMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      api<CustomerProfile>('/auth/register/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setMode('login')
      setMessage(
        'Your FarmersHaus account is ready! Please sign in with your phone and password.',
      )
      notify('Account created successfully.', 'success')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Could not create your account.', 'error'),
  })

  const updateProfileMutation = useMutation({
    mutationFn: (body: Partial<CustomerProfile>) =>
      api<CustomerProfile>('/me/', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      notify('Profile details updated.', 'success')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Profile update failed.', 'error'),
  })

  const saveAddressMutation = useMutation({
    mutationFn: () =>
      api<Address>(editingAddress ? `/addresses/${editingAddress}/` : '/addresses/', {
        method: editingAddress ? 'PATCH' : 'POST',
        body: JSON.stringify(addressDraft),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      setAddressDraft(emptyAddress)
      setEditingAddress(null)
      setAddressFormOpen(false)
      notify('Address saved successfully.', 'success')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Address could not be saved.', 'error'),
  })

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) => api(`/addresses/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      notify('Address removed.', 'info')
    },
    onError: (error) =>
      notify(error instanceof Error ? error.message : 'Address could not be removed.', 'error'),
  })

  const reorderMutation = useMutation({
    mutationFn: async (order: CustomerOrder) => {
      if (!branch) throw new Error('Choose a branch before rebuilding an order.')
      const matched = order.lines.map((line) => ({
        line,
        product: products.find(
          (candidate) => candidate.name.toLowerCase() === line.name_snapshot.toLowerCase(),
        ),
      }))
      const available = matched.filter(
        (item): item is { line: CustomerOrder['lines'][number]; product: Product } =>
          Boolean(item.product?.branch_availability.is_available),
      )
      if (!available.length) {
        throw new Error('No matching items from this order are available at the selected branch.')
      }
      await Promise.all(
        available.map(({ line, product }) =>
          api<Cart>('/cart/items/', {
            method: 'POST',
            cartSessionKey,
            body: JSON.stringify({
              branch_id: branch.id,
              product_id: product.id,
              quantity: line.quantity,
            }),
          }),
        ),
      )
      return matched
        .filter(({ product }) => !product?.branch_availability.is_available)
        .map(({ line }) => line.name_snapshot)
    },
    onSuccess: async (unavailable) => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify(
        unavailable.length
          ? `Available products added. Not available at this branch: ${unavailable.join(', ')}.`
          : 'Items added to your basket.',
        unavailable.length ? 'info' : 'success',
      )
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify(error instanceof Error ? error.message : 'This order could not be rebuilt.', 'error')
    },
  })

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    authenticateMutation.mutate({
      endpoint: '/auth/token/',
      body: { identifier, password: String(form.get('password') ?? '') },
    })
  }

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const phone = String(form.get('phone') ?? '').trim()
    const displayName = String(form.get('display_name') ?? '').trim()
    registerMutation.mutate({
      username: phone,
      phone,
      display_name: displayName,
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
  }

  function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    authenticateMutation.mutate({
      endpoint: '/auth/otp/verify/',
      body: { identifier, code: otpCode },
    })
  }

  function captureAddressLocation() {
    if (!navigator.geolocation) {
      notify('Location is not available in this browser.', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setAddressDraft((current) => ({
          ...current,
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
        })),
      () => notify('Location permission was not granted.', 'error'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  function signOut() {
    clearAuthTokens()
    setAuthenticated(false)
    void queryClient.clear()
    notify('You have signed out.', 'info')
  }

  // Get initials for profile avatar
  const profileName = profileQuery.data?.display_name || 'Member'
  const initials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || 'FH'

  // If not authenticated, render the classy login & registration experience
  if (!authenticated) {
    return (
      <div className="section-wrap min-h-[65vh]">
        <div className="mx-auto max-w-lg rounded-3xl border border-brand-green/15 bg-white p-6 shadow-lg sm:p-10">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-green/10 text-brand-green">
              <Icon name="user" className="h-7 w-7" />
            </div>
            <p className="eyebrow mt-4">Welcome to FarmersHaus</p>
            <h1 className="font-brand-heading text-2xl font-bold text-brand-green sm:text-3xl">
              {mode === 'login' ? 'Sign In to Your Account' : 'Create an Account'}
            </h1>
            <p className="mt-2 text-xs leading-5 text-brand-ink/65 sm:text-sm">
              Manage saved addresses, track farm-fresh deliveries, and enjoy single-tap checkout.
            </p>
          </div>

          <div className="mt-6 flex rounded-2xl bg-brand-cream/70 p-1">
            <button
              type="button"
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-white text-brand-green shadow-xs'
                  : 'text-brand-ink/60 hover:text-brand-green'
              }`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                mode === 'register'
                  ? 'bg-white text-brand-green shadow-xs'
                  : 'text-brand-ink/60 hover:text-brand-green'
              }`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-brand-green/10 p-3 text-xs text-brand-green">
              {message}
            </div>
          )}

          {mode === 'login' ? (
            <div className="mt-6 space-y-4">
              <form onSubmit={submitLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-brand-ink">
                    Phone, Email or Username
                  </label>
                  <input
                    className="field mt-1.5 w-full rounded-2xl text-xs"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    required
                    placeholder="+233500000001 or demo-customer"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-ink">Password</label>
                  <input
                    className="field mt-1.5 w-full rounded-2xl text-xs"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  className="button button-primary w-full justify-center py-2.5 text-xs shadow-md"
                  disabled={authenticateMutation.isPending}
                >
                  {authenticateMutation.isPending ? 'Signing in…' : 'Sign in to FarmersHaus'}
                </button>
              </form>

              <div className="border-t border-brand-green/10 pt-4">
                {!otpRequested ? (
                  <button
                    type="button"
                    className="button button-outline w-full justify-center text-xs"
                    disabled={!identifier || authenticateMutation.isPending}
                    onClick={() => requestOtpMutation.mutate()}
                  >
                    Send a one-time sign-in code
                  </button>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-3">
                    <p className="text-xs text-brand-ink/70">
                      Enter the 6-digit verification code sent to your account.
                    </p>
                    <input
                      className="field w-full rounded-2xl text-center text-sm font-bold tracking-widest"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value)}
                      placeholder="000000"
                      required
                    />
                    <button
                      type="submit"
                      className="button button-primary w-full justify-center text-xs"
                      disabled={authenticateMutation.isPending}
                    >
                      Verify and sign in
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={submitRegister} className="mt-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-brand-ink">Full Name</label>
                <input
                  className="field mt-1.5 w-full rounded-2xl text-xs"
                  name="display_name"
                  required
                  placeholder="e.g. Ama Mensah"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-ink">Phone Number</label>
                <input
                  className="field mt-1.5 w-full rounded-2xl text-xs"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+233XXXXXXXXX"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-ink">Email (Optional)</label>
                <input
                  className="field mt-1.5 w-full rounded-2xl text-xs"
                  name="email"
                  type="email"
                  placeholder="ama@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-ink">Create Password</label>
                <input
                  className="field mt-1.5 w-full rounded-2xl text-xs"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                className="button button-primary w-full justify-center py-2.5 text-xs shadow-md"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Creating account…' : 'Create My Account'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-brand-ink/60">
            Just browsing?{' '}
            <Link to="/shop" className="font-bold text-brand-green hover:underline">
              Shop as a guest
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Authenticated State: Classy Customer Dashboard
  return (
    <div className="section-wrap min-h-[75vh]">
      {/* Hero Customer Banner */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-r from-brand-green via-[#0c4a34] to-[#073022] p-4 text-white shadow-xl sm:rounded-[2.2rem] sm:p-9">
        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-yellow/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-1/4 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-brand-yellow/40 bg-white/10 text-xl font-bold text-brand-yellow shadow-inner sm:h-20 sm:w-20 sm:text-3xl">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="font-brand-heading text-xl font-bold tracking-tight text-white sm:text-3xl">
                  Welcome back, {profileName.split(' ')[0]}!
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-yellow/20 px-2 py-0.5 text-[9px] font-bold text-brand-yellow sm:text-[10px] sm:px-2.5">
                  <Icon name="badgeCheck" className="h-3 w-3" /> Verified Member
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-white/75 sm:text-sm">
                {profileQuery.data?.phone} {profileQuery.data?.email ? `· ${profileQuery.data.email}` : ''}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/60">
                <Icon name="pin" className="h-3 w-3 text-brand-yellow" />
                <span>Preferred: {branch?.name?.replace('FarmersHaus ', '') ?? 'Westland'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95 sm:px-4 sm:py-2"
          >
            <span>Sign out</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-2 sm:gap-3 border-t border-white/15 pt-5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left backdrop-blur-xs transition hover:bg-white/10"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/60">Total Orders</p>
            <p className="mt-0.5 text-xl font-bold text-white">
              {ordersQuery.data?.length ?? 0}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('addresses')}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left backdrop-blur-xs transition hover:bg-white/10"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/60">Saved Addresses</p>
            <p className="mt-0.5 text-xl font-bold text-white">
              {addressesQuery.data?.length ?? 0}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left backdrop-blur-xs transition hover:bg-white/10"
          >
            <p className="text-[10px] uppercase tracking-wider text-white/60">Wishlist Items</p>
            <p className="mt-0.5 text-xl font-bold text-brand-yellow">
              {favorites.length}
            </p>
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Farm Guarantee</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-300">100% Single Origin</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div id="account-tabs-section" className="mb-6 flex gap-2 border-b border-brand-green/15 pb-2 overflow-x-auto scrollbar-none whitespace-nowrap -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 ${
            activeTab === 'profile'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-ink/70 hover:bg-brand-green/10 hover:text-brand-green'
          }`}
        >
          <Icon name="user" className="h-4 w-4" />
          <span>Profile Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 ${
            activeTab === 'orders'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-ink/70 hover:bg-brand-green/10 hover:text-brand-green'
          }`}
        >
          <Icon name="package" className="h-4 w-4" />
          <span>My Orders</span>
          {ordersQuery.data?.length ? (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'orders' ? 'bg-white text-brand-green' : 'bg-brand-green/15 text-brand-green'
              }`}
            >
              {ordersQuery.data.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('addresses')}
          className={`shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 ${
            activeTab === 'addresses'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-ink/70 hover:bg-brand-green/10 hover:text-brand-green'
          }`}
        >
          <Icon name="pin" className="h-4 w-4" />
          <span>Saved Addresses</span>
          {addressesQuery.data?.length ? (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'addresses'
                  ? 'bg-white text-brand-green'
                  : 'bg-brand-green/15 text-brand-green'
              }`}
            >
              {addressesQuery.data.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wishlist')}
          className={`shrink-0 flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition sm:px-4 sm:py-2.5 ${
            activeTab === 'wishlist'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-ink/70 hover:bg-brand-green/10 hover:text-brand-green'
          }`}
        >
          <Icon name="heart" className="h-4 w-4 text-brand-tomato" />
          <span>Wishlist</span>
          {favorites.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'wishlist'
                  ? 'bg-brand-tomato text-white'
                  : 'bg-brand-tomato/15 text-brand-tomato'
              }`}
            >
              {favorites.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Profile Details */}
      {activeTab === 'profile' && (
        <section className="space-y-6">
          <div className="rounded-3xl border border-brand-green/15 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                Personal Information
              </h2>
              <p className="mt-1 text-xs text-brand-ink/60">
                Update your contact details so our packing team and riders can keep you informed.
              </p>
            </div>

            {profileQuery.isLoading ? (
              <div className="skeleton h-36 rounded-2xl" />
            ) : profileQuery.error ? (
              <p className="rounded-2xl bg-red-50 p-4 text-xs text-brand-tomato">
                {profileQuery.error.message}
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  updateProfileMutation.mutate({
                    display_name: String(form.get('display_name') ?? ''),
                    email: String(form.get('email') ?? ''),
                    phone: String(form.get('phone') ?? ''),
                  })
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-brand-ink">Full Name</label>
                    <input
                      className="field mt-1.5 w-full rounded-2xl text-xs"
                      name="display_name"
                      defaultValue={profileQuery.data?.display_name}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-ink">Primary Phone</label>
                    <input
                      className="field mt-1.5 w-full rounded-2xl text-xs"
                      name="phone"
                      type="tel"
                      defaultValue={profileQuery.data?.phone}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-ink">Email Address</label>
                  <input
                    className="field mt-1.5 w-full rounded-2xl text-xs"
                    name="email"
                    type="email"
                    defaultValue={profileQuery.data?.email}
                  />
                  <p className="mt-1 text-[11px] text-brand-ink/50">
                    Used for order receipts and digital delivery confirmations.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="button button-primary text-xs shadow-md"
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? 'Saving changes…' : 'Save profile changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-3xl border border-brand-green/10 bg-brand-cream/60 p-6 text-xs text-brand-ink/75 sm:p-7">
            <h3 className="flex items-center gap-2 font-bold text-brand-green">
              <Icon name="shield" className="h-4 w-4" /> FarmersHaus Privacy &amp; Order Guarantee
            </h3>
            <p className="mt-1.5 text-[11px] leading-5 text-brand-ink/65">
              Your profile is private and only used to prepare, dispatch, and track your fresh grocery orders.
              We never share customer phone numbers or delivery addresses with third parties.
            </p>
          </div>
        </section>
      )}

      {/* Tab 2: Orders & Deliveries */}
      {activeTab === 'orders' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                Order History &amp; Receipts
              </h2>
              <p className="mt-0.5 text-xs text-brand-ink/60">
                Track previous harvests and easily reorder your kitchen staples.
              </p>
            </div>
            <Link to="/shop" className="button button-small button-outline text-xs">
              Shop more produce
            </Link>
          </div>

          {ordersQuery.isLoading ? (
            <div className="space-y-3">
              <div className="skeleton h-32 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          ) : ordersQuery.error ? (
            <p className="rounded-2xl bg-red-50 p-4 text-xs text-brand-tomato">
              {ordersQuery.error.message}
            </p>
          ) : ordersQuery.data?.length ? (
            <div className="space-y-3.5">
              {ordersQuery.data.map((order) => {
                const isDelivered = order.status === 'delivered'
                const statusColor = isDelivered
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-brand-yellow/25 text-brand-green'

                return (
                  <article
                    key={order.id}
                    className="rounded-3xl border border-brand-green/15 bg-white p-5 shadow-xs transition hover:border-brand-green/30 sm:p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-brand-green/10 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand-ink">Order #{order.order_number}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}
                          >
                            {order.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-brand-ink/55">
                          {new Date(order.created_at).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          · Dispatched from {order.branch_snapshot.name}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          className="button button-small button-outline text-xs flex-1 sm:flex-initial justify-center"
                          disabled={
                            reorderMutation.isPending ||
                            productsQuery.isLoading ||
                            Boolean(productsQuery.error)
                          }
                          onClick={() => reorderMutation.mutate(order)}
                          title="Add available items from this order to current cart"
                        >
                          Reorder basket
                        </button>
                        <Link
                          to={`/orders/${order.order_number}`}
                          className="button button-small button-primary text-xs flex-1 sm:flex-initial justify-center text-center"
                        >
                          View receipt
                        </Link>
                      </div>
                    </div>

                    <div className="pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brand-ink/50">
                        Order Items
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {order.lines.map((line) => (
                          <span
                            key={line.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-cream/70 px-2.5 py-1 text-xs text-brand-ink/80"
                          >
                            <span className="select-none">{getProduceIcon(line.name_snapshot)}</span>
                            <span>{line.name_snapshot}</span>
                            <strong className="text-brand-green">&times; {line.quantity}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-brand-green/20 bg-brand-cream/60 p-10 text-center">
              <span className="text-4xl">🧺</span>
              <p className="mt-3 font-brand-heading text-lg font-bold text-brand-green">
                No orders placed yet
              </p>
              <p className="mt-1 text-xs text-brand-ink/65">
                When you place an order, its receipt, live tracking, and reorder button will appear here.
              </p>
              <Link to="/shop" className="button button-primary mt-5 inline-flex text-xs">
                Explore Farm Shelves
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Saved Addresses */}
      {activeTab === 'addresses' && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                Saved Delivery Addresses
              </h2>
              <p className="mt-0.5 text-xs text-brand-ink/60">
                Speed up your checkout by keeping your home, work, and family addresses ready.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null)
                setAddressDraft(emptyAddress)
                setAddressFormOpen(true)
              }}
              className="button button-small button-primary text-xs"
            >
              <Icon name="plus" className="h-3.5 w-3.5" /> Add address
            </button>
          </div>

          {addressesQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="skeleton h-28 rounded-2xl" />
              <div className="skeleton h-28 rounded-2xl" />
            </div>
          ) : addressesQuery.error ? (
            <p className="rounded-2xl bg-red-50 p-4 text-xs text-brand-tomato">
              {addressesQuery.error.message}
            </p>
          ) : addressesQuery.data?.length ? (
            <div className="grid gap-3.5 sm:grid-cols-2">
              {addressesQuery.data.map((address) => (
                <article
                  key={address.id}
                  className="relative flex flex-col justify-between rounded-3xl border border-brand-green/15 bg-white p-5 shadow-xs transition hover:border-brand-green/30"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-green/10 text-brand-green">
                          <Icon name="pin" className="h-3.5 w-3.5" />
                        </span>
                        <h3 className="font-bold text-brand-ink">{address.recipient_name}</h3>
                      </div>
                      {address.is_default && (
                        <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-green">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-brand-ink/80">{address.address_line_1}</p>
                    {address.address_line_2 && (
                      <p className="text-xs text-brand-ink/60">{address.address_line_2}</p>
                    )}
                    <p className="mt-0.5 text-xs font-semibold text-brand-green">{address.area}</p>
                    <p className="mt-1 text-[11px] text-brand-ink/50">{address.phone}</p>
                    {address.directions && (
                      <p className="mt-1 text-[11px] italic text-brand-ink/60">
                        &ldquo;{address.directions}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-brand-green/10 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(address.id)
                        setAddressDraft({
                          recipient_name: address.recipient_name,
                          phone: address.phone,
                          address_line_1: address.address_line_1,
                          address_line_2: address.address_line_2,
                          area: address.area,
                          directions: address.directions,
                          latitude: address.latitude,
                          longitude: address.longitude,
                          is_default: address.is_default,
                        })
                        setAddressFormOpen(true)
                      }}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-brand-ink/70 hover:bg-brand-green/10 hover:text-brand-green"
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAddressMutation.mutate(address.id)}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-brand-tomato hover:bg-brand-tomato/10"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-brand-green/20 bg-brand-cream/60 p-10 text-center">
              <span className="text-4xl">📍</span>
              <p className="mt-3 font-brand-heading text-lg font-bold text-brand-green">
                No saved addresses yet
              </p>
              <p className="mt-1 text-xs text-brand-ink/65">
                Save your home or office address to make ordering hassle-free.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingAddress(null)
                  setAddressDraft(emptyAddress)
                  setAddressFormOpen(true)
                }}
                className="button button-primary mt-4 text-xs"
              >
                Add new address
              </button>
            </div>
          )}

          {/* Address Modal */}
          <Modal
            open={addressFormOpen}
            onClose={() => {
              setAddressFormOpen(false)
              setEditingAddress(null)
            }}
            title={editingAddress ? 'Edit Address' : 'Add New Address'}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveAddressMutation.mutate()
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">Recipient Name</label>
                  <input
                    className="field w-full text-xs"
                    required
                    value={addressDraft.recipient_name}
                    onChange={(e) =>
                      setAddressDraft({ ...addressDraft, recipient_name: e.target.value })
                    }
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
                    onChange={(e) =>
                      setAddressDraft({ ...addressDraft, phone: e.target.value })
                    }
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
                  onChange={(e) =>
                    setAddressDraft({ ...addressDraft, address_line_1: e.target.value })
                  }
                  placeholder="e.g. House 14, Haatso-Atomic Road"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">Apartment / Landmark</label>
                  <input
                    className="field w-full text-xs"
                    value={addressDraft.address_line_2}
                    onChange={(e) =>
                      setAddressDraft({ ...addressDraft, address_line_2: e.target.value })
                    }
                    placeholder="Near shell filling station"
                  />
                </div>
                <div>
                  <label className="form-label">Area / Neighborhood</label>
                  <input
                    className="field w-full text-xs"
                    required
                    value={addressDraft.area}
                    onChange={(e) =>
                      setAddressDraft({ ...addressDraft, area: e.target.value })
                    }
                    placeholder="e.g. West Legon, Haatso, Dome"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Directions for Courier</label>
                <textarea
                  className="field w-full text-xs"
                  rows={2}
                  value={addressDraft.directions}
                  onChange={(e) =>
                    setAddressDraft({ ...addressDraft, directions: e.target.value })
                  }
                  placeholder="Gate color, security code, or landmark"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={captureAddressLocation}
                  className="button button-small button-outline text-xs"
                >
                  <Icon name="pin" className="h-3.5 w-3.5" /> Capture location pin
                </button>
                {addressDraft.latitude && (
                  <span className="text-xs font-semibold text-brand-green">GPS coordinates saved</span>
                )}
                <label className="flex items-center gap-2 text-xs font-semibold text-brand-ink">
                  <input
                    type="checkbox"
                    checked={addressDraft.is_default}
                    onChange={(e) =>
                      setAddressDraft({ ...addressDraft, is_default: e.target.checked })
                    }
                  />
                  Set as default
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-brand-green/10">
                <button
                  type="button"
                  className="button button-outline text-xs"
                  onClick={() => {
                    setAddressFormOpen(false)
                    setEditingAddress(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary text-xs"
                  disabled={saveAddressMutation.isPending}
                >
                  {saveAddressMutation.isPending ? 'Saving...' : 'Save address'}
                </button>
              </div>
            </form>
          </Modal>
        </section>
      )}

      {/* Tab 4: Wishlist / Saved Items */}
      {activeTab === 'wishlist' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-brand-heading text-xl font-bold text-brand-green sm:text-2xl">
                My Saved Wishlist
              </h2>
              <p className="mt-0.5 text-xs text-brand-ink/60">
                Favorite items saved on this device for quick shopping across visits.
              </p>
            </div>
            {favorites.length > 0 && (
              <span className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold text-brand-green">
                {favorites.length} saved item{favorites.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {favorites.length ? (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((id) => {
                const product = products.find((item) => item.id === id)
                return (
                  <article
                    key={id}
                    className="relative flex items-center gap-3.5 rounded-3xl border border-brand-green/15 bg-white p-3.5 shadow-2xs transition hover:border-brand-green/30"
                  >
                    {product ? (
                      <>
                        <Link
                          to={`/product/${product.slug}`}
                          className="shrink-0 overflow-hidden rounded-2xl bg-brand-cream/60"
                        >
                          <img
                            src={product.image_url || categoryImage(product.category)}
                            alt={product.name}
                            className="h-20 w-20 object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            className="block truncate font-bold text-brand-green hover:underline text-sm"
                            to={`/product/${product.slug}`}
                          >
                            {product.name}
                          </Link>
                          <p className="mt-0.5 text-xs font-bold text-brand-ink/80">
                            {money(
                              product.branch_availability?.price_minor ?? product.base_price_minor,
                            )}
                            <span className="ml-1 text-[11px] font-normal text-brand-ink/50">
                              / {product.unit}
                            </span>
                          </p>
                          <p
                            className={`mt-0.5 text-[11px] font-semibold ${
                              product.branch_availability?.is_available
                                ? 'text-emerald-700'
                                : 'text-brand-tomato'
                            }`}
                          >
                            {product.branch_availability?.is_available
                              ? 'In stock at current branch'
                              : 'Check availability'}
                          </p>
                          {product.branch_availability?.is_available && (
                            <button
                              type="button"
                              onClick={(e) =>
                                addToCart(
                                  product,
                                  branch,
                                  cartSessionKey,
                                  queryClient,
                                  setCartDrawerOpen,
                                  e,
                                )
                              }
                              className="mt-2 button button-small button-primary text-[11px] px-2.5 py-1"
                            >
                              Add to basket +
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-brand-ink/60">
                          This product is no longer in the active catalogue.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      className="icon-button shrink-0 self-start text-brand-tomato hover:bg-brand-tomato/10"
                      aria-label="Remove from wishlist"
                      onClick={() => toggleFavorite(id)}
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-brand-green/20 bg-brand-cream/60 p-10 text-center">
              <span className="text-4xl">💚</span>
              <p className="mt-3 font-brand-heading text-lg font-bold text-brand-green">
                Your wishlist is empty
              </p>
              <p className="mt-1 text-xs text-brand-ink/65">
                Tap the heart on any fruit or vegetable card while shopping to save it here for later.
              </p>
              <Link to="/shop" className="button button-primary mt-4 inline-flex text-xs">
                Explore Fresh Harvest
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

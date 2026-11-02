import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, getList, money, type Address, type Cart, type CustomerOrder, type CustomerProfile, type Product } from '../lib/api'
import { useProducts } from '../hooks/useStoreData'
import { clearAuthTokens, getAuthTokens, saveAuthTokens } from '../lib/auth'
import { notify } from '../lib/notifications'
import { useStore } from '../stores/store'
import { Icon } from '../components/ui'
import { categoryImage } from '../lib/images'
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

export function AccountPage() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAuthTokens()))
  const [mode, setMode] = useState<'login' | 'register'>('login')
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
    if (window.location.hash === '#wishlist') {
      const el = document.getElementById('wishlist')
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 120)
      }
    }
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

  const authenticate = useMutation({
    mutationFn: async (payload: { endpoint: string; body: Record<string, string> }) =>
      api<{ access: string; refresh: string }>(payload.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload.body),
      }),
    onSuccess: (tokens) => {
      saveAuthTokens(tokens)
      setAuthenticated(true)
      if (searchParams.get('next') === '/checkout') navigate('/checkout')
      setOtpRequested(false)
      setOtpCode('')
      void queryClient.invalidateQueries()
      notify('You’re signed in to FarmersHaus.', 'success')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Sign in failed.', 'error'),
  })
  const requestOtpMutation = useMutation({
    mutationFn: () => api<{ detail: string }>('/auth/otp/request/', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),
    onSuccess: (result) => {
      setOtpRequested(true)
      notify(result.detail, 'info')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Could not request a sign-in code.', 'error'),
  })

  const register = useMutation({
    mutationFn: (body: Record<string, string>) => api<CustomerProfile>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      setMode('login')
      setMessage('Your account is ready. Sign in with your phone and password or request a one-time code.')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Could not create your account.', 'error'),
  })

  const updateProfile = useMutation({
    mutationFn: (body: Partial<CustomerProfile>) => api<CustomerProfile>('/me/', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      notify('Profile saved.', 'success')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Profile update failed.', 'error'),
  })

  const saveAddress = useMutation({
    mutationFn: () => api<Address>(editingAddress ? `/addresses/${editingAddress}/` : '/addresses/', {
      method: editingAddress ? 'PATCH' : 'POST',
      body: JSON.stringify(addressDraft),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['addresses'] })
      setAddressDraft(emptyAddress)
      setEditingAddress(null)
      setAddressFormOpen(false)
      notify('Address saved.', 'success')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Address could not be saved.', 'error'),
  })
  const deleteAddress = useMutation({
    mutationFn: (id: string) => api(`/addresses/${id}/`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['addresses'] }),
    onError: (error) => notify(error instanceof Error ? error.message : 'Address could not be removed.', 'error'),
  })
  const reorder = useMutation({
    mutationFn: async (order: CustomerOrder) => {
      if (!branch) throw new Error('Choose a branch before rebuilding an order.')
      const matched = order.lines.map((line) => ({
        line,
        product: products.find((candidate) => candidate.name.toLowerCase() === line.name_snapshot.toLowerCase()),
      }))
      const available = matched.filter((item): item is { line: CustomerOrder['lines'][number]; product: Product } =>
        Boolean(item.product?.branch_availability.is_available),
      )
      if (!available.length) throw new Error('No matching items from this order are available at the selected branch.')
      await Promise.all(available.map(({ line, product }) => api<Cart>('/cart/items/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity: line.quantity }),
      })))
      return matched.filter(({ product }) => !product?.branch_availability.is_available).map(({ line }) => line.name_snapshot)
    },
    onSuccess: async (unavailable) => {
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      setCartDrawerOpen(true)
      notify(unavailable.length ? `Available products added. Not available at this branch: ${unavailable.join(', ')}.` : 'Available order items added to your cart.', unavailable.length ? 'info' : 'success')
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify(error instanceof Error ? error.message : 'This order could not be rebuilt.', 'error')
    },
  })

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    authenticate.mutate({
      endpoint: '/auth/token/',
      body: { identifier, password: String(form.get('password') ?? '') },
    })
  }

  function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const phone = String(form.get('phone') ?? '').trim()
    const displayName = String(form.get('display_name') ?? '').trim()
    register.mutate({
      username: phone,
      phone,
      display_name: displayName,
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
  }

  function requestOtp() {
    requestOtpMutation.mutate()
  }

  function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    authenticate.mutate({
      endpoint: '/auth/otp/verify/',
      body: { identifier, code: otpCode },
    })
  }

  function captureAddressLocation() {
    if (!navigator.geolocation) {
      notify('Location is not available in this browser. Enter the address manually.', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setAddressDraft((current) => ({
        ...current,
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
      })),
      () => notify('Location permission was not granted. You can enter the address manually.', 'error'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  function signOut() {
    clearAuthTokens()
    setAuthenticated(false)
    void queryClient.clear()
  }

  if (!authenticated) {
    return (
      <div className="section-wrap min-h-[65vh]">
        <div className="mx-auto max-w-xl">
          <p className="eyebrow">Your FarmersHaus</p>
          <h1 className="section-title">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
          <p className="mt-3 leading-7 text-brand-ink/65">
            Sign in to manage saved addresses, check orders, and continue to secure checkout.
          </p>
          <div className="mt-7 flex gap-2 border-b border-brand-green/10">
            <button className={`account-tab ${mode === 'login' ? 'account-tab--active' : ''}`} onClick={() => setMode('login')}>Sign in</button>
            <button className={`account-tab ${mode === 'register' ? 'account-tab--active' : ''}`} onClick={() => setMode('register')}>Create account</button>
          </div>
          {message && <p className="mt-4 bg-brand-cream p-4 text-sm leading-6">{message}</p>}
          {mode === 'login' ? (
            <div className="mt-6 space-y-5">
              <form onSubmit={submitLogin} className="space-y-4">
                <label className="form-label">Phone, email or username
                  <input className="field w-full" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" />
                </label>
                <label className="form-label">Password
                  <input className="field w-full" name="password" type="password" required autoComplete="current-password" />
                </label>
                <button className="button button-primary w-full" disabled={authenticate.isPending}>Sign in</button>
              </form>
              <div className="border-t border-brand-green/10 pt-5">
                {!otpRequested ? (
                  <button className="button button-outline w-full" disabled={!identifier || authenticate.isPending} onClick={requestOtp}>Send a one-time code</button>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-3">
                    <p className="text-sm leading-6 text-brand-ink/65">Enter the 6-digit code sent to your account.</p>
                    <label className="form-label">One-time code
                      <input className="field w-full" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value)} required />
                    </label>
                    <button className="button button-primary w-full" disabled={authenticate.isPending}>Verify and sign in</button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={submitRegister} className="mt-6 space-y-4">
              <label className="form-label">Full name<input className="field w-full" name="display_name" required autoComplete="name" /></label>
              <label className="form-label">Phone<input className="field w-full" name="phone" type="tel" required autoComplete="tel" /></label>
              <label className="form-label">Email (optional)<input className="field w-full" name="email" type="email" autoComplete="email" /></label>
              <label className="form-label">Create password<input className="field w-full" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
              <button className="button button-primary w-full" disabled={register.isPending}>Create account</button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-brand-ink/60">Want to keep browsing? <Link to="/shop" className="font-bold text-brand-green">Shop as a guest</Link></p>
        </div>
      </div>
    )
  }

  return (
    <div className="section-wrap">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Your FarmersHaus</p><h1 className="section-title">My account</h1></div>
        <button className="button button-outline" onClick={signOut}>Sign out</button>
      </div>

      {profileQuery.isLoading ? <div className="skeleton h-28" />
        : profileQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{profileQuery.error.message}</p>
          : profileQuery.data && (
            <form
              className="account-panel mb-8 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                updateProfile.mutate({
                  display_name: String(form.get('display_name') ?? ''),
                  email: String(form.get('email') ?? ''),
                  phone: String(form.get('phone') ?? ''),
                })
              }}
            >
              <h2 className="account-panel__title sm:col-span-2">Profile details</h2>
              <label className="form-label">Full name<input className="field w-full" name="display_name" defaultValue={profileQuery.data.display_name} /></label>
              <label className="form-label">Phone<input className="field w-full" name="phone" defaultValue={profileQuery.data.phone} /></label>
              <label className="form-label sm:col-span-2">Email<input className="field w-full" name="email" type="email" defaultValue={profileQuery.data.email} /></label>
              <button className="button button-primary sm:col-span-2" disabled={updateProfile.isPending}>Save profile</button>
            </form>
          )}

      <section className="mb-10" aria-labelledby="saved-addresses-title">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="saved-addresses-title">Saved addresses</h2>
          <button className="button button-outline button-small" onClick={() => { setEditingAddress(null); setAddressDraft(emptyAddress); setAddressFormOpen(true) }}>Add address</button>
        </div>
        {addressesQuery.isLoading ? <div className="skeleton h-20" />
          : addressesQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{addressesQuery.error.message}</p>
            : addressesQuery.data?.length ? (
              <div className="grid gap-3 md:grid-cols-2">{addressesQuery.data.map((address) => (
                <article className="account-address" key={address.id}>
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-bold">{address.recipient_name}</h3>{address.is_default && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green">Default</span>}</div><p className="mt-1 text-sm text-brand-ink/65">{address.address_line_1}, {address.area}</p><p className="mt-1 text-xs text-brand-ink/55">{address.phone}</p></div>
                  <div className="flex shrink-0 gap-1"><button className="icon-button" aria-label={`Edit ${address.address_line_1}`} onClick={() => { setEditingAddress(address.id); setAddressDraft({ recipient_name: address.recipient_name, phone: address.phone, address_line_1: address.address_line_1, address_line_2: address.address_line_2, area: address.area, directions: address.directions, latitude: address.latitude, longitude: address.longitude, is_default: address.is_default }); setAddressFormOpen(true) }}><Icon name="user" /></button><button className="icon-button text-brand-tomato" aria-label={`Delete ${address.address_line_1}`} onClick={() => deleteAddress.mutate(address.id)}><Icon name="close" /></button></div>
                </article>
              ))}</div>
            ) : <p className="bg-brand-cream p-5 text-sm text-brand-ink/65">No saved addresses yet. Add one to speed up checkout.</p>}

        {addressFormOpen && (
          <form
            className="account-panel mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => { event.preventDefault(); saveAddress.mutate() }}
          >
            <div className="flex items-center justify-between sm:col-span-2"><h3 className="account-panel__title">{editingAddress ? 'Edit address' : 'New address'}</h3><button className="text-sm text-brand-ink/60" type="button" onClick={() => { setAddressFormOpen(false); setEditingAddress(null); setAddressDraft(emptyAddress) }}>Close</button></div>
            <label className="form-label">Recipient name<input className="field w-full" value={addressDraft.recipient_name} onChange={(event) => setAddressDraft({ ...addressDraft, recipient_name: event.target.value })} required /></label>
            <label className="form-label">Phone<input className="field w-full" type="tel" value={addressDraft.phone} onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })} required /></label>
            <label className="form-label sm:col-span-2">Address<input className="field w-full" value={addressDraft.address_line_1} onChange={(event) => setAddressDraft({ ...addressDraft, address_line_1: event.target.value })} required /></label>
            <label className="form-label">Apartment / landmark<input className="field w-full" value={addressDraft.address_line_2} onChange={(event) => setAddressDraft({ ...addressDraft, address_line_2: event.target.value })} /></label>
            <label className="form-label">Area / neighborhood<input className="field w-full" value={addressDraft.area} onChange={(event) => setAddressDraft({ ...addressDraft, area: event.target.value })} required /></label>
            <label className="form-label sm:col-span-2">Directions for the rider<textarea className="field w-full" rows={2} value={addressDraft.directions} onChange={(event) => setAddressDraft({ ...addressDraft, directions: event.target.value })} /></label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button className="button button-outline button-small" type="button" onClick={captureAddressLocation}><Icon name="pin" /> Pin my location</button>
              {addressDraft.latitude && addressDraft.longitude && <span className="text-xs text-brand-green">Location pin saved</span>}
              <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={addressDraft.is_default} onChange={(event) => setAddressDraft({ ...addressDraft, is_default: event.target.checked })} />Default address</label>
            </div>
            <button className="button button-primary sm:col-span-2" disabled={saveAddress.isPending}>Save address</button>
          </form>
        )}
      </section>

      <section className="mb-10" aria-labelledby="order-history-title">
        <h2 className="mb-4 font-brand-heading text-2xl font-bold text-brand-green" id="order-history-title">Order history</h2>
        {productsQuery.error && <p className="mb-3 bg-red-50 p-4 text-sm text-brand-tomato">Current catalogue matches could not be loaded, so reorder is unavailable: {productsQuery.error.message}</p>}
        {ordersQuery.isLoading ? <div className="skeleton h-24" />
          : ordersQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{ordersQuery.error.message}</p>
            : ordersQuery.data?.length ? <div className="space-y-3">{ordersQuery.data.map((order) => <article className="account-order" key={order.id}>
              <div className="min-w-0 flex-1"><p className="font-bold">Order {order.order_number}</p><p className="mt-1 text-sm text-brand-ink/60">{new Date(order.created_at).toLocaleDateString()} · {order.branch_snapshot.name}</p><p className="mt-1 text-xs capitalize text-brand-green">{order.status.replaceAll('_', ' ')}</p></div>
              <div className="flex flex-wrap gap-2"><button className="button button-outline button-small" disabled={reorder.isPending || productsQuery.isLoading || Boolean(productsQuery.error)} onClick={() => reorder.mutate(order)} title="Adds matching products that are available at your selected branch">Reorder</button><Link className="button button-outline button-small" to={`/orders/${order.order_number}`}>View order</Link></div>
            </article>)}</div>
              : <p className="bg-brand-cream p-5 text-sm text-brand-ink/65">Your orders will appear here after checkout.</p>}
        <p className="mt-3 text-xs leading-5 text-brand-ink/50">Reorder matches the original item names to products currently available at your selected branch. Basket packages and items without a current match are not recreated.</p>
      </section>

      <section id="wishlist" aria-labelledby="wishlist-title" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="wishlist-title">Wishlist</h2>
          {favorites.length > 0 && (
            <span className="rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold text-brand-green">
              {favorites.length} saved item{favorites.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {favorites.length ? (
          <div>
            <p className="mb-4 text-sm text-brand-ink/65">
              Saved items are stored on this device. Click on any item to view details or add directly to your basket.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((id) => {
                const product = products.find((item) => item.id === id)
                return (
                  <article className="account-address flex items-center gap-3 p-3 rounded-2xl bg-white border border-brand-green/15 shadow-2xs hover:border-brand-green/30 transition" key={id}>
                    {product ? (
                      <>
                        <Link to={`/product/${product.slug}`} className="shrink-0 overflow-hidden rounded-xl bg-brand-cream/60">
                          <img
                            src={product.image_url || categoryImage(product.category)}
                            alt={product.name}
                            className="h-16 w-16 object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link className="font-bold text-brand-green hover:underline text-sm truncate block" to={`/product/${product.slug}`}>
                            {product.name}
                          </Link>
                          <p className="text-xs font-semibold text-brand-ink/80 mt-0.5">
                            {money(product.branch_availability?.price_minor ?? product.base_price_minor)}
                            <span className="text-brand-ink/50 font-normal ml-1">/ {product.unit}</span>
                          </p>
                          <p className={`mt-0.5 text-[11px] font-medium ${product.branch_availability?.is_available ? 'text-brand-green' : 'text-brand-tomato'}`}>
                            {product.branch_availability?.is_available ? 'In stock at selected branch' : 'Check other branches'}
                          </p>
                          {product.branch_availability?.is_available && (
                            <button
                              type="button"
                              onClick={(e) => addToCart(product, branch, cartSessionKey, queryClient, setCartDrawerOpen, e)}
                              className="mt-2 button button-small button-primary text-[11px] py-1 px-2.5"
                            >
                              Add to basket +
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-brand-ink/60">This saved product is no longer in the current catalogue.</p>
                      </div>
                    )}
                    <button
                      className="icon-button text-brand-tomato shrink-0 self-start"
                      aria-label={`Remove ${product?.name ?? 'saved product'} from wishlist`}
                      onClick={() => toggleFavorite(id)}
                    >
                      <Icon name="close" />
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-brand-green/20 bg-brand-cream/50 p-6 text-center">
            <p className="text-sm text-brand-ink/70">You have no items in your wishlist yet.</p>
            <p className="text-xs text-brand-ink/50 mt-1">Tap the heart on any product card while shopping to save it here for later.</p>
            <Link to="/shop" className="button button-small button-outline mt-3 inline-flex">
              Explore Store Shelves
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

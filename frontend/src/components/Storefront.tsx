import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Suspense } from 'react'
import { api, money, type Branch, type CartValidation, type CustomerProfile, type Product } from '../lib/api'
import { notify } from '../lib/notifications'
import { clearAuthTokens, getAuthTokens } from '../lib/auth'
import { useBaskets, useBranches, useCart, useSiteSettings } from '../hooks/useStoreData'
import { useStore } from '../stores/store'
import { Drawer, Icon, Modal } from './ui'
import { SplashScreen } from './SplashScreen'
import { lazy } from 'react'
const ShoppingAssistant = lazy(() =>
  import('./ShoppingAssistant').then((m) => ({ default: m.ShoppingAssistant }))
)
import { getProduceIcon } from '../lib/images'

const COPYRIGHT_YEAR = new Date().getFullYear()

function BranchPicker({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: branches = [], isLoading, error } = useBranches()
  const branch = useStore((state) => state.branch)
  const setBranch = useStore((state) => state.setBranch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const { data: cart } = useCart()
  const [candidate, setCandidate] = useState<Branch | null>(null)
  const [validation, setValidation] = useState<CartValidation | null>(null)
  const [checking, setChecking] = useState(false)
  const [locationError, setLocationError] = useState('')
  const queryClient = useQueryClient()
  const selected = candidate ?? branch
  const mapUrl = selected?.latitude && selected.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(selected.longitude) - 0.035}%2C${Number(selected.latitude) - 0.025}%2C${Number(selected.longitude) + 0.035}%2C${Number(selected.latitude) + 0.025}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}`
    : null

  useEffect(() => {
    const handler = (event: Event) => {
      const nextBranch = (event as CustomEvent<Branch>).detail
      if (nextBranch) void selectBranch(nextBranch)
    }
    window.addEventListener('farmershaus:branch-candidate', handler)
    return () => window.removeEventListener('farmershaus:branch-candidate', handler)
  })

  async function selectBranch(nextBranch: Branch) {
    if (!branch || nextBranch.id === branch.id || !cart?.items.length) {
      setBranch(nextBranch)
      setCandidate(null)
      setValidation(null)
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      onClose()
      return
    }
    setCandidate(nextBranch)
    setChecking(true)
    setValidation(null)
    try {
      const result = await api<CartValidation>('/cart/validate/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ cart_id: cart.id, branch_id: nextBranch.id }),
      })
      setValidation(result)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'We could not check this cart.', 'error')
    } finally {
      setChecking(false)
    }
  }

  function confirmBranch() {
    if (!candidate) return
    setBranch(candidate)
    setCandidate(null)
    setValidation(null)
    queryClient.invalidateQueries({ queryKey: ['cart'] })
    onClose()
    notify('Branch updated. Your previous cart is still saved to its original branch.', 'info')
  }

  function useLocation() {
    setLocationError('')
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await api<{ branch: Branch }>('/branches/nearest/?' + new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          }))
          await selectBranch(result.branch)
        } catch (error) {
          setLocationError(error instanceof Error ? error.message : 'We could not find a nearby branch.')
        }
      },
      () => setLocationError('Location permission was not granted. Choose a branch from the list instead.'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={branch ? 'Choose your FarmersHaus' : 'Where should we shop for you?'} size="large">
      <p className="mb-5 text-sm leading-6 text-brand-ink/70">
        Pick the branch that will prepare your order. Products and availability are tailored to your choice.
      </p>
      <button className="button button-outline mb-3 w-full justify-center sm:w-auto" onClick={useLocation}>
        <Icon name="pin" /> Use my location
      </button>
      {locationError && <p className="mb-3 text-sm text-brand-tomato" role="status">{locationError}</p>}
      {isLoading && <div className="skeleton h-24" aria-label="Loading branches" />}
      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-brand-tomato">Branches could not be loaded: {error.message}</p>}
      {!isLoading && !error && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-2">
            {branches.map((item) => (
              <button
                key={item.id}
                onClick={() => void selectBranch(item)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:border-brand-green hover:bg-brand-green/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green ${selected?.id === item.id ? 'border-brand-green bg-brand-green/5' : 'border-brand-green/15'}`}
              >
                <span className="flex items-center justify-between gap-2 font-semibold text-brand-ink">
                  {item.name}
                  {selected?.id === item.id && <Icon name="check" className="text-brand-green" />}
                </span>
                <span className="mt-1 block text-sm text-brand-ink/65">{item.address}</span>
                <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                  <span className={`h-2 w-2 rounded-full ${item.is_open ? 'bg-brand-green' : 'bg-brand-tomato'}`} />
                  {item.is_open ? 'Open now' : 'Closed'}
                  {item.hours_are_placeholder && <span className="font-normal text-brand-ink/45">· hours being confirmed</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl bg-brand-cream">
            {mapUrl ? (
              <iframe
                title={`Map showing ${selected?.name}`}
                src={mapUrl}
                className="h-72 w-full border-0 lg:h-full lg:min-h-[25rem]"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="grid min-h-64 place-items-center p-8 text-center text-sm text-brand-ink/60">
                Choose a branch to see its map.
              </div>
            )}
          </div>
        </div>
      )}
      {checking && <p className="mt-4 text-sm text-brand-ink/65">Checking cart availability at the selected branch…</p>}
      {validation && candidate && (
        <div className="mt-5 rounded-2xl bg-brand-yellow/20 p-4">
          <h3 className="font-semibold text-brand-ink">Review your cart before switching</h3>
          {validation.unavailable_items.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-brand-ink/75">
              {validation.unavailable_items.map((item) => (
                <li key={item.cart_item_id}>{item.product_name}: will need checking at {candidate.name}.</li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-brand-ink/75">Your cart items can be checked at this branch.</p>}
          <p className="mt-2 text-xs leading-5 text-brand-ink/65">
            The current API keeps carts branch-specific. Your existing items remain saved at {branch?.name}; switching will show this branch’s own cart.
          </p>
          <button className="button button-primary mt-4" onClick={confirmBranch}>Use {candidate.name}</button>
        </div>
      )}
    </Modal>
  )
}

function ScrollManager() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace(/^#/, '')
      const tryScroll = () => {
        const element = document.getElementById(targetId)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return true
        }
        return false
      }

      if (!tryScroll()) {
        const t1 = setTimeout(tryScroll, 100)
        const t2 = setTimeout(tryScroll, 300)
        const t3 = setTimeout(tryScroll, 600)
        return () => {
          clearTimeout(t1)
          clearTimeout(t2)
          clearTimeout(t3)
        }
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [pathname, hash])

  return null
}

function Header() {
  const branch = useStore((state) => state.branch)
  const setBranch = useStore((state) => state.setBranch)
  const favorites = useStore((state) => state.favorites)
  const { data: branches = [], isLoading: branchesLoading } = useBranches()
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const [branchOpen, setBranchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAuthTokens()))
  const { data: cart } = useCart()
  const cartCount = cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0
  const { data: site } = useSiteSettings()

  useEffect(() => {
    const updateAuth = () => setAuthenticated(Boolean(getAuthTokens()))
    window.addEventListener('farmershaus:auth-changed', updateAuth)
    return () => window.removeEventListener('farmershaus:auth-changed', updateAuth)
  }, [])

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CustomerProfile>('/me/'),
    enabled: authenticated,
    staleTime: 60000,
  })
  useEffect(() => {
    if (branchesLoading || branches.length === 0) return

    const currentBranchValid = branch && branches.some((item) => item.id === branch.id && item.is_active)
    if (!currentBranchValid) {
      const fallbackBranch = branches.find((item) => item.is_active) ?? branches[0]
      if (fallbackBranch) setBranch(fallbackBranch)
    }
  }, [branch, branches, branchesLoading, setBranch])

  useEffect(() => {
    const handler = (event: Event) => {
      setBranchOpen(true)
      const nextBranch = (event as CustomEvent<Branch>).detail
      if (nextBranch) window.dispatchEvent(new CustomEvent('farmershaus:branch-candidate', { detail: nextBranch }))
    }
    window.addEventListener('farmershaus:choose-branch', handler)
    return () => window.removeEventListener('farmershaus:choose-branch', handler)
  }, [])

  async function searchProducts(value: string) {
    setSearch(value)
    if (!branch || value.trim().length < 2) {
      setSuggestions([])
      return
    }
    setSearching(true)
    try {
      const result = await api<{ results: Product[] }>(`/search/suggestions/?${new URLSearchParams({ branch: branch.id, q: value })}`)
      setSuggestions(result.results)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Search is unavailable.', 'error')
    } finally {
      setSearching(false)
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (search.trim()) navigate(`/shop?search=${encodeURIComponent(search.trim())}`)
    setSuggestions([])
  }

  return (
    <>
      <div className="bg-brand-green px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">
        {site?.contact.announcement_bar_text || 'Fresh from our farmers to your family — order online today.'}
      </div>
      <header data-storefront-nav className="sticky top-0 z-50 border-b border-brand-green/10 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-3 py-2 sm:px-6 sm:py-3 lg:px-10">
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 lg:gap-6">
            {/* Left: Hamburger & Brand Logo */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <button className="icon-button lg:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <Icon name="menu" />
              </button>
              <Link
                to="/"
                className="shrink-0"
                aria-label="FarmersHaus home"
                onClick={(event) => {
                  if (event.shiftKey) {
                    window.dispatchEvent(new CustomEvent('farmershaus:replay-splash'))
                  }
                }}
              >
                <img className="h-8 w-auto sm:h-12 md:h-14" src="/brand/farmershaus-logo.png" alt="FarmersHaus" />
              </Link>
              <nav className="hidden items-center gap-5 lg:flex ml-3">
                <NavLink className="nav-link" to="/shop">Shop</NavLink>
                <NavLink className="nav-link" to="/baskets">Food baskets</NavLink>
                <NavLink className="nav-link" to="/recipes">Recipes</NavLink>
                <NavLink className="nav-link" to="/find-us">Find us</NavLink>
              </nav>
            </div>

            {/* Desktop / Tablet Inline Search Bar */}
            <div className="relative hidden md:block md:min-w-48 md:max-w-md md:flex-1">
              <form onSubmit={submitSearch} className="relative">
                <Icon name="search" className="search-field__icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-green/65" />
                <input
                  aria-label="Search products"
                  value={search}
                  onChange={(event) => void searchProducts(event.target.value)}
                  onFocus={() => search.length >= 2 && void searchProducts(search)}
                  placeholder="Search fresh produce…"
                  className="field search-field w-full"
                />
              </form>
              {(suggestions.length > 0 || searching) && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-brand-green/10 bg-white p-2 shadow-xl">
                  {searching && <p className="p-3 text-sm text-brand-ink/55">Searching…</p>}
                  {suggestions.map((product) => (
                    <button
                      key={product.id}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-green/5"
                      onClick={() => { navigate(`/product/${product.slug}`); setSuggestions([]); setSearch('') }}
                    >
                      <span className="font-semibold">{product.name}</span>
                      <span className="ml-2 text-brand-ink/50">{product.unit}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Actions Cluster */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                className="branch-chip flex min-w-0 max-w-[5.25rem] px-2 text-[11px] sm:max-w-none sm:px-3 sm:text-xs"
                onClick={() => setBranchOpen(true)}
                title={branch?.name ?? 'Choose branch'}
              >
                <Icon name="pin" className="shrink-0 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="max-w-[3.5rem] truncate sm:max-w-36">{branch?.name?.replace('FarmersHaus ', '') ?? 'Branch'}</span>
              </button>

              <Link
                className="relative icon-button hidden min-[400px]:inline-grid"
                to="/account#wishlist"
                aria-label={`Wishlist, ${favorites.length} saved items`}
                title="Wishlist / Saved Items"
              >
                <Icon name="heart" className={favorites.length > 0 ? 'fill-brand-tomato text-brand-tomato' : ''} />
                {favorites.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand-tomato px-1 text-[9px] font-bold text-white shadow-xs">
                    {favorites.length}
                  </span>
                )}
              </Link>

              <Link
                className={`relative icon-button transition ${
                  authenticated
                    ? 'border border-brand-green/35 bg-brand-green/10 text-brand-green hover:bg-brand-green/15'
                    : ''
                }`}
                to="/account"
                aria-label={authenticated ? `Your account (${profile?.display_name || 'Signed in'})` : 'Your account'}
                title={authenticated ? `Signed in as ${profile?.display_name || 'Customer'}` : 'Sign in / Your account'}
              >
                <Icon name="user" />
                {authenticated && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5" title="Logged in">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-white" />
                  </span>
                )}
              </Link>

              <button id="header-cart-button" className="relative icon-button" onClick={() => setCartDrawerOpen(true)} aria-label={`Open cart, ${cartCount} items`}>
                <Icon name="cart" />
                <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand-yellow px-1 text-[9px] font-bold text-brand-green sm:h-5 sm:min-w-5 sm:text-[10px]">{cartCount}</span>
              </button>
            </div>
          </div>

          {/* Mobile Search Row */}
          <div className="relative mt-2 md:hidden">
            <form onSubmit={submitSearch} className="relative">
              <Icon name="search" className="search-field__icon pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-green/65 h-4 w-4" />
              <input
                aria-label="Search products"
                value={search}
                onChange={(event) => void searchProducts(event.target.value)}
                onFocus={() => search.length >= 2 && void searchProducts(search)}
                placeholder="Search fresh produce…"
                className="field search-field w-full py-2 pl-9 pr-3 text-xs rounded-xl"
              />
            </form>
            {(suggestions.length > 0 || searching) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-brand-green/10 bg-white p-2 shadow-xl">
                {searching && <p className="p-2 text-xs text-brand-ink/55">Searching…</p>}
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    className="block w-full rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-brand-green/5"
                    onClick={() => { navigate(`/product/${product.slug}`); setSuggestions([]); setSearch('') }}
                  >
                    <span className="font-semibold">{product.name}</span>
                    <span className="ml-2 text-brand-ink/50">{product.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menu">
        <div className="flex h-full flex-col justify-between px-5 py-4">
          <div className="space-y-4">
            {authenticated ? (
              <div className="rounded-2xl border border-brand-green/20 bg-brand-cream/90 p-3.5 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-green text-sm font-bold text-white shadow-xs">
                    {profile?.display_name
                      ? profile.display_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                      : 'FH'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-brand-ink">{profile?.display_name || 'FarmersHaus Member'}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Active
                      </span>
                    </div>
                    <p className="truncate text-xs text-brand-ink/60">{profile?.phone || profile?.email || 'Logged in'}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-brand-green/10 pt-2 text-xs font-semibold">
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="font-bold text-brand-green hover:underline"
                  >
                    View my account &rarr;
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthTokens()
                      setAuthenticated(false)
                      void queryClient.clear()
                      notify('You have been signed out.', 'info')
                    }}
                    className="text-brand-tomato hover:underline"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-2xl border border-dashed border-brand-green/25 bg-brand-cream/60 p-3 text-xs font-bold text-brand-green transition hover:bg-brand-cream"
              >
                <span className="flex items-center gap-2">
                  <Icon name="user" className="h-4 w-4" />
                  <span>Sign in / Register for fast checkout</span>
                </span>
                <Icon name="arrow" className="h-3.5 w-3.5" />
              </Link>
            )}

            <div className="rounded-2xl border border-brand-green/15 bg-brand-cream/60 p-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-ink/60">
                <span className="flex items-center gap-1.5"><Icon name="pin" className="text-brand-green" /> Selected branch</span>
                <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-green">Active</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-brand-heading text-base font-bold text-brand-green">{branch?.name ?? 'Choose branch'}</p>
                  <p className="truncate text-xs text-brand-ink/65">{branch?.address ?? 'Pick a branch for accurate stock'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setBranchOpen(true); setMobileOpen(false) }}
                  className="button button-small button-outline shrink-0 px-2.5 py-1 text-xs"
                >
                  Change
                </button>
              </div>
            </div>

            <nav className="flex flex-col space-y-1">
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/shop">
                <span>Shop produce</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/baskets">
                <span>Food baskets</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/recipes">
                <span>Recipes & ideas</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/find-us">
                <span>Find our branches</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/contact">
                <span>Contact & support</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/account#wishlist">
                <span className="flex items-center gap-2">
                  <Icon name="heart" className={favorites.length > 0 ? "text-brand-tomato fill-brand-tomato h-4 w-4" : "h-4 w-4"} />
                  <span>Wishlist / Saved Items</span>
                </span>
                <span className="rounded-full bg-brand-tomato/10 px-2 py-0.5 text-xs font-bold text-brand-tomato">
                  {favorites.length}
                </span>
              </NavLink>
              <NavLink onClick={() => setMobileOpen(false)} className="mobile-nav-link flex items-center justify-between" to="/account">
                <span>My account</span>
                <Icon name="arrow" className="h-4 w-4 opacity-50" />
              </NavLink>
            </nav>
          </div>

          <div className="mt-6 border-t border-brand-green/10 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-ink/50">Need quick assistance?</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://wa.me/233554208446"
                target="_blank"
                rel="noreferrer"
                className="button button-small button-outline justify-center gap-1.5 text-xs"
              >
                <Icon name="whatsapp" className="text-brand-green" /> WhatsApp
              </a>
              <a
                href="tel:+233554208446"
                className="button button-small button-outline justify-center gap-1.5 text-xs"
              >
                <Icon name="pin" className="text-brand-green" /> Call us
              </a>
            </div>
          </div>
        </div>
      </Drawer>
      <BranchPicker open={branchOpen} onClose={() => setBranchOpen(false)} />
    </>
  )
}

function Footer() {
  const { data: site } = useSiteSettings()
  const { data: branches = [] } = useBranches()
  const selectedBranch = useStore((state) => state.branch)
  const branch = selectedBranch ?? branches.find((item) => item.is_active) ?? null
  const contact = site?.contact
  const numbers = [contact?.primary_phone || '+233 55 420 8446', contact?.secondary_phone || '+233 55 048 8906']
  const openingHours = branch ? Object.entries(branch.opening_hours).filter(([, hours]) => hours) : []
  const directionsUrl = branch?.latitude && branch.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`
    : branch?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`
      : '/find-us'
  return (
    <footer className="store-footer">
      <div className="store-footer__hero">
        <div className="store-footer__hero-content">
          <img className="store-footer__logo" src="/brand/farmershaus-logo.png" alt="FarmersHaus" />
          <p className="store-footer__eyebrow">Everyday fruits and veggies</p>
          <h2>FRESH FOOD.<br />HAPPIER DAYS.</h2>
          <p className="store-footer__tagline">{site?.site.tagline ?? 'Everyday Fruits and Veggies — a healthy happy life.'}</p>
          <Link className="store-footer__cta" to="/find-us">FIND YOUR FARMERSHAUS <Icon name="arrow" /></Link>
        </div>
        <div className="store-footer__details">
          <section>
            <h3>OPENING HOURS</h3>
            <p className="store-footer__branch">{branch?.name ?? 'Our branches'}</p>
            {openingHours.length ? openingHours.map(([day, hours]) => (
              <p key={day}>{day}: {hours ? `${hours.open} – ${hours.close}` : 'Closed'}</p>
            )) : <p>{branch?.hours_are_placeholder ? 'Please contact the branch to confirm today’s hours.' : 'Hours vary by branch. Please contact us to confirm.'}</p>}
            <Link to="/find-us" className="store-footer__text-link">View all branches <Icon name="arrow" /></Link>
          </section>
          <section>
            <h3>LOCATION</h3>
            <p className="store-footer__branch">{branch?.name ?? 'Serving Accra, Ghana'}</p>
            <p>{branch?.address ?? 'Choose a nearby FarmersHaus branch for your order.'}</p>
            <a className="store-footer__text-link" href={directionsUrl} target={directionsUrl.startsWith('http') ? '_blank' : undefined} rel={directionsUrl.startsWith('http') ? 'noreferrer' : undefined}>GET DIRECTIONS <Icon name="arrow" /></a>
          </section>
          <section>
            <h3>EXPLORE</h3>
            <div className="store-footer__menu">
              <Link to="/shop">Shop produce</Link><Link to="/baskets">Food baskets</Link><Link to="/recipes">Recipes</Link><Link to="/about">Our story</Link>
            </div>
            <div className="store-footer__contact">
              {numbers.map((number) => <a key={number} href={`tel:${number.replace(/\s/g, '')}`}>{number}</a>)}
              <a href={`mailto:${contact?.email ?? 'info@farmershausgh.com'}`}>{contact?.email ?? 'info@farmershausgh.com'}</a>
            </div>
          </section>
        </div>
      </div>
      <div className="store-footer__bottom">
        <span>© {COPYRIGHT_YEAR} FarmersHaus. Freshness for every day.</span>
        <div className="store-footer__legal"><Link to="/faqs">FAQs</Link><Link to="/delivery-info">Delivery</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refund-policy">Refund policy</Link><Link to="/staff" className="font-semibold text-brand-green/80 hover:text-brand-green">Staff Portal</Link></div>
        {contact?.social_links && Object.entries(contact.social_links).length > 0 && <div className="store-footer__social">{Object.entries(contact.social_links).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="capitalize">{name}</a>)}</div>}
      </div>
    </footer>
  )
}

function WhatsAppButton() {
  const { data: site } = useSiteSettings()
  const [open, setOpen] = useState(false)
  const numbers = site?.contact.whatsapp_numbers ?? []
  if (!numbers.length) return null
  return (
    <div className="hidden md:block fixed right-0 top-1/2 z-40 -translate-y-1/2 group">
      <div className={`absolute right-full top-1/2 mr-3 w-64 max-w-[calc(100vw-4.5rem)] -translate-y-1/2 rounded-2xl bg-white p-4 shadow-xl border border-brand-green/10 transition ${open ? 'pointer-events-auto opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'}`}>
        <p className="mb-2 text-sm font-bold text-brand-green">Chat with FarmersHaus</p>
        {numbers.map((number) => (
          <a key={number} className="block rounded-lg px-2 py-2 text-sm hover:bg-brand-green/5" href={`https://wa.me/${number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{number}</a>
        ))}
      </div>
      <button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true" className="whatsapp-tab" aria-label="Chat with us on WhatsApp">
        <Icon name="whatsapp" className="h-7 w-7" />
        <span>WhatsApp</span>
      </button>
    </div>
  )
}

function CartDrawer() {
  const open = useStore((state) => state.cartDrawerOpen)
  const setOpen = useStore((state) => state.setCartDrawerOpen)
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const { data: cart, isLoading } = useCart()
  const queryClient = useQueryClient()
  const { data: baskets = [] } = useBaskets()
  const mutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity?: number }) => {
      if (quantity === undefined) {
        return api(`/cart/items/${itemId}/`, { method: 'DELETE', cartSessionKey })
      }
      return api(`/cart/items/${itemId}/`, {
        method: 'PATCH',
        cartSessionKey,
        body: JSON.stringify({ quantity }),
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (error) => notify(error instanceof Error ? error.message : 'Cart update failed.', 'error'),
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!branch) return
      return api(`/cart/?branch=${branch.id}`, {
        method: 'DELETE',
        cartSessionKey,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      notify('All items cleared from your basket.', 'info')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Cart update failed.', 'error'),
  })

  const hasItems = (cart?.items?.length ?? 0) > 0
  const basketPrices = new Map(baskets.map((basket) => [basket.id, basket.base_price_minor]))
  const subtotal = cart?.items.reduce((sum, item) => {
    const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
    return sum + price * item.quantity
  }, 0) ?? 0

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      title="Your basket"
      action={
        hasItems ? (
          <button
            type="button"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="flex items-center gap-1.5 rounded-full border border-brand-tomato/20 bg-brand-tomato/10 px-3 py-1.5 text-xs font-semibold text-brand-tomato transition hover:bg-brand-tomato hover:text-white active:scale-95 disabled:opacity-50"
            aria-label="Clear all items from basket"
            title="Clear all items from your basket"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            <span>{clearMutation.isPending ? 'Clearing...' : 'Clear all'}</span>
          </button>
        ) : null
      }
    >
      {!branch ? <p className="p-6 text-sm text-brand-ink/60">Choose a branch to start shopping.</p>
        : isLoading ? <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-20" />)}</div>
          : !cart?.items.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="mb-4 text-5xl" aria-hidden="true">🧺</span>
              <h3 className="font-brand-heading text-2xl font-bold text-brand-green">Your basket is waiting</h3>
              <p className="mt-2 text-sm text-brand-ink/60">Add something fresh and lovely to get started.</p>
              <Link to="/shop" onClick={() => setOpen(false)} className="button button-primary mt-5">Shop produce</Link>
            </div>
          ) : (
            <>
              <div className="mx-5 mt-4 rounded-xl border border-brand-green/15 bg-brand-cream/70 px-3.5 py-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-brand-green">
                  <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
                  <span>Direct delivery from FarmersHaus {branch.name}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-brand-ink/60">
                  All items packed &amp; dispatched together from this single local market.
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {cart.items.map((item) => {
                  const name = item.product?.name ?? item.basket_package?.name ?? 'Item'
                  const slug = item.product?.slug ?? item.basket_package?.slug ?? name
                  const icon = getProduceIcon(slug)
                  const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
                  return (
                    <div className="flex gap-3 rounded-2xl border border-brand-green/10 p-3" key={item.id}>
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-cream text-2xl select-none" aria-label={name} title={name}>
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="mt-1 text-xs text-brand-ink/55">{money(price)} × {item.quantity}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button aria-label={`Decrease ${name} quantity`} className="quantity-button" onClick={() => mutation.mutate({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) })}><Icon name="minus" /></button>
                          <span className="min-w-4 text-center text-xs">{item.quantity}</span>
                          <button aria-label={`Increase ${name} quantity`} className="quantity-button" onClick={() => mutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}><Icon name="plus" /></button>
                          <button className="ml-auto text-xs font-semibold text-brand-tomato hover:underline" onClick={() => mutation.mutate({ itemId: item.id })}>Remove</button>
                        </div>
                      </div>
                      <span className="text-sm font-bold">{money(price * item.quantity)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-brand-green/10 p-5">
                <div className="mb-4 flex justify-between text-sm"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <Link to="/cart" onClick={() => setOpen(false)} className="button button-primary w-full justify-center">View full cart <Icon name="arrow" /></Link>
                <p className="mt-3 text-center text-xs text-brand-ink/45">Delivery fees are calculated at checkout.</p>
              </div>
            </>
          )}
    </Drawer>
  )
}

export function Storefront() {
  const { data: site } = useSiteSettings()
  const { data: cart } = useCart()
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    const seen = sessionStorage.getItem('farmershaus:splash-seen')
    if (seen) return false
    return window.location.pathname === '/' || window.location.pathname === ''
  })

  useEffect(() => {
    const replayHandler = () => setShowSplash(true)
    window.addEventListener('farmershaus:replay-splash', replayHandler)
    return () => window.removeEventListener('farmershaus:replay-splash', replayHandler)
  }, [])

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <ScrollManager />
      <Header />
      <main>
        <Suspense fallback={<div className="section-wrap"><div className="skeleton min-h-64" aria-label="Loading page" /></div>}>
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            <Outlet />
          </motion.div>
        </Suspense>
      </main>
      <Footer />
      <WhatsAppButton />
      <Suspense fallback={null}>
        <ShoppingAssistant />
      </Suspense>
      <CartDrawer />
      <button className="sr-only" onClick={() => setCartDrawerOpen(true)}>Open cart {cart?.items.length ?? 0}</button>
      <div className="sr-only" aria-live="polite">{site?.contact.announcement_bar_text}</div>
    </>
  )
}

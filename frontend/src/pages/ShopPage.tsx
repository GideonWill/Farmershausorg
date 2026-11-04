import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { useCategories, useProducts } from '../hooks/useStoreData'
import { ProductCard } from '../components/ProductCard'
import { useStore } from '../stores/store'
import { Icon } from '../components/ui'

export function ShopPage() {
  const { category: routeCategory } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const branch = useStore((state) => state.branch)

  const search = params.get('search') ?? ''
  const ordering = params.get('ordering') ?? ''
  const category = routeCategory ?? params.get('category') ?? ''
  const isOrganic = params.get('organic') === 'true'
  const isInSeason = params.get('in_season') === 'true'
  const minPriceMinor = params.get('min_price') ? Number(params.get('min_price')) : undefined
  const maxPriceMinor = params.get('max_price') ? Number(params.get('max_price')) : undefined

  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => {
    setSearchInput(search)
  }, [search])

  const { data: categories = [] } = useCategories()
  const { data: products = [], isLoading, error } = useProducts({
    category: category || undefined,
    search: search || undefined,
    ordering: ordering || undefined,
    organic: isOrganic ? true : undefined,
    in_season: isInSeason ? true : undefined,
    min_price: minPriceMinor,
    max_price: maxPriceMinor,
  })

  const activeCategoryObj = useMemo(
    () => categories.find((item) => item.slug === category),
    [categories, category],
  )

  const title = useMemo(() => {
    if (search) return `Search results for “${search}”`
    if (activeCategoryObj) return activeCategoryObj.name
    return category ? 'Fresh Harvest' : 'All Fresh Produce'
  }, [activeCategoryObj, category, search])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setParams(next)
  }

  function handleCategoryChange(targetCategorySlug?: string) {
    const nextParams = new URLSearchParams(params)
    nextParams.delete('category')
    const queryString = nextParams.toString() ? `?${nextParams.toString()}` : ''
    if (targetCategorySlug) {
      navigate(`/shop/category/${targetCategorySlug}${queryString}`)
    } else {
      navigate(`/shop${queryString}`)
    }
  }

  function clearAllFilters() {
    setSearchInput('')
    navigate('/shop')
  }

  const hasActiveFilters = Boolean(
    category ||
      search ||
      isOrganic ||
      isInSeason ||
      minPriceMinor !== undefined ||
      maxPriceMinor !== undefined ||
      ordering,
  )

  return (
    <div className="min-h-[65vh]">
      {/* Hero Banner */}
      <section className="shop-hero">
        <div className="shop-hero__content">
          <div className="text-sm text-white/65">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link to="/shop" className="hover:text-white">
              Shop
            </Link>
            {category && (
              <>
                <span className="mx-2">/</span>
                <span className="capitalize">{activeCategoryObj?.name ?? category}</span>
              </>
            )}
          </div>
          <p className="eyebrow mt-6 text-brand-yellow">
            {branch?.name ?? 'Your neighborhood market'}
          </p>
          <h1 className="font-brand-heading text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/75 sm:text-base">
            Single-origin farm groceries, crisp fruits, and organic vegetables—carefully harvested and delivered to your doorstep.
          </p>
          <a
            className="button button-yellow mt-6"
            href="#shop-products"
            onClick={(event) => {
              event.preventDefault()
              document.getElementById('shop-products')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Explore fresh picks <Icon name="arrow" />
          </a>
        </div>
        <div className="shop-hero__image-wrap">
          <img
            src="/brand/farmershaus-shop-hero.png"
            alt="Shopping cart overflowing with freshly gathered harvest"
            className="shop-hero__image"
          />
        </div>
      </section>

      {/* Filter & Sorting Control Center */}
      <section className="bg-brand-cream/85 border-b border-brand-green/10 px-4 py-5 sm:px-6 sm:py-7">
        <div className="mx-auto max-w-[1440px]">
          {/* Top Row: Search input, Sort by, and Item Count */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Inline search bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                updateParam('search', searchInput.trim())
              }}
              className="relative flex-1 max-w-md"
            >
              <input
                type="search"
                placeholder="Search fruits, vegetables, pantry goods…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-2xl border border-brand-green/20 bg-white py-2 pl-9 pr-8 text-xs sm:text-sm text-brand-ink placeholder:text-brand-ink/45 focus:border-brand-green focus:outline-none shadow-2xs"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40">
                <Icon name="search" className="h-4 w-4" />
              </span>
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    updateParam('search', '')
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-ink/50 hover:text-brand-tomato"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </form>

            <div className="flex items-center justify-between md:justify-end gap-4">
              <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-brand-ink">
                <span>Sort by</span>
                <select
                  aria-label="Sort products"
                  value={ordering}
                  onChange={(event) => updateParam('ordering', event.target.value)}
                  className="rounded-xl border border-brand-green/20 bg-white py-1.5 px-3 text-xs sm:text-sm text-brand-ink shadow-2xs focus:border-brand-green focus:outline-none"
                >
                  <option value="">Recommended</option>
                  <option value="name">Name: A to Z</option>
                  <option value="-name">Name: Z to A</option>
                  <option value="price">Price: Low to High</option>
                  <option value="-price">Price: High to Low</option>
                </select>
              </label>

              <p className="text-xs font-bold text-brand-green shrink-0">
                {products.length} {products.length === 1 ? 'item' : 'items'} found
              </p>
            </div>
          </div>

          {/* Category Chips Scrollbar */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => handleCategoryChange()}
              className={`filter-chip ${!category ? 'filter-chip-active' : ''}`}
            >
              All produce
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCategoryChange(item.slug)}
                className={`filter-chip ${category === item.slug ? 'filter-chip-active' : ''}`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Secondary Filter Chips: Organic, In-Season, Price Range */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateParam('organic', isOrganic ? '' : 'true')}
              className={`filter-chip flex items-center gap-1.5 ${isOrganic ? 'filter-chip-active' : ''}`}
            >
              <span>🌿 Organic</span>
              {isOrganic && <span className="text-[10px]">✓</span>}
            </button>

            <button
              type="button"
              onClick={() => updateParam('in_season', isInSeason ? '' : 'true')}
              className={`filter-chip flex items-center gap-1.5 ${isInSeason ? 'filter-chip-active' : ''}`}
            >
              <span>☀️ In season</span>
              {isInSeason && <span className="text-[10px]">✓</span>}
            </button>

            <div className="flex items-center gap-2 rounded-2xl border border-brand-green/15 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-ink/80 shadow-2xs">
              <span>Price (GH₵):</span>
              <input
                aria-label="Minimum price in Ghana cedis"
                type="number"
                min="0"
                step="1"
                placeholder="Min"
                value={minPriceMinor !== undefined ? minPriceMinor / 100 : ''}
                onChange={(event) =>
                  updateParam(
                    'min_price',
                    event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '',
                  )
                }
                className="w-16 rounded-lg border border-brand-green/20 px-1.5 py-0.5 text-xs text-center text-brand-ink focus:border-brand-green focus:outline-none"
              />
              <span className="text-brand-ink/40">–</span>
              <input
                aria-label="Maximum price in Ghana cedis"
                type="number"
                min="0"
                step="1"
                placeholder="Max"
                value={maxPriceMinor !== undefined ? maxPriceMinor / 100 : ''}
                onChange={(event) =>
                  updateParam(
                    'max_price',
                    event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '',
                  )
                }
                className="w-16 rounded-lg border border-brand-green/20 px-1.5 py-0.5 text-xs text-center text-brand-ink focus:border-brand-green focus:outline-none"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-brand-tomato hover:underline py-1 px-2"
              >
                <span>Reset all filters</span>
                <span>✕</span>
              </button>
            )}
          </div>

          {/* Active Filter Tags Summary */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-brand-green/10 pt-2.5 text-xs text-brand-ink/70">
              <span className="font-semibold text-[11px] uppercase tracking-wider text-brand-ink/50 mr-1">
                Active:
              </span>
              {category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Category: {activeCategoryObj?.name ?? category}
                  <button
                    type="button"
                    onClick={() => handleCategoryChange()}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Search: &ldquo;{search}&rdquo;
                  <button
                    type="button"
                    onClick={() => updateParam('search', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {isOrganic && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Organic
                  <button
                    type="button"
                    onClick={() => updateParam('organic', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {isInSeason && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  In Season
                  <button
                    type="button"
                    onClick={() => updateParam('in_season', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {minPriceMinor !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Min GH₵ {minPriceMinor / 100}
                  <button
                    type="button"
                    onClick={() => updateParam('min_price', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {maxPriceMinor !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Max GH₵ {maxPriceMinor / 100}
                  <button
                    type="button"
                    onClick={() => updateParam('max_price', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
              {ordering && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-0.5 font-bold text-brand-green text-[11px]">
                  Sort: {ordering}
                  <button
                    type="button"
                    onClick={() => updateParam('ordering', '')}
                    className="hover:text-brand-tomato ml-1"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Products Grid */}
      <section id="shop-products" className="section-wrap pt-8">
        {isLoading || !branch ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <div key={item}>
                <div className="skeleton aspect-square" />
                <div className="skeleton mt-3 h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-5 text-brand-tomato">
            Products could not be loaded: {error.message}
          </div>
        ) : products.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-brand-cream px-6 py-14 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-brand-green shadow-xs">
              <Icon name="search" />
            </div>
            <h2 className="mt-4 font-brand-heading text-2xl font-bold text-brand-green">
              No produce matched your filters
            </h2>
            <p className="mt-2 text-sm text-brand-ink/60 max-w-md mx-auto">
              We couldn&apos;t find any items matching your current filters. Try relaxing the price range, switching categories, or clearing filters.
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="button button-primary mt-5"
            >
              Clear all filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

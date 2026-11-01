import { useMemo } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { useCategories, useProducts } from '../hooks/useStoreData'
import { ProductCard } from '../components/ProductCard'
import { useStore } from '../stores/store'
import { Icon } from '../components/ui'

export function ShopPage() {
  const { category: routeCategory } = useParams()
  const [params, setParams] = useSearchParams()
  const branch = useStore((state) => state.branch)
  const search = params.get('search') ?? ''
  const ordering = params.get('ordering') ?? ''
  const category = routeCategory ?? params.get('category') ?? ''
  const { data: categories = [] } = useCategories()
  const { data: products = [], isLoading, error } = useProducts({
    category: category || undefined,
    search: search || undefined,
    ordering: ordering || undefined,
    organic: params.get('organic') === 'true' ? true : undefined,
    in_season: params.get('in_season') === 'true' ? true : undefined,
    min_price: params.get('min_price') ? Number(params.get('min_price')) : undefined,
    max_price: params.get('max_price') ? Number(params.get('max_price')) : undefined,
  })

  const title = useMemo(() => {
    if (search) return `Search results for “${search}”`
    return categories.find((item) => item.slug === category)?.name ?? (category ? 'Fresh picks' : 'Shop all')
  }, [categories, category, search])

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  return (
    <div className="min-h-[65vh]">
      <section className="shop-hero">
        <div className="shop-hero__content">
          <div className="text-sm text-white/65"><Link to="/" className="hover:text-white">Home</Link><span className="mx-2">/</span><span>Shop</span></div>
          <p className="eyebrow mt-6 text-brand-yellow">{branch?.name ?? 'Your neighborhood market'}</p>
          <h1 className="font-brand-heading text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-white/75 sm:text-base">Fresh groceries, fruits and vegetables—carefully picked and delivered to your door.</p>
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
            alt="A shopping cart full of fresh groceries with a fresh groceries delivered fast message"
            className="shop-hero__image"
          />
        </div>
      </section>
      <section className="bg-brand-cream px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-brand-ink">
              <span>Sort by</span>
              <select aria-label="Sort products" value={ordering} onChange={(event) => updateParam('ordering', event.target.value)} className="field min-w-36 sm:min-w-44 py-1.5 text-xs sm:text-sm">
                <option value="">Recommended</option><option value="name">Name: A to Z</option><option value="-name">Name: Z to A</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option>
              </select>
            </label>
            <p className="text-xs font-medium text-brand-ink/50">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Link to="/shop" className={`filter-chip ${!category ? 'filter-chip-active' : ''}`}>All produce</Link>
            {categories.map((item) => <Link key={item.id} to={`/shop/category/${item.slug}`} className={`filter-chip ${category === item.slug ? 'filter-chip-active' : ''}`}>{item.name}</Link>)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => updateParam('organic', params.get('organic') === 'true' ? '' : 'true')} className={`filter-chip ${params.get('organic') === 'true' ? 'filter-chip-active' : ''}`}>Organic</button>
            <button onClick={() => updateParam('in_season', params.get('in_season') === 'true' ? '' : 'true')} className={`filter-chip ${params.get('in_season') === 'true' ? 'filter-chip-active' : ''}`}>In season</button>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink/70">
              Min GH₵ <input aria-label="Minimum price in Ghana cedis" type="number" min="0" step="1" value={params.get('min_price') ? Number(params.get('min_price')) / 100 : ''} onChange={(event) => updateParam('min_price', event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '')} className="field w-20 px-2 py-1 text-xs" />
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink/70">
              Max GH₵ <input aria-label="Maximum price in Ghana cedis" type="number" min="0" step="1" value={params.get('max_price') ? Number(params.get('max_price')) / 100 : ''} onChange={(event) => updateParam('max_price', event.target.value ? String(Math.round(Number(event.target.value) * 100)) : '')} className="field w-20 px-2 py-1 text-xs" />
            </label>
          </div>
        </div>
      </section>
      <section id="shop-products" className="section-wrap pt-8">
        {isLoading || !branch ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">{[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <div key={item}><div className="skeleton aspect-square" /><div className="skeleton mt-3 h-4 w-2/3" /></div>)}</div>
          : error ? <div className="rounded-2xl bg-red-50 p-5 text-brand-tomato">Products could not be loaded: {error.message}</div>
            : products.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
              : <div className="rounded-3xl bg-brand-cream px-6 py-14 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-brand-green"><Icon name="search" /></div><h2 className="mt-4 font-brand-heading text-2xl font-bold text-brand-green">Nothing found just yet</h2><p className="mt-2 text-sm text-brand-ink/60">Try another search or choose a different category.</p><Link to="/shop" className="button button-primary mt-5">Clear filters</Link></div>}
      </section>
    </div>
  )
}


import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useStore } from '../stores/store'
import { useBranches } from '../hooks/useStoreData'
import { money, type Product } from '../lib/api'
import { categoryImage } from '../lib/images'
import { addToCart, switchToBranch } from '../lib/shopping'
import { notify } from '../lib/notifications'
import { Icon, LazyImage } from './ui'

export function ProductCard({ product }: { product: Product }) {
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const toggleFavorite = useStore((state) => state.toggleFavorite)
  const favorites = useStore((state) => state.favorites)
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const queryClient = useQueryClient()
  const { data: branches = [] } = useBranches()

  const isFavorite = favorites.includes(product.id)
  const available = product.branch_availability?.is_available
  const selectedOther = product.available_at_other_branches?.[0]
  const selectedInventory = selectedOther && branches.find((item) => item.id === selectedOther.id)

  function quickAdd() {
    if (!available) {
      notify(`Unavailable at ${branch?.name ?? 'your branch'}. Check other branches for availability.`, 'info')
      return
    }
    addToCart(product, branch, cartSessionKey, queryClient, setCartDrawerOpen)
  }

  return (
    <article className="product-card group flex flex-col h-full">
      <div className="relative">
        <Link to={`/product/${product.slug}`} className="block overflow-hidden rounded-2xl bg-brand-cream/60">
          <LazyImage src={product.image_url || categoryImage(product.category)} alt={product.name} className="aspect-[1/1.05] transition-transform duration-500 group-hover:scale-[1.02]" />
        </Link>
        <button
          className={`absolute right-3 top-3 grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-white/85 backdrop-blur-md border border-white/90 shadow-md transition hover:scale-110 active:scale-95 ${isFavorite ? 'text-brand-tomato' : 'text-brand-ink/70'}`}
          aria-label={isFavorite ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(product.id)}
        >
          <Icon name="heart" className={isFavorite ? 'fill-brand-tomato' : ''} />
        </button>
        {product.tags?.includes('in-season') && <span className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3 rounded-full bg-brand-yellow px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-brand-green">In season</span>}
        {product.tags?.includes('organic') && <span className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 rounded-full bg-white/95 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-brand-green shadow-xs">Organic</span>}
        {available && product.branch_availability.available_quantity <= 5 && <span className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 rounded-full bg-brand-tomato px-2.5 py-0.5 sm:px-3 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-white">Low stock</span>}
      </div>
      <div className="px-1 pt-2.5 sm:pt-3 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1">
              <Link to={`/product/${product.slug}`} className="line-clamp-1 font-semibold text-sm sm:text-base text-brand-ink hover:text-brand-green">{product.name}</Link>
              <p className="mt-0.5 text-[11px] sm:text-xs text-brand-ink/55">{product.unit}</p>
            </div>
            <span className="shrink-0 text-xs sm:text-sm font-bold text-brand-green">{money(product.branch_availability?.price_minor ?? product.base_price_minor)}</span>
          </div>
        </div>
        {available ? (
          <div className="mt-2.5 sm:mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-1 text-[11px] font-medium text-brand-green"><span className="h-1.5 w-1.5 rounded-full bg-brand-green" />Available</span>
            <button onClick={quickAdd} className="button button-small button-primary w-full sm:w-auto text-xs py-1.5 px-3"><Icon name="plus" /> Quick add</button>
          </div>
        ) : (
          <div className="mt-2.5 sm:mt-3 rounded-xl border border-brand-green/10 bg-brand-cream/80 p-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-tomato">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-tomato" aria-hidden="true" />
              <span>Out of stock at {branch?.name ?? 'this branch'}</span>
            </p>
            {selectedOther ? (
              <div className="mt-2 border-t border-brand-green/10 pt-2">
                <p className="text-[10px] leading-tight text-brand-ink/65">
                  Available for in-store pickup at <span className="font-bold text-brand-green">{selectedOther.name}</span>.
                </p>
                <button
                  onClick={() => void switchToBranch(selectedOther.slug).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Branch switch failed.', 'error'))}
                  className="mt-1.5 flex items-center gap-1 text-[10px] font-bold tracking-wide text-brand-green hover:underline uppercase"
                  aria-label={`Switch to ${selectedOther.name} for pickup`}
                >
                  <Icon name="pin" className="h-3 w-3 shrink-0" />
                  <span>Shop at {selectedOther.name} instead</span>
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-[10px] text-brand-ink/50">Sold out across neighborhood branches.</p>
            )}
          </div>
        )}
        {selectedInventory && <span className="sr-only">Available at {selectedInventory.name}</span>}
      </div>
    </article>
  )
}

import { useState } from 'react'
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
  const [alternativesOpen, setAlternativesOpen] = useState(false)
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
    <article className="product-card group">
      <div className="relative">
        <Link to={`/product/${product.slug}`} className="block overflow-hidden">
          <LazyImage src={product.image_url || categoryImage(product.category)} alt={product.name} className="aspect-[1/1.05] transition-transform duration-500 group-hover:scale-[1.02]" />
        </Link>
        <button
          className={`absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-md transition hover:scale-105 ${isFavorite ? 'text-brand-tomato' : 'text-brand-ink/70'}`}
          aria-label={isFavorite ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite(product.id)}
        >
          <Icon name="heart" className={isFavorite ? 'fill-brand-tomato' : ''} />
        </button>
        {product.tags?.includes('in-season') && <span className="absolute left-3 top-3 rounded-full bg-brand-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-green">In season</span>}
        {product.tags?.includes('organic') && <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-green">Organic</span>}
        {available && product.branch_availability.available_quantity <= 5 && <span className="absolute bottom-3 right-3 rounded-full bg-brand-tomato px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Low stock</span>}
      </div>
      <div className="px-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/product/${product.slug}`} className="line-clamp-1 font-semibold text-brand-ink hover:text-brand-green">{product.name}</Link>
            <p className="mt-1 text-xs text-brand-ink/55">{product.unit}</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-brand-green">{money(product.branch_availability?.price_minor ?? product.base_price_minor)}</span>
        </div>
        {available ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[11px] text-brand-green"><span className="h-1.5 w-1.5 rounded-full bg-brand-green" />Available</span>
            <button onClick={quickAdd} className="button button-small button-primary"><Icon name="plus" /> Quick add</button>
          </div>
        ) : (
          <div className="mt-3 bg-brand-cream p-2.5">
            <p className="flex items-start gap-1.5 text-[11px] font-semibold leading-4 text-brand-tomato">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-tomato" aria-hidden="true" />
              <span>Unavailable at {branch?.name ?? 'this branch'}</span>
            </p>
            {selectedOther ? (
              <button
                onClick={() => void switchToBranch(selectedOther.slug).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Branch switch failed.', 'error'))}
                className="mt-2.5 flex w-full min-w-0 items-center gap-2 text-left text-brand-green transition-colors hover:text-brand-spinach focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green"
                aria-label={`Switch to ${selectedOther.name}, where this product is available`}
              >
                <Icon name="pin" className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-semibold uppercase leading-3 tracking-wider text-brand-ink/55">Available at</span>
                  <span className="block truncate text-xs font-bold leading-4">{selectedOther.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                  Switch <Icon name="arrow" className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : (
              <button className="mt-2.5 text-left text-xs font-bold text-brand-green hover:text-brand-spinach" onClick={() => setAlternativesOpen((open) => !open)}>
                Check other branches
              </button>
            )}
            {alternativesOpen && (
              <div className="mt-2 space-y-1 border-t border-brand-green/10 pt-2">
                {(product.available_at_other_branches ?? []).map((alternative) => (
                  <button
                    key={alternative.id}
                    className="block w-full text-left text-xs font-semibold text-brand-green hover:underline"
                    onClick={() => void switchToBranch(alternative.slug).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Branch switch failed.', 'error'))}
                  >
                    {alternative.name} · {money(alternative.price_minor)}
                  </button>
                ))}
                {!product.available_at_other_branches?.length && <span className="text-xs text-brand-ink/55">No other branch currently has this item.</span>}
              </div>
            )}
          </div>
        )}
        {selectedInventory && <span className="sr-only">Available at {selectedInventory.name}</span>}
      </div>
    </article>
  )
}

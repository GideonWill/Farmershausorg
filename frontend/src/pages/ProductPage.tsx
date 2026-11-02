import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, money, type Product } from '../lib/api'
import { categoryImage } from '../lib/images'
import { useStore } from '../stores/store'
import { addToCart, switchToBranch } from '../lib/shopping'
import { notify } from '../lib/notifications'
import { Icon, LazyImage } from '../components/ui'
import { useProducts } from '../hooks/useStoreData'
import { ProductCard } from '../components/ProductCard'

export function ProductPage() {
  const { slug = '' } = useParams()
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const queryClient = useQueryClient()
  const [imageIndex, setImageIndex] = useState(0)
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', branch?.id, slug],
    queryFn: () => api<Product>(`/products/${slug}/?branch=${branch?.id}`),
    enabled: Boolean(branch && slug),
  })
  const { data: products = [] } = useProducts()
  const relatedProducts = products.filter((item) => item.category === product?.category && item.id !== product?.id)
  if (isLoading) return <div className="section-wrap"><div className="grid gap-8 md:grid-cols-2"><div className="skeleton aspect-square rounded-3xl" /><div className="space-y-4"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-5 w-1/3" /></div></div></div>
  if (error || !product) return <div className="section-wrap"><p className="rounded-2xl bg-red-50 p-5 text-brand-tomato">{error instanceof Error ? error.message : 'Product not found.'}</p><Link to="/shop" className="button button-primary mt-4">Back to shop</Link></div>

  const gallery = [product.image_url, ...(product.gallery_image_urls ?? [])].filter(Boolean)
  const image = gallery[imageIndex] || categoryImage(product.category)
  const otherBranches = product.available_at_other_branches ?? []
  const nutrition = Object.entries(product.nutrition ?? {})
  return (
    <div>
      <div className="mx-auto max-w-[1440px] px-6 pt-6 text-sm text-brand-ink/50"><Link to="/" className="hover:text-brand-green">Home</Link><span className="mx-2">/</span><Link to="/shop" className="hover:text-brand-green">Shop</Link><span className="mx-2">/</span>{product.name}</div>
      <section className="mx-auto grid max-w-[1440px] gap-8 px-6 py-8 md:grid-cols-2 md:gap-14 md:py-12 lg:px-10">
        <div>
          <div className="overflow-hidden rounded-[2rem] bg-brand-cream">
            <LazyImage src={image} alt={product.name} className="aspect-square cursor-zoom-in transition-transform duration-500 hover:scale-[1.06]" />
          </div>
          {gallery.length > 1 && <div className="mt-3 flex gap-3">{gallery.map((url, index) => <button key={url} onClick={() => setImageIndex(index)} className={`h-20 w-20 overflow-hidden rounded-xl border-2 ${index === imageIndex ? 'border-brand-green' : 'border-transparent'}`}><LazyImage src={url} alt={`${product.name} view ${index + 1}`} className="h-full w-full" /></button>)}</div>}
        </div>
        <div className="self-center">
          <p className="eyebrow">{product.origin || 'Fresh market selection'}</p>
          <h1 className="font-brand-heading text-4xl font-bold text-brand-green sm:text-5xl">{product.name}</h1>
          <p className="mt-3 text-sm text-brand-ink/55">{product.unit}</p>
          <p className="mt-5 text-2xl font-bold text-brand-green">{money(product.branch_availability.price_minor)}</p>
          <p className="mt-5 leading-7 text-brand-ink/70">{product.description || `Fresh ${product.name.toLowerCase()}, selected for your table.`}</p>
          {product.tags?.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{product.tags.map((tag) => <span key={tag} className="rounded-full bg-brand-cream px-3 py-1 text-xs font-semibold capitalize text-brand-green">{tag.replaceAll('-', ' ')}</span>)}</div>}
          {product.branch_availability.is_available ? (
            <button className="button button-primary mt-7 w-full justify-center sm:w-auto" onClick={(e) => addToCart(product, branch, cartSessionKey, queryClient, setCartDrawerOpen, e)}>Add to basket <Icon name="plus" /></button>
          ) : (
            <div className="mt-7 rounded-2xl border border-brand-green/15 bg-brand-cream/80 p-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-tomato" />
                <p className="font-bold text-brand-tomato">Out of stock at {branch?.name ?? 'your selected branch'}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-brand-ink/70">
                Each FarmersHaus order is prepared and dispatched fresh from a single local branch. We do not split orders across branches to ensure produce arrives crisp and delivery riders aren't delayed.
              </p>
              {otherBranches.length > 0 ? (
                <div className="mt-4 border-t border-brand-green/10 pt-3">
                  <p className="text-xs font-semibold text-brand-ink/65">Available for in-store pickup at:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherBranches.map((alternative) => (
                      <button
                        key={alternative.id}
                        className="button button-small button-outline text-xs"
                        onClick={() => void switchToBranch(alternative.slug).catch((issue: unknown) => notify(issue instanceof Error ? issue.message : 'Branch switch failed.', 'error'))}
                      >
                        <Icon name="pin" /> {alternative.name} · {money(alternative.price_minor)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-brand-ink/50">Fresh stock is replenished regularly from our partnered farms.</p>
              )}
            </div>
          )}
          {product.origin && <p className="mt-5 text-sm"><strong>Origin:</strong> {product.origin}</p>}
          {nutrition.length > 0 && (
            <details className="mt-6 rounded-2xl border border-brand-green/10 p-4">
              <summary className="cursor-pointer font-semibold text-brand-green">Nutrition information</summary>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">{nutrition.map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="capitalize text-brand-ink/60">{key.replaceAll('_', ' ')}</dt><dd className="font-medium">{String(value)}</dd></div>)}</dl>
            </details>
          )}
        </div>
      </section>
      {relatedProducts.length > 0 && <section className="section-wrap border-t border-brand-green/10"><h2 className="section-title mb-7">You may also like</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">{relatedProducts.slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
    </div>
  )
}

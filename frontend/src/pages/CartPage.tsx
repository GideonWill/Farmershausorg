import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, money } from '../lib/api'
import { useBaskets, useCart } from '../hooks/useStoreData'
import { useStore } from '../stores/store'
import { Icon, LazyImage } from '../components/ui'
import { notify } from '../lib/notifications'

export function CartPage() {
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const { data: cart, isLoading } = useCart()
  const { data: baskets = [] } = useBaskets()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity?: number }) => {
      if (quantity === undefined) return api(`/cart/items/${id}/`, { method: 'DELETE', cartSessionKey })
      return api(`/cart/items/${id}/`, { method: 'PATCH', cartSessionKey, body: JSON.stringify({ quantity }) })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
    onError: (error) => notify(error instanceof Error ? error.message : 'Cart update failed.', 'error'),
  })
  const basketPrices = new Map(baskets.map((item) => [item.id, item.base_price_minor]))
  const subtotal = cart?.items.reduce((sum, item) => {
    const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
    return sum + price * item.quantity
  }, 0) ?? 0

  if (!branch) return <div className="section-wrap"><h1 className="section-title">Choose your branch</h1><p className="mt-2">Your cart is connected to a FarmersHaus location.</p></div>
  return (
    <div className="section-wrap min-h-[65vh]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Shopping from {branch.name}</p>
          <h1 className="section-title">Your cart</h1>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-brand-green/15 bg-brand-cream/80 px-4 py-2.5 shadow-xs">
          <Icon name="pin" className="h-5 w-5 shrink-0 text-brand-green" />
          <div>
            <p className="text-xs font-bold text-brand-green">Single-origin direct delivery</p>
            <p className="text-[11px] text-brand-ink/65">All items prepared &amp; dispatched together by {branch.name}</p>
          </div>
        </div>
      </div>
      {isLoading ? <div className="skeleton h-32" /> : !cart?.items.length ? (
        <div className="rounded-[2rem] bg-brand-cream px-6 py-14 text-center"><div className="mx-auto text-5xl">🧺</div><h2 className="mt-4 font-brand-heading text-3xl font-bold text-brand-green">Your cart is taking a breather</h2><p className="mt-2 text-brand-ink/60">Find fresh favorites and add them here.</p><Link className="button button-primary mt-6" to="/shop">Start shopping</Link></div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_350px]">
          <div className="space-y-3">
            {cart.items.map((item) => {
              const name = item.product?.name ?? item.basket_package?.name ?? 'Item'
              const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
              return (
                <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-green/10 bg-white p-4 shadow-xs sm:flex-nowrap">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-cream text-3xl"><LazyImage src={item.product?.image_url} alt={name} className="h-full w-full" /></div>
                  <div className="min-w-[130px] flex-1"><h2 className="font-semibold">{name}</h2><p className="mt-1 text-sm text-brand-ink/55">{item.product?.unit ?? 'FarmersHaus food basket'}</p><p className="mt-1 text-sm font-bold text-brand-green">{money(price)}</p></div>
                  <div className="flex items-center gap-2">
                    <button className="quantity-button" aria-label={`Decrease ${name} quantity`} onClick={() => mutation.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) })}><Icon name="minus" /></button>
                    <span className="min-w-7 text-center">{item.quantity}</span>
                    <button className="quantity-button" aria-label={`Increase ${name} quantity`} onClick={() => mutation.mutate({ id: item.id, quantity: item.quantity + 1 })}><Icon name="plus" /></button>
                  </div>
                  <strong className="ml-auto min-w-24 text-right">{money(price * item.quantity)}</strong>
                  <button className="icon-button text-brand-tomato" aria-label={`Remove ${name}`} onClick={() => mutation.mutate({ id: item.id })}><Icon name="close" /></button>
                </article>
              )
            })}
            <div className="rounded-2xl border border-brand-green/15 bg-brand-cream/80 p-4 text-xs leading-5 text-brand-ink/70">
              <p className="font-bold text-brand-green">Single-market guarantee:</p>
              <p className="mt-1">
                Your order is prepared 100% by FarmersHaus {branch.name}. To guarantee freshness and fast delivery, we never split orders across multiple branches.
              </p>
            </div>
          </div>
          <aside className="rounded-[1.7rem] bg-brand-cream p-6">
            <h2 className="font-brand-heading text-2xl font-bold text-brand-green">Order summary</h2>
            <div className="mt-5 flex justify-between text-sm"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <p className="mt-2 text-xs leading-5 text-brand-ink/55">Delivery fees and fulfillment details will be shown before payment.</p>
            <Link to="/checkout" className="button button-primary mt-6 w-full justify-center">Continue to checkout <Icon name="arrow" /></Link>
            <Link to="/shop" className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-brand-green"><Icon name="arrow" className="rotate-180" /> Continue shopping</Link>
          </aside>
        </div>
      )}
    </div>
  )
}

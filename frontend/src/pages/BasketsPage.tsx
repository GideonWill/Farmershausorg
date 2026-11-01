import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getList, money, type BasketPackage, type Product } from '../lib/api'
import { useBaskets, useProducts } from '../hooks/useStoreData'
import { useStore } from '../stores/store'
import { notify } from '../lib/notifications'
import { playAddToBasketSound, prepareAddToBasketSound } from '../lib/addToBasketSound'
import { Icon, LazyImage } from '../components/ui'

type BasketCategory = { id: string; slug: string; name: string; display_order: number }
type BasketFlight = { id: number; image: string; left: number; top: number; x: number; y: number }

const TOTE_IMAGE = '/brand/farmershaus-produce-tote.png'

export function BasketsPage() {
  const { data: baskets = [], isLoading, error } = useBaskets()
  const { data: products = [], isLoading: productsLoading, error: productsError } = useProducts()
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const setCartDrawerOpen = useStore((state) => state.setCartDrawerOpen)
  const queryClient = useQueryClient()
  const prefersReducedMotion = useReducedMotion()
  const toteTarget = useRef<HTMLImageElement>(null)
  const builderTarget = useRef<HTMLElement>(null)
  const flightSequence = useRef(0)
  const [mode, setMode] = useState<'ready' | 'custom'>('ready')
  const [category, setCategory] = useState('')
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [flight, setFlight] = useState<BasketFlight | null>(null)
  const [basketPulse, setBasketPulse] = useState(0)
  const { data: categories = [], error: categoriesError } = useQuery({
    queryKey: ['basket-categories'],
    queryFn: async () => getList(await api<BasketCategory[] | { results: BasketCategory[] }>('/basket-categories/')),
    staleTime: 5 * 60 * 1000,
  })

  const visibleBaskets = category ? baskets.filter((basket) => basket.category === category) : baskets
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => !query || product.name.toLowerCase().includes(query))
  }, [products, search])
  const selectedProducts = products.filter((product) => selectedItems[product.id])
  const selectedCount = Object.values(selectedItems).reduce((total, quantity) => total + quantity, 0)
  const selectedTotal = selectedProducts.reduce((total, product) =>
    total + product.branch_availability.price_minor * (selectedItems[product.id] ?? 0), 0)

  function flyToTarget(source: DOMRect, target: HTMLElement | null, image: string) {
    if (prefersReducedMotion || !target) return
    const targetRect = target.getBoundingClientRect()
    const size = 58
    setFlight({
      id: ++flightSequence.current,
      image,
      left: source.left + source.width / 2 - size / 2,
      top: source.top + source.height / 2 - size / 2,
      x: targetRect.left + targetRect.width / 2 - source.left - source.width / 2,
      y: targetRect.top + targetRect.height / 2 - source.top - source.height / 2,
    })
  }

  function selectProduct(product: Product, event: MouseEvent<HTMLButtonElement>) {
    if (!branch) {
      notify('Choose a branch before building your basket.', 'info')
      return
    }
    const currentQuantity = selectedItems[product.id] ?? 0
    const stock = product.branch_availability.available_quantity
    if (!product.branch_availability.is_available || currentQuantity >= stock) {
      notify(product.branch_availability.is_available ? 'You have selected all the available stock for this item.' : `This item is unavailable at ${branch.name}.`, 'info')
      return
    }
    prepareAddToBasketSound()
    setSelectedItems((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))
    playAddToBasketSound()
    setBasketPulse((current) => current + 1)
    flyToTarget(event.currentTarget.getBoundingClientRect(), toteTarget.current, product.image_url || TOTE_IMAGE)
  }

  function updateSelected(product: Product, delta: number) {
    setSelectedItems((current) => {
      const quantity = Math.min(product.branch_availability.available_quantity, (current[product.id] ?? 0) + delta)
      const updated = { ...current }
      if (quantity <= 0) delete updated[product.id]
      else updated[product.id] = quantity
      return updated
    })
  }

  const addBasketMutation = useMutation({
    mutationFn: (basket: BasketPackage) => {
      if (!branch) throw new Error('Choose a branch before adding a basket.')
      return api('/cart/items/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ branch_id: branch.id, basket_package_id: basket.id, quantity: 1 }),
      })
    },
    onSuccess: () => {
      playAddToBasketSound()
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      setCartDrawerOpen(true)
      notify('Basket added to your cart.', 'success')
    },
    onError: (issue) => notify(issue instanceof Error ? issue.message : 'Could not add this basket.', 'error'),
  })

  const addCustomMutation = useMutation({
    mutationFn: async () => {
      if (!branch) throw new Error('Choose a branch before adding your custom basket.')
      if (!selectedCount) throw new Error('Choose at least one available item for your basket.')
      const selections = selectedProducts.map((product) => ({
        product,
        quantity: selectedItems[product.id],
      }))
      const results = await Promise.allSettled(selections.map(({ product, quantity }) => api('/cart/items/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity }),
      })))
      const addedIds = selections.filter((_, index) => results[index].status === 'fulfilled').map(({ product }) => product.id)
      const failedNames = selections.filter((_, index) => results[index].status === 'rejected').map(({ product }) => product.name)
      return { addedIds, failedNames }
    },
    onSuccess: async ({ addedIds, failedNames }) => {
      if (addedIds.length) playAddToBasketSound()
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      setSelectedItems((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !addedIds.includes(id))))
      if (addedIds.length) setCartDrawerOpen(true)
      if (failedNames.length) {
        notify(`${addedIds.length} item type(s) added. Could not add: ${failedNames.join(', ')}. Your selections remain so you can retry.`, 'error')
      } else {
        notify('Your custom basket has been added to the cart.', 'success')
      }
    },
    onError: (issue) => notify(issue instanceof Error ? issue.message : 'Could not add your custom basket.', 'error'),
  })

  function addReadyBasket(basket: BasketPackage, event: MouseEvent<HTMLButtonElement>) {
    prepareAddToBasketSound()
    flyToTarget(
      event.currentTarget.getBoundingClientRect(),
      document.querySelector<HTMLElement>('header[data-storefront-nav] button[aria-label^="Open cart"]'),
      TOTE_IMAGE,
    )
    addBasketMutation.mutate(basket)
  }

  function addCustomBasket(event: MouseEvent<HTMLButtonElement>) {
    prepareAddToBasketSound()
    flyToTarget(
      event.currentTarget.getBoundingClientRect(),
      document.querySelector<HTMLElement>('header[data-storefront-nav] button[aria-label^="Open cart"]'),
      TOTE_IMAGE,
    )
    addCustomMutation.mutate()
  }

  function toggleOffer(key: string) {
    setExpandedOffer((current) => current === key ? null : key)
  }

  return (
    <div className="basket-page">
      <section className="basket-hero">
        <div className="basket-hero__content">
          <p className="eyebrow text-brand-yellow">Fresh picks, your way</p>
          <h1 className="font-brand-heading text-5xl font-bold leading-[1.04] sm:text-6xl lg:text-7xl">A good basket<br />starts here.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/80 sm:text-base">Choose a ready-made basket for an easy win, or build a personal mix from the fresh produce available at your branch.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              className={`button ${mode === 'ready' ? 'button-yellow' : 'basket-hero__secondary'}`}
              onClick={() => {
                setMode('ready')
                builderTarget.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Choose a basket
            </button>
            <button
              type="button"
              className={`button ${mode === 'custom' ? 'button-yellow' : 'basket-hero__secondary'}`}
              onClick={() => {
                setMode('custom')
                builderTarget.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Build your own <Icon name="arrow" />
            </button>
          </div>
          <p className="mt-5 text-xs text-white/60">{branch ? `Shopping from ${branch.name}` : 'Choose a branch to see local availability and prices.'}</p>
        </div>
        <div className="basket-hero__image-wrap">
          <div className="basket-hero__image-glow" />
          <img className="basket-hero__image" src={TOTE_IMAGE} alt="FarmersHaus tote filled with fresh fruit and vegetables" />
          <span className="basket-hero__badge">FRESHLY GATHERED</span>
        </div>
      </section>

      <section ref={builderTarget} id="basket-builder" className="section-wrap basket-builder" aria-live="polite">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{mode === 'ready' ? 'Easy to love' : 'Make it yours'}</p>
            <h2 className="section-title">{mode === 'ready' ? 'Choose your basket' : 'Build your own basket'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/60">
              {mode === 'ready'
                ? 'Ready-made bundles are a quick way to bring home a thoughtful mix.'
                : 'Choose the fresh items and quantities you want. Availability and prices reflect your selected branch.'}
            </p>
          </div>
          <div className="basket-mode-switch" role="group" aria-label="Basket options">
            <button
              type="button"
              className={`basket-mode-switch__button ${mode === 'ready' ? 'is-selected' : ''}`}
              onClick={() => {
                setMode('ready')
                builderTarget.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {mode === 'ready' && (
                <motion.div
                  layoutId="basket-mode-glass-pill"
                  className="basket-mode-switch__thumb"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">Ready-made</span>
            </button>
            <button
              type="button"
              className={`basket-mode-switch__button ${mode === 'custom' ? 'is-selected' : ''}`}
              onClick={() => {
                setMode('custom')
                builderTarget.current?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {mode === 'custom' && (
                <motion.div
                  layoutId="basket-mode-glass-pill"
                  className="basket-mode-switch__thumb"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">Customise</span>
            </button>
          </div>
        </div>

        {mode === 'ready' ? (
          <>
            <div className="mb-7 flex flex-wrap gap-2">
              <button onClick={() => setCategory('')} className={`filter-chip ${!category ? 'filter-chip-active' : ''}`}>All baskets</button>
              {categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`filter-chip ${category === item.id ? 'filter-chip-active' : ''}`}>{item.name}</button>)}
            </div>
            {categoriesError && <p className="mb-5 bg-red-50 p-4 text-sm text-brand-tomato">Basket categories could not be loaded: {categoriesError.message}</p>}
            {isLoading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton aspect-[1.2]" />)}</div>
              : error ? <p className="bg-red-50 p-5 text-brand-tomato">{error.message}</p>
                : visibleBaskets.length ? (
                  <div className="basket-package-grid">
                    {visibleBaskets.map((basket) => (
                      <ReadyBasketCard
                        key={basket.id}
                        basket={basket}
                        image={TOTE_IMAGE}
                        expanded={expandedOffer === basket.id}
                        onToggle={() => toggleOffer(basket.id)}
                        onAdd={(event) => addReadyBasket(basket, event)}
                        isAdding={addBasketMutation.isPending}
                        branchName={branch?.name}
                      />
                    ))}
                  </div>
                ) : <div className="basket-empty-state basket-empty-state--art">
                  <img className="basket-empty-state__image" src={TOTE_IMAGE} alt="FarmersHaus tote filled with fresh fruit and vegetables" />
                  <div><h3 className="font-brand-heading text-2xl font-bold text-brand-green">{category ? 'No baskets in this category yet' : 'Ready-made baskets are coming soon'}</h3><p className="mt-2 text-sm text-brand-ink/60">You can still build a custom basket from available fresh produce.</p><button className="button button-primary mt-5" onClick={() => setMode('custom')}>Build your own <Icon name="arrow" /></button></div>
                </div>}
          </>
        ) : (
          <div className="custom-basket-layout">
            <div className="custom-basket-catalogue">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-brand-heading text-xl font-bold text-brand-green">Pick your produce</h3><p className="mt-1 text-xs text-brand-ink/55">{products.length} catalogue items · {branch?.name ?? 'Select a branch for stock'}</p></div>
                <label className="custom-basket-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an ingredient" aria-label="Search produce for your basket" /></label>
              </div>
              {!branch && <div className="mb-4 bg-brand-yellow/20 p-4 text-sm text-brand-ink">Choose your branch in the header to see availability and add products.</div>}
              {productsLoading ? <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((item) => <div className="skeleton h-28" key={item} />)}</div>
                : productsError ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{productsError.message}</p>
                  : visibleProducts.length ? (
                    <div className="custom-basket-products">
                      {visibleProducts.map((product) => {
                        const quantity = selectedItems[product.id] ?? 0
                        const available = product.branch_availability.is_available && product.branch_availability.available_quantity > quantity
                        return (
                          <article className={`custom-basket-product ${quantity ? 'custom-basket-product--selected' : ''}`} key={product.id}>
                            <div className="custom-basket-product__image"><LazyImage src={product.image_url} alt={product.name} className="h-full w-full" /></div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-brand-ink">{product.name}</h4>
                              <p className="mt-1 text-xs text-brand-ink/55">{product.unit}</p>
                              <strong className="mt-2 block text-sm text-brand-green">{money(product.branch_availability.price_minor)}</strong>
                              {!product.branch_availability.is_available && <span className="mt-1 block text-[11px] text-brand-tomato">Unavailable at this branch</span>}
                              {product.branch_availability.is_available && product.branch_availability.available_quantity <= quantity && <span className="mt-1 block text-[11px] text-brand-ink/50">All available stock selected</span>}
                            </div>
                            {quantity > 0 ? (
                              <div className="custom-basket-quantity" aria-label={`${quantity} ${product.name} selected`}>
                                <button aria-label={`Remove one ${product.name}`} onClick={() => updateSelected(product, -1)}><Icon name="minus" /></button><span>{quantity}</span>
                                <button aria-label={`Add one ${product.name}`} disabled={!available} onClick={(event) => selectProduct(product, event)}><Icon name="plus" /></button>
                              </div>
                            ) : <button className="custom-basket-add" aria-label={`Add ${product.name} to custom basket`} disabled={!available || !branch} onClick={(event) => selectProduct(product, event)}><Icon name="plus" /><span>Add</span></button>}
                          </article>
                        )
                      })}
                    </div>
                  ) : <p className="bg-brand-cream p-5 text-sm text-brand-ink/65">{search ? 'No products match your search.' : 'No products are available in the catalogue right now.'}</p>}
            </div>

            <aside className="custom-basket-preview">
              <motion.div className="custom-basket-preview__tote" animate={basketPulse ? { scale: [1, 1.035, 1], rotate: [0, -1.5, 1.5, 0] } : undefined} transition={{ duration: 0.45 }}>
                <img ref={toteTarget} src={TOTE_IMAGE} alt="Your FarmersHaus custom basket" />
                <span className="custom-basket-preview__count">{selectedCount}</span>
              </motion.div>
              <p className="eyebrow mt-5">Your basket so far</p>
              <h3 className="font-brand-heading text-2xl font-bold text-brand-green">{selectedCount ? `${selectedCount} item${selectedCount === 1 ? '' : 's'} selected` : 'Start filling your tote'}</h3>
              <p className="mt-2 text-sm leading-6 text-brand-ink/60">{selectedCount ? 'Your selections are saved here until you add them to your cart.' : 'Add produce from the list to create a basket that feels like yours.'}</p>
              {selectedProducts.length > 0 && <ul className="mt-4 max-h-52 divide-y divide-brand-green/10 overflow-auto">{selectedProducts.map((product) => <li className="flex justify-between gap-3 py-2 text-xs" key={product.id}><span>{selectedItems[product.id]} × {product.name}</span><strong>{money(product.branch_availability.price_minor * selectedItems[product.id])}</strong></li>)}</ul>}
              <div className="mt-4 flex justify-between border-t border-brand-green/15 pt-4 text-sm"><span>Estimated total</span><strong className="text-brand-green">{money(selectedTotal)}</strong></div>
              <button className="button button-primary mt-5 w-full justify-center" disabled={!selectedCount || !branch || addCustomMutation.isPending} onClick={addCustomBasket}>
                {addCustomMutation.isPending ? 'Adding your basket…' : `Add ${selectedCount || ''} item${selectedCount === 1 ? '' : 's'} to cart`} <Icon name="arrow" />
              </button>
              {selectedCount > 0 && <button className="mt-3 w-full py-2 text-sm font-semibold text-brand-ink/55 hover:text-brand-tomato" onClick={() => setSelectedItems({})}>Clear selection</button>}
              <p className="mt-3 text-[11px] leading-5 text-brand-ink/45">Your custom basket is added as individual products, and the cart rechecks branch stock at checkout.</p>
            </aside>
          </div>
        )}
      </section>

      <AnimatePresence>
        {flight && (
          <motion.img
            key={flight.id}
            className="basket-flight"
            src={flight.image}
            alt=""
            aria-hidden="true"
            style={{ left: flight.left, top: flight.top }}
            initial={{ x: 0, y: 0, scale: 0.75, rotate: 0, opacity: 1 }}
            animate={{ x: flight.x, y: flight.y, scale: 0.16, rotate: 330, opacity: 0.15 }}
            transition={{ duration: 0.72, ease: [0.2, 0.75, 0.25, 1] }}
            onAnimationComplete={() => setFlight(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

function ReadyBasketCard({
  basket,
  image,
  expanded,
  onToggle,
  onAdd,
  isAdding,
  branchName,
}: {
  basket: BasketPackage
  image: string
  expanded: boolean
  onToggle: () => void
  onAdd: (event: MouseEvent<HTMLButtonElement>) => void
  isAdding: boolean
  branchName?: string
}) {
  const contentsId = `basket-contents-${basket.id}`
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.article layout className="basket-package-card">
      <button
        type="button"
        className="basket-package-card__details"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? contentsId : undefined}
        aria-label={`${expanded ? 'Fold' : 'Open'} ${basket.name} to ${expanded ? 'hide' : 'see'} its contents`}
      >
        <div className="basket-package-card__image">
          <img className="basket-package-art" src={image} alt={`${basket.name} FarmersHaus produce tote`} />
          {basket.is_placeholder && <span className="basket-package-card__tag">Preview package</span>}
        </div>
        <div className="p-5">
          <span className="eyebrow">{basket.category_name || 'FarmersHaus selection'}</span>
          <h3 className="font-brand-heading text-2xl font-bold text-brand-green">{basket.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-brand-ink/60">{basket.description}</p>
          <span className="basket-package-toggle-hint">
            {expanded ? 'Tap to fold the items back into the bag' : 'Tap the bag to see what’s inside'}
            <Icon name="arrow" className={expanded ? 'rotate-180' : ''} />
          </span>
          <p className="basket-package-price"><span>Basket total</span><strong>{money(basket.branch_availability.price_minor)}</strong></p>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={contentsId}
            className="basket-package-contents"
            initial={{ height: 0, opacity: 0, y: prefersReducedMotion ? 0 : -24, scaleY: prefersReducedMotion ? 1 : 0.88 }}
            animate={{ height: 'auto', opacity: 1, y: 0, scaleY: 1 }}
            exit={{ height: 0, opacity: 0, y: prefersReducedMotion ? 0 : -22, scaleY: prefersReducedMotion ? 1 : 0.9 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.42, ease: [0.2, 0.75, 0.25, 1] }}
            style={{ transformOrigin: 'top center' }}
          >
            <h4>Everything in the bag</h4>
            {basket.components.length ? (
              <motion.ul
                initial="closed"
                animate="open"
                exit="closed"
                variants={{
                  open: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.045, delayChildren: prefersReducedMotion ? 0 : 0.08 } },
                  closed: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.02, staggerDirection: -1 } },
                }}
              >
                {basket.components.map((component) => (
                  <motion.li
                    key={component.product}
                    variants={{
                      open: { opacity: 1, y: 0, scale: 1 },
                      closed: { opacity: 0, y: -12, scale: 0.96 },
                    }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
                  >
                    <span>{component.product_name}{component.is_optional && <span className="basket-package-optional">Optional</span>}</span>
                    <strong>{component.quantity} × {component.product_unit}</strong>
                  </motion.li>
                ))}
              </motion.ul>
            ) : <p>Contents are being finalized.</p>}
            <p className="basket-package-price basket-package-price--expanded">
              <span>Total basket price</span><strong>{money(basket.branch_availability.price_minor)}</strong>
            </p>
            <button type="button" className="basket-package-fold" onClick={onToggle}>
              Fold items back into the bag <Icon name="arrow" className="rotate-180" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-5 pb-5">
        {basket.branch_availability.is_available
          ? <button className="button button-primary w-full justify-center" disabled={isAdding} onClick={onAdd}>{isAdding ? 'Adding basket…' : 'Add ready-made basket'} <Icon name="plus" /></button>
          : <p className="basket-package-card__unavailable">{branchName ? `Currently unavailable at ${branchName}` : 'Choose a branch to check availability'}</p>}
      </div>
    </motion.article>
  )
}

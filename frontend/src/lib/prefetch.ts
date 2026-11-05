/**
 * Intelligent client-side prefetching system.
 * Warms up route chunks, critical images, and API endpoints on hover/touchstart
 * so that navigation feels instantaneous (0 perceived latency).
 */

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/': () => Promise.resolve(),
  '/shop': () => Promise.resolve(),
  '/baskets': () => Promise.resolve(),
  '/recipes': () => Promise.resolve(),
  '/find-us': () => Promise.resolve(),
  '/contact': () => Promise.resolve(),
  '/cart': () => Promise.resolve(),
  '/about': () => Promise.resolve(),
  '/faqs': () => Promise.resolve(),
  '/delivery-info': () => Promise.resolve(),
  '/terms': () => Promise.resolve(),
  '/privacy': () => Promise.resolve(),
  '/refund-policy': () => Promise.resolve(),
  '/checkout': () => import('../pages/CheckoutPage'),
  '/account': () => import('../pages/AccountPage'),
  '/staff': () => import('../pages/StaffDashboardPage'),
}

const prefetchedPaths = new Set<string>()

export function prefetchRoute(href: string, immediate = false) {
  if (!href || typeof window === 'undefined') return
  const path = href.split('?')[0].split('#')[0]
  if (prefetchedPaths.has(path)) return
  prefetchedPaths.add(path)

  const prefetcher = routePrefetchers[path]
  if (prefetcher) {
    if (immediate) {
      void prefetcher()
    } else if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => void prefetcher(), { timeout: 1200 })
    } else {
      setTimeout(() => void prefetcher(), 30)
    }
  }

  // Also pre-cache critical images associated with the target route
  if (path === '/baskets') {
    const img = new Image()
    img.src = '/brand/farmershaus-produce-tote.webp'
  }
}

/**
 * Attaches a passive hover & touch listener to document to prefetch internal links
 * and automatically warms up core high-traffic routes on idle.
 */
export function initRoutePrefetching() {
  if (typeof window === 'undefined') return () => {}

  const handlePointer = (event: Event) => {
    const target = (event.target as HTMLElement)?.closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      // Touch or pointerdown indicates active navigation intent; fetch immediately!
      const isTouch = event.type === 'touchstart' || event.type === 'pointerdown'
      prefetchRoute(href, isTouch)
    }
  }

  document.addEventListener('mouseover', handlePointer, { passive: true })
  document.addEventListener('touchstart', handlePointer, { passive: true })
  document.addEventListener('pointerdown', handlePointer, { passive: true })

  // Warm up primary storefront routes immediately during initial idle
  const idleWarmup = () => {
    prefetchRoute('/baskets', false)
    prefetchRoute('/shop', false)
  }

  let idleHandle: number | ReturnType<typeof setTimeout> | undefined
  if ('requestIdleCallback' in window) {
    idleHandle = window.requestIdleCallback(idleWarmup, { timeout: 1500 })
  } else {
    idleHandle = setTimeout(idleWarmup, 100)
  }

  return () => {
    document.removeEventListener('mouseover', handlePointer)
    document.removeEventListener('touchstart', handlePointer)
    document.removeEventListener('pointerdown', handlePointer)
    if (idleHandle !== undefined) {
      if ('cancelIdleCallback' in window && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle)
      } else {
        clearTimeout(idleHandle)
      }
    }
  }
}

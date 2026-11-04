/**
 * Intelligent client-side prefetching system.
 * Warms up route chunks, critical images, and API endpoints on hover/touchstart
 * so that navigation feels instantaneous (0 perceived latency).
 */

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/HomePage'),
  '/shop': () => import('../pages/ShopPage'),
  '/baskets': () => import('../pages/BasketsPage'),
  '/cart': () => import('../pages/CartPage'),
  '/checkout': () => import('../pages/CheckoutPage'),
  '/account': () => import('../pages/AccountPage'),
  '/recipes': () => import('../pages/RecipesPage'),
  '/find-us': () => import('../pages/FindUsPage'),
  '/contact': () => import('../pages/ContactPage'),
  '/about': () => import('../pages/InfoPage'),
  '/faqs': () => import('../pages/InfoPage'),
  '/delivery-info': () => import('../pages/InfoPage'),
  '/terms': () => import('../pages/InfoPage'),
  '/privacy': () => import('../pages/InfoPage'),
  '/refund-policy': () => import('../pages/InfoPage'),
  '/staff': () => import('../pages/StaffDashboardPage'),
}

const prefetchedPaths = new Set<string>()

export function prefetchRoute(href: string) {
  if (!href || typeof window === 'undefined') return
  const path = href.split('?')[0].split('#')[0]
  if (prefetchedPaths.has(path)) return
  prefetchedPaths.add(path)

  const prefetcher = routePrefetchers[path]
  if (prefetcher) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => void prefetcher(), { timeout: 1500 })
    } else {
      setTimeout(() => void prefetcher(), 40)
    }
  }
}

/**
 * Attaches a passive hover & touch listener to document to prefetch internal links
 */
export function initRoutePrefetching() {
  if (typeof window === 'undefined') return () => {}

  const handlePointer = (event: Event) => {
    const target = (event.target as HTMLElement)?.closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      prefetchRoute(href)
    }
  }

  document.addEventListener('mouseover', handlePointer, { passive: true })
  document.addEventListener('touchstart', handlePointer, { passive: true })

  return () => {
    document.removeEventListener('mouseover', handlePointer)
    document.removeEventListener('touchstart', handlePointer)
  }
}

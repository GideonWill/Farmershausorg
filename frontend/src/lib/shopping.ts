import type { QueryClient } from '@tanstack/react-query'
import { api, type Branch, type Cart, type Product } from './api'
import { notify } from './notifications'
import { flyToCart } from './cartFlyEffect'
import { ingredientImage, categoryImage } from './images'

export function addToCart(
  product: Product,
  branch: Branch | null,
  cartSessionKey: string,
  queryClient: QueryClient,
  setDrawerOpen: (open: boolean) => void,
  fromElementOrEvent?: HTMLElement | React.MouseEvent | { x: number; y: number } | null,
) {
  if (!branch) {
    notify('Choose a branch before adding products to your cart.', 'info')
    return
  }

  // Trigger the throwing arc interaction towards the header cart icon
  flyToCart(
    fromElementOrEvent,
    product.image_url || ingredientImage(product.slug) || categoryImage(product.category),
  )

  void api<Cart>('/cart/items/', {
    method: 'POST',
    cartSessionKey,
    body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity: 1 }),
  })
    .then(() => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      setTimeout(() => setDrawerOpen(true), 450)
    })
    .catch((error: unknown) =>
      notify(error instanceof Error ? error.message : 'Could not add this item.', 'error'),
    )
}

export async function switchToBranch(slug: string): Promise<void> {
  const branch = await api<Branch>(`/branches/${slug}/`)
  window.dispatchEvent(new CustomEvent('farmershaus:choose-branch', { detail: branch }))
}

export function requestBranchPicker() {
  window.dispatchEvent(new Event('farmershaus:choose-branch'))
}

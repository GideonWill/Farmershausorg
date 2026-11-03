import type { QueryClient } from '@tanstack/react-query'
import { api, type Branch, type Cart, type Product } from './api'
import { notify } from './notifications'
import { flyToCart } from './cartFlyEffect'
import { ingredientImage, categoryImage } from './images'
import { addProductToLocalCart } from './cartManager'

export function addToCart(
  product: Product,
  branch: Branch | null,
  cartSessionKey: string,
  queryClient: QueryClient,
  _setDrawerOpen?: (open: boolean) => void,
  fromElementOrEvent?: HTMLElement | React.MouseEvent | { x: number; y: number } | null,
) {
  // Always add to local cart state instantly
  addProductToLocalCart(product, branch, 1)

  // Trigger visual arc animation
  flyToCart(
    fromElementOrEvent,
    product.image_url || ingredientImage(product.slug) || categoryImage(product.category),
  )

  notify(`Added ${product.name} to your basket!`, 'success')

  // Invalidate query so UI re-reads the updated cart immediately
  void queryClient.invalidateQueries({ queryKey: ['cart'] })

  // Synchronize with backend API in the background if available
  if (branch) {
    void api<Cart>('/cart/items/', {
      method: 'POST',
      cartSessionKey,
      body: JSON.stringify({ branch_id: branch.id, product_id: product.id, quantity: 1 }),
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
      })
      .catch((err) => {
        console.warn('Backend sync deferred, cart stored locally:', err)
      })
  }
}

export async function switchToBranch(slug: string): Promise<void> {
  const branch = await api<Branch>(`/branches/${slug}/`)
  window.dispatchEvent(new CustomEvent('farmershaus:choose-branch', { detail: branch }))
}

export function requestBranchPicker() {
  window.dispatchEvent(new Event('farmershaus:choose-branch'))
}

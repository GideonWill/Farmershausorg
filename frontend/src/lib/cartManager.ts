import type { Cart, CartItem, Product, BasketPackage, Branch } from './api'
import mockStoreData from './mockStoreData.json'

const CART_STORAGE_KEY = 'farmershaus-local-cart'
const DEFAULT_BRANCH = (mockStoreData.branches[0] as Branch)

export function getLocalCart(branchId?: string): Cart {
  if (typeof window === 'undefined') {
    return { id: 'local-cart', branch: branchId || DEFAULT_BRANCH.id, status: 'active', items: [], updated_at: new Date().toISOString() }
  }

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Cart
      if (!branchId || parsed.branch === branchId) {
        return parsed
      }
    }
  } catch {
    // ignore
  }

  const initial: Cart = {
    id: 'local-cart',
    branch: branchId || DEFAULT_BRANCH.id,
    status: 'active',
    items: [],
    updated_at: new Date().toISOString(),
  }
  saveLocalCart(initial)
  return initial
}

export function saveLocalCart(cart: Cart): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('farmershaus:cart-updated', { detail: cart }))
  } catch {
    // ignore
  }
}

export function addProductToLocalCart(product: Product, branch: Branch | null, quantity = 1): Cart {
  const currentBranchId = branch?.id || DEFAULT_BRANCH.id
  const cart = getLocalCart(currentBranchId)
  cart.branch = currentBranchId

  const existingIndex = cart.items.findIndex((item) => item.product?.id === product.id)
  if (existingIndex > -1) {
    cart.items[existingIndex].quantity += quantity
  } else {
    const newItem: CartItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        unit: product.unit,
        unit_type: product.unit_type,
        image_url: product.image_url,
        unit_price_minor: product.base_price_minor,
        is_available: true,
      },
      basket_package: null,
      quantity,
      gift_recipient_name: '',
      gift_message: '',
    }
    cart.items.push(newItem)
  }

  cart.updated_at = new Date().toISOString()
  saveLocalCart(cart)
  return cart
}

export function addBasketToLocalCart(basket: BasketPackage, branch: Branch | null, quantity = 1): Cart {
  const currentBranchId = branch?.id || DEFAULT_BRANCH.id
  const cart = getLocalCart(currentBranchId)
  cart.branch = currentBranchId

  const existingIndex = cart.items.findIndex((item) => item.basket_package?.id === basket.id)
  if (existingIndex > -1) {
    cart.items[existingIndex].quantity += quantity
  } else {
    const newItem: CartItem = {
      id: 'basket-item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      product: null,
      basket_package: {
        id: basket.id,
        name: basket.name,
        slug: basket.slug,
        is_placeholder: basket.is_placeholder,
      },
      quantity,
      gift_recipient_name: '',
      gift_message: '',
    }
    cart.items.push(newItem)
  }

  cart.updated_at = new Date().toISOString()
  saveLocalCart(cart)
  return cart
}

export function updateLocalCartItemQuantity(itemId: string, quantity?: number): Cart {
  const cart = getLocalCart()
  if (quantity === undefined || quantity <= 0) {
    cart.items = cart.items.filter((item) => item.id !== itemId)
  } else {
    const item = cart.items.find((i) => i.id === itemId)
    if (item) item.quantity = quantity
  }

  cart.updated_at = new Date().toISOString()
  saveLocalCart(cart)
  return cart
}

export function clearLocalCart(branchId?: string): Cart {
  const empty: Cart = {
    id: 'local-cart',
    branch: branchId || DEFAULT_BRANCH.id,
    status: 'active',
    items: [],
    updated_at: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(empty))
      window.dispatchEvent(new CustomEvent('farmershaus:cart-updated', { detail: empty }))
      window.dispatchEvent(new CustomEvent('farmershaus:cart-cleared', { detail: empty }))
    } catch {
      // ignore
    }
  }
  return empty
}

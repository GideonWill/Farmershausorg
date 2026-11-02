import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuthTokens } from '../lib/auth'
import { api, getList, type BasketPackage, type Branch, type Cart, type Category, type Product, type SiteSettings } from '../lib/api'
import { useStore } from '../stores/store'
import mockStoreData from '../lib/mockStoreData.json'
import mockBasketsData from '../lib/mockBaskets.json'
import mockBasketCategoriesData from '../lib/mockBasketCategories.json'

export type BasketCategory = { id: string; slug: string; name: string; display_order: number }

const FALLBACK_BRANCHES: Branch[] = mockStoreData.branches as Branch[]
const FALLBACK_CATEGORIES: Category[] = mockStoreData.categories as Category[]
const FALLBACK_PRODUCTS: Product[] = mockStoreData.products as unknown as Product[]
const FALLBACK_BASKETS: BasketPackage[] = mockBasketsData as unknown as BasketPackage[]
const FALLBACK_BASKET_CATEGORIES: BasketCategory[] = mockBasketCategoriesData as unknown as BasketCategory[]

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      try {
        const res = await api<Branch[] | { results: Branch[] }>('/branches/')
        const list = getList(res)
        return list.length > 0 ? list : FALLBACK_BRANCHES
      } catch {
        return FALLBACK_BRANCHES
      }
    },
    staleTime: 5 * 60 * 1000,
    initialData: FALLBACK_BRANCHES,
  })
}

export function useResolvedBranch(): Branch | null {
  const branch = useStore((state) => state.branch)
  const { data: branches = FALLBACK_BRANCHES } = useBranches()
  if (branch && branches.some((b) => b.id === branch.id && b.is_active)) {
    return branch
  }
  return branches.find((b) => b.is_active) ?? branches[0] ?? FALLBACK_BRANCHES[0] ?? null
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      try {
        return await api<SiteSettings>('/site-settings/')
      } catch {
        return {
          contact: {
            primary_phone: '+233 55 420 8446',
            secondary_phone: '+233 55 420 8447',
            whatsapp_numbers: ['+233554208446'],
            email: 'support@farmershausgh.com',
            social_links: { instagram: 'https://instagram.com/farmershaus' },
            announcement_bar_text: 'Fresh Organic Harvest Delivered Straight to Your Doorstep!',
            delivery_policy_text: 'Same-day delivery across Accra when ordered before 2 PM.',
          },
          site: {
            currency_code: 'GHS',
            currency_symbol: 'GH₵',
            tagline: 'Premium Farm-Fresh Produce in Accra',
          },
        } as SiteSettings
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const res = await api<Category[] | { results: Category[] }>('/categories/')
        const list = getList(res)
        return list.length > 0 ? list : FALLBACK_CATEGORIES
      } catch {
        return FALLBACK_CATEGORIES
      }
    },
    staleTime: 5 * 60 * 1000,
    initialData: FALLBACK_CATEGORIES,
  })
}

export function useProducts(filters: {
  category?: string
  search?: string
  ordering?: string
  organic?: boolean
  in_season?: boolean
  min_price?: number
  max_price?: number
} = {}) {
  const branch = useResolvedBranch()
  const params = new URLSearchParams()
  params.set('page_size', '100')
  if (branch) params.set('branch', branch.id)
  if (filters.category) params.set('category', filters.category)
  if (filters.search) params.set('search', filters.search)
  if (filters.ordering) params.set('ordering', filters.ordering)
  if (filters.organic !== undefined) params.set('organic', String(filters.organic))
  if (filters.in_season !== undefined) params.set('in_season', String(filters.in_season))
  if (filters.min_price !== undefined) params.set('min_price', String(filters.min_price))
  if (filters.max_price !== undefined) params.set('max_price', String(filters.max_price))

  return useQuery({
    queryKey: ['products', branch?.id, filters],
    queryFn: async () => {
      try {
        const payload = await api<Product[] | { results: Product[] }>(`/products/?${params}`)
        const list = getList(payload)
        if (list.length > 0) return list
      } catch {
        // Fall back gracefully below
      }

      let filtered = [...FALLBACK_PRODUCTS]
      if (filters.category) {
        filtered = filtered.filter((p) => p.category === filters.category)
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      }
      if (filters.in_season) {
        filtered = filtered.filter((p) => p.tags.includes('in-season'))
      }
      if (filters.organic) {
        filtered = filtered.filter((p) => p.tags.includes('organic'))
      }
      if (filters.min_price !== undefined) {
        filtered = filtered.filter((p) => p.base_price_minor >= (filters.min_price || 0))
      }
      if (filters.max_price !== undefined) {
        filtered = filtered.filter((p) => p.base_price_minor <= (filters.max_price || Infinity))
      }
      return filtered
    },
    staleTime: 3 * 60 * 1000,
    initialData: FALLBACK_PRODUCTS,
  })
}

export function useProduct(slug: string) {
  const branch = useResolvedBranch()
  const fallbackProduct = FALLBACK_PRODUCTS.find((p) => p.slug === slug || p.id === slug) ?? null
  return useQuery({
    queryKey: ['product', branch?.id, slug],
    queryFn: async () => {
      try {
        return await api<Product>(`/products/${slug}/?branch=${branch?.id}`)
      } catch {
        if (fallbackProduct) return fallbackProduct
        throw new Error('Product not found')
      }
    },
    enabled: Boolean(slug),
    initialData: fallbackProduct ?? undefined,
    staleTime: 3 * 60 * 1000,
  })
}

export function useBaskets() {
  const branch = useResolvedBranch()
  return useQuery({
    queryKey: ['baskets', branch?.id],
    queryFn: async () => {
      try {
        const res = await api<BasketPackage[] | { results: BasketPackage[] }>(
          `/basket-packages/?branch=${branch?.id}`,
        )
        const list = getList(res)
        return list.length > 0 ? list : FALLBACK_BASKETS
      } catch {
        return FALLBACK_BASKETS
      }
    },
    staleTime: 3 * 60 * 1000,
    initialData: FALLBACK_BASKETS,
  })
}

export function useBasketCategories() {
  return useQuery({
    queryKey: ['basket-categories'],
    queryFn: async () => {
      try {
        const res = await api<BasketCategory[] | { results: BasketCategory[] }>('/basket-categories/')
        const list = getList(res)
        return list.length > 0 ? list : FALLBACK_BASKET_CATEGORIES
      } catch {
        return FALLBACK_BASKET_CATEGORIES
      }
    },
    staleTime: 5 * 60 * 1000,
    initialData: FALLBACK_BASKET_CATEGORIES,
  })
}

export function useCart() {
  const branch = useResolvedBranch()
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const [hasToken, setHasToken] = useState(() => Boolean(getAuthTokens()?.access))

  useEffect(() => {
    const onAuth = () => setHasToken(Boolean(getAuthTokens()?.access))
    window.addEventListener('farmershaus:auth-changed', onAuth)
    return () => window.removeEventListener('farmershaus:auth-changed', onAuth)
  }, [])

  return useQuery({
    queryKey: ['cart', branch?.id, cartSessionKey, hasToken ? 'auth' : 'guest'],
    queryFn: async () => {
      try {
        return (await api<{ cart: Cart | null }>(
          `/cart/?branch=${branch?.id}`,
          { cartSessionKey },
        )).cart
      } catch {
        return null
      }
    },
    refetchOnMount: 'always',
  })
}

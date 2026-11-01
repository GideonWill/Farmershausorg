import { useQuery } from '@tanstack/react-query'
import { api, getList, type BasketPackage, type Branch, type Cart, type Category, type Product, type SiteSettings } from '../lib/api'
import { useStore } from '../stores/store'

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => getList(await api<Branch[] | { results: Branch[] }>('/branches/')),
    staleTime: 5 * 60 * 1000,
  })
}

export function useResolvedBranch(): Branch | null {
  const branch = useStore((state) => state.branch)
  const { data: branches = [] } = useBranches()
  if (branch && branches.some((b) => b.id === branch.id && b.is_active)) {
    return branch
  }
  return branches.find((b) => b.is_active) ?? branches[0] ?? null
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api<SiteSettings>('/site-settings/'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => getList(await api<Category[] | { results: Category[] }>('/categories/')),
    staleTime: 5 * 60 * 1000,
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
      const payload = await api<Product[] | { results: Product[] }>(`/products/?${params}`)
      return getList(payload)
    },
    enabled: Boolean(branch),
  })
}

export function useBaskets() {
  const branch = useResolvedBranch()
  return useQuery({
    queryKey: ['baskets', branch?.id],
    queryFn: async () => getList(await api<BasketPackage[] | { results: BasketPackage[] }>(
      `/basket-packages/?branch=${branch?.id}`,
    )),
    enabled: Boolean(branch),
    refetchOnMount: 'always',
  })
}

export function useCart() {
  const branch = useResolvedBranch()
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  return useQuery({
    queryKey: ['cart', branch?.id, cartSessionKey],
    queryFn: async () => (await api<{ cart: Cart | null }>(
      `/cart/?branch=${branch?.id}`,
      { cartSessionKey },
    )).cart,
    enabled: Boolean(branch),
  })
}

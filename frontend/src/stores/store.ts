import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Branch } from '../lib/api'

type StoreState = {
  branch: Branch | null
  cartSessionKey: string
  favorites: string[]
  cartDrawerOpen: boolean
  setBranch: (branch: Branch) => void
  toggleFavorite: (productId: string) => void
  setCartDrawerOpen: (open: boolean) => void
}

function createCartSessionKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      branch: null,
      cartSessionKey: createCartSessionKey(),
      favorites: [],
      cartDrawerOpen: false,
      setBranch: (branch) => set({ branch }),
      toggleFavorite: (productId) => set((state) => ({
        favorites: state.favorites.includes(productId)
          ? state.favorites.filter((id) => id !== productId)
          : [...state.favorites, productId],
      })),
      setCartDrawerOpen: (cartDrawerOpen) => set({ cartDrawerOpen }),
    }),
    {
      name: 'farmershaus-store',
      partialize: ({ branch, cartSessionKey, favorites }) => ({
        branch,
        cartSessionKey,
        favorites,
      }),
    },
  ),
)

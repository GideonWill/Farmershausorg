import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 3 * 60 * 1000, // 3 minutes stale time to avoid repetitive fetches and UI flicker
      gcTime: 10 * 60 * 1000,   // 10 minutes cache persistence
    },
  },
})

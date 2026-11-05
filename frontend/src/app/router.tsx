import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Storefront } from '../components/Storefront'
import { RootErrorBoundary } from '../components/ErrorBoundary'

import { HomePage } from '../pages/HomePage'
import { ShopPage } from '../pages/ShopPage'
import { BasketsPage } from '../pages/BasketsPage'
import { RecipesPage } from '../pages/RecipesPage'
import { FindUsPage } from '../pages/FindUsPage'
import { ContactPage } from '../pages/ContactPage'
import { CartPage } from '../pages/CartPage'
import { InfoPage } from '../pages/InfoPage'
import { ProductPage } from '../pages/ProductPage'
import { NotFoundPage } from '../pages/NotFoundPage'

/**
 * Resilient dynamic import wrapper for heavier secondary pages.
 */
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      console.warn('Initial dynamic import failed, retrying once...', error)
      try {
        await new Promise((resolve) => setTimeout(resolve, 350))
        return await factory()
      } catch (retryError) {
        console.error('Dynamic import retry failed:', retryError)
        throw retryError
      }
    }
  })
}

const AccountPage = lazyWithRetry(() => import('../pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const CheckoutPage = lazyWithRetry(() => import('../pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })))
const OrderPage = lazyWithRetry(() => import('../pages/OrderPage').then((module) => ({ default: module.OrderPage })))
const StaffDashboardPage = lazyWithRetry(() => import('../pages/StaffDashboardPage').then((module) => ({ default: module.StaffDashboardPage })))

export const router = createBrowserRouter([
  {
    path: '/staff',
    element: <StaffDashboardPage />,
    errorElement: <RootErrorBoundary />,
  },
  {
    path: '/',
    element: <Storefront />,
    errorElement: <RootErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'shop/category/:category', element: <ShopPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'baskets', element: <BasketsPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders/:orderNumber', element: <OrderPage /> },
      { path: 'orders/:orderNumber/tracking', element: <OrderPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'find-us', element: <FindUsPage /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: 'recipes/:slug', element: <RecipesPage /> },
      { path: 'about', element: <InfoPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'faqs', element: <InfoPage /> },
      { path: 'delivery-info', element: <InfoPage /> },
      { path: 'terms', element: <InfoPage /> },
      { path: 'privacy', element: <InfoPage /> },
      { path: 'refund-policy', element: <InfoPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

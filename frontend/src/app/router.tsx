import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Storefront } from '../components/Storefront'
import { RootErrorBoundary } from '../components/ErrorBoundary'

/**
 * Resilient dynamic import wrapper that handles Vite chunk reload errors and transient network dropouts.
 * If fetching a dynamically imported chunk fails (e.g. after a redeployment), it attempts one automatic retry
 * before falling through to the RootErrorBoundary.
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
        // Small delay to allow network recovery
        await new Promise((resolve) => setTimeout(resolve, 350))
        return await factory()
      } catch (retryError) {
        console.error('Dynamic import retry failed:', retryError)
        throw retryError
      }
    }
  })
}

const HomePage = lazyWithRetry(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })))
const ShopPage = lazyWithRetry(() => import('../pages/ShopPage').then((module) => ({ default: module.ShopPage })))
const ProductPage = lazyWithRetry(() => import('../pages/ProductPage').then((module) => ({ default: module.ProductPage })))
const BasketsPage = lazyWithRetry(() => import('../pages/BasketsPage').then((module) => ({ default: module.BasketsPage })))
const CartPage = lazyWithRetry(() => import('../pages/CartPage').then((module) => ({ default: module.CartPage })))
const AccountPage = lazyWithRetry(() => import('../pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const CheckoutPage = lazyWithRetry(() => import('../pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })))
const OrderPage = lazyWithRetry(() => import('../pages/OrderPage').then((module) => ({ default: module.OrderPage })))
const FindUsPage = lazyWithRetry(() => import('../pages/FindUsPage').then((module) => ({ default: module.FindUsPage })))
const RecipesPage = lazyWithRetry(() => import('../pages/RecipesPage').then((module) => ({ default: module.RecipesPage })))
const InfoPage = lazyWithRetry(() => import('../pages/InfoPage').then((module) => ({ default: module.InfoPage })))
const ContactPage = lazyWithRetry(() => import('../pages/ContactPage').then((module) => ({ default: module.ContactPage })))
const NotFoundPage = lazyWithRetry(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const StaffDashboardPage = lazyWithRetry(() => import('../pages/StaffDashboardPage').then((module) => ({ default: module.StaffDashboardPage })))

const router = createBrowserRouter([
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

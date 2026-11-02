import { lazy } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Storefront } from '../components/Storefront'

const HomePage = lazy(() => import('../pages/HomePage').then((module) => ({ default: module.HomePage })))
const ShopPage = lazy(() => import('../pages/ShopPage').then((module) => ({ default: module.ShopPage })))
const ProductPage = lazy(() => import('../pages/ProductPage').then((module) => ({ default: module.ProductPage })))
const BasketsPage = lazy(() => import('../pages/BasketsPage').then((module) => ({ default: module.BasketsPage })))
const CartPage = lazy(() => import('../pages/CartPage').then((module) => ({ default: module.CartPage })))
const AccountPage = lazy(() => import('../pages/AccountPage').then((module) => ({ default: module.AccountPage })))
const CheckoutPage = lazy(() => import('../pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })))
const OrderPage = lazy(() => import('../pages/OrderPage').then((module) => ({ default: module.OrderPage })))
const FindUsPage = lazy(() => import('../pages/FindUsPage').then((module) => ({ default: module.FindUsPage })))
const RecipesPage = lazy(() => import('../pages/RecipesPage').then((module) => ({ default: module.RecipesPage })))
const InfoPage = lazy(() => import('../pages/InfoPage').then((module) => ({ default: module.InfoPage })))
const ContactPage = lazy(() => import('../pages/ContactPage').then((module) => ({ default: module.ContactPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const StaffDashboardPage = lazy(() => import('../pages/StaffDashboardPage').then((module) => ({ default: module.StaffDashboardPage })))

const router = createBrowserRouter([
  { path: '/staff', element: <StaffDashboardPage /> },
  {
    path: '/',
    element: <Storefront />,
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

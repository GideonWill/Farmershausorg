import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api, getList, money, type Address, type Branch, type CustomerProfile, type DeliveryZone, type FulfillmentSlot } from '../lib/api'
import type { BasketPackage } from '../lib/api'
import { useBaskets, useCart } from '../hooks/useStoreData'
import { getAuthTokens } from '../lib/auth'
import { notify } from '../lib/notifications'
import { useStore } from '../stores/store'
import { Icon } from '../components/ui'

export function CheckoutPage() {
  const branch = useStore((state) => state.branch)
  const cartSessionKey = useStore((state) => state.cartSessionKey)
  const { data: cart, isLoading: cartLoading, error: cartError } = useCart()
  const { data: baskets = [] } = useBaskets()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const authenticated = Boolean(getAuthTokens())
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [addressId, setAddressId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherResult, setVoucherResult] = useState<{ code: string; discount_minor: number; eligible_subtotal_minor: number } | null>(null)
  const [voucherError, setVoucherError] = useState<{ code: string; message: string } | null>(null)
  const [customerNote, setCustomerNote] = useState('')
  const [nearestBranch, setNearestBranch] = useState<Branch | null>(null)

  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api<CustomerProfile>('/me/'),
    enabled: authenticated,
    retry: false,
  })
  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => getList(await api<Address[] | { results: Address[] }>('/addresses/')),
    enabled: authenticated,
  })
  const zonesQuery = useQuery({
    queryKey: ['delivery-zones', branch?.slug],
    queryFn: async () => getList(await api<DeliveryZone[] | { results: DeliveryZone[] }>(`/branches/${branch?.slug}/delivery-zones/`)),
    enabled: Boolean(branch && fulfillment === 'delivery'),
  })
  const slotsQuery = useQuery({
    queryKey: ['fulfillment-slots', branch?.id, fulfillment],
    queryFn: () => api<FulfillmentSlot[]>(`/fulfillment-slots/?${new URLSearchParams({ branch: branch?.id ?? '', method: fulfillment })}`),
    enabled: Boolean(authenticated && branch),
  })

  const selectedAddressId = addressesQuery.data?.some((address) => address.id === addressId)
    ? addressId
    : addressesQuery.data?.find((address) => address.is_default)?.id ?? addressesQuery.data?.[0]?.id ?? ''
  const selectedZoneId = zonesQuery.data?.some((zone) => zone.id === zoneId)
    ? zoneId
    : zonesQuery.data?.[0]?.id ?? ''
  const selectedSlotId = slotsQuery.data?.some((slot) => slot.id === slotId)
    ? slotId
    : slotsQuery.data?.[0]?.id ?? ''

  const basketPrices = useMemo(() => new Map<string, number>(baskets.map((item: BasketPackage) => [item.id, item.base_price_minor])), [baskets])
  const subtotal = cart?.items.reduce((sum, item) => {
    const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
    return sum + price * item.quantity
  }, 0) ?? 0
  const selectedZone = zonesQuery.data?.find((zone) => zone.id === selectedZoneId)
  const deliveryFee = fulfillment === 'delivery' ? selectedZone?.delivery_fee_minor ?? 0 : 0
  const activeVoucher = voucherResult?.code === voucherCode.trim() ? voucherResult : null
  const activeVoucherError = voucherError?.code === voucherCode.trim() ? voucherError.message : ''
  const discount = activeVoucher?.discount_minor ?? 0
  const total = Math.max(0, subtotal + deliveryFee - discount)

  useEffect(() => {
    const code = voucherCode.trim()
    if (!code || !cart?.id || !branch) return
    let active = true
    const timer = window.setTimeout(() => {
      void api<{ discount_minor: number; eligible_subtotal_minor: number }>('/vouchers/validate/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({ cart_id: cart.id, branch_id: branch.id, code }),
      }).then((result) => {
        if (!active) return
        setVoucherResult({ ...result, code })
        setVoucherError(null)
      }).catch((error: unknown) => {
        if (!active) return
        setVoucherError({ code, message: error instanceof Error ? error.message : 'This voucher could not be applied.' })
      })
    }, 450)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [branch, cart?.id, cartSessionKey, voucherCode])

  const checkoutMutation = useMutation({
    mutationFn: () => {
      if (!cart?.id || !branch) throw new Error('Your cart or branch is not available.')
      if (!selectedSlotId) throw new Error('Choose an available fulfillment time.')
      if (fulfillment === 'delivery' && (!selectedAddressId || !selectedZoneId)) throw new Error('Choose a saved address and delivery zone.')
      if (fulfillment === 'delivery' && selectedZone && subtotal < selectedZone.minimum_order_minor) {
        throw new Error(`The minimum order for ${selectedZone.name} is ${money(selectedZone.minimum_order_minor)}.`)
      }
      return api<{ order_number: string }>('/checkout/', {
        method: 'POST',
        cartSessionKey,
        body: JSON.stringify({
          cart_id: cart.id,
          branch_id: branch.id,
          fulfillment_method: fulfillment,
          ...(fulfillment === 'delivery' ? { address_id: selectedAddressId, delivery_zone_id: selectedZoneId } : {}),
          slot_id: selectedSlotId,
          ...(activeVoucher ? { voucher_code: voucherCode.trim() } : {}),
          customer_note: customerNote.trim(),
        }),
      })
    },
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] })
      navigate(`/orders/${order.order_number}`)
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Checkout could not be completed.', 'error'),
  })

  async function findNearestBranch() {
    const address = addressesQuery.data?.find((item) => item.id === selectedAddressId)
    if (!address?.latitude || !address.longitude) {
      notify('Add a location pin to this saved address to find the nearest branch.', 'info')
      return
    }
    try {
      const result = await api<{ branch: Branch }>('/branches/nearest/?' + new URLSearchParams({
        latitude: address.latitude,
        longitude: address.longitude,
      }))
      setNearestBranch(result.branch)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nearest branch lookup failed.', 'error')
    }
  }

  function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    checkoutMutation.mutate()
  }

  if (!authenticated) {
    return (
      <div className="section-wrap min-h-[65vh]">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="section-title">Sign in to place your order</h1>
        <p className="mt-3 max-w-2xl leading-7 text-brand-ink/65">Your cart is saved, but checkout requires an account so the shop can attach your delivery address and order updates.</p>
        <Link className="button button-primary mt-6" to="/account?next=%2Fcheckout">Sign in or create account <Icon name="arrow" /></Link>
        <p className="mt-4 text-sm text-brand-ink/55">Guest checkout is not enabled by the current checkout API. You can continue shopping while signed out.</p>
      </div>
    )
  }

  if (!branch) return <div className="section-wrap"><h1 className="section-title">Choose a FarmersHaus branch</h1><p className="mt-3">Select a branch before checkout.</p></div>
  if (cartLoading) return <div className="section-wrap"><div className="skeleton h-64" /></div>
  if (cartError) return <div className="section-wrap"><p className="bg-red-50 p-5 text-brand-tomato">{cartError.message}</p></div>
  if (!cart?.items.length) return <div className="section-wrap text-center"><h1 className="section-title">Your cart is empty</h1><Link to="/shop" className="button button-primary mt-6">Find something fresh</Link></div>

  return (
    <div className="section-wrap min-h-[65vh]">
      <div className="mb-8"><p className="eyebrow">Prepared by {branch.name}</p><h1 className="section-title">Checkout</h1><p className="mt-2 text-sm text-brand-ink/60">Choose how and when you would like to receive your order.</p></div>
      <form className="grid items-start gap-8 lg:grid-cols-[1fr_360px]" onSubmit={submitCheckout}>
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 font-brand-heading text-2xl font-bold text-brand-green">How would you like your order?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['delivery', 'pickup'] as const).map((method) => (
                <button key={method} type="button" className={`fulfillment-choice ${fulfillment === method ? 'fulfillment-choice--active' : ''}`} onClick={() => setFulfillment(method)}>
                  <Icon name={method === 'delivery' ? 'pin' : 'check'} />
                  <span className="capitalize">{method}</span>
                  {fulfillment === method && <span className="ml-auto text-xs">Selected</span>}
                </button>
              ))}
            </div>
          </section>

          {fulfillment === 'delivery' && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-brand-heading text-2xl font-bold text-brand-green">Delivery address</h2><Link className="text-sm font-bold text-brand-green" to="/account">Manage addresses</Link></div>
              {addressesQuery.isLoading ? <div className="skeleton h-20" />
                : addressesQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{addressesQuery.error.message}</p>
                  : addressesQuery.data?.length ? (
                    <div className="space-y-2">{addressesQuery.data.map((address) => (
                      <label key={address.id} className={`address-choice ${selectedAddressId === address.id ? 'address-choice--active' : ''}`}>
                        <input type="radio" name="address" checked={selectedAddressId === address.id} onChange={() => { setAddressId(address.id); setNearestBranch(null) }} />
                        <span className="min-w-0 flex-1"><strong className="block">{address.recipient_name} · {address.phone}</strong><span className="mt-1 block text-sm text-brand-ink/65">{address.address_line_1}, {address.area}</span></span>
                        {address.is_default && <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green">Default</span>}
                      </label>
                    ))}</div>
                  ) : <div className="bg-brand-cream p-5"><p className="text-sm">Add a saved delivery address to continue.</p><Link className="mt-3 inline-flex font-bold text-brand-green" to="/account">Add address <Icon name="arrow" /></Link></div>}
            </section>
          )}

          {fulfillment === 'delivery' && (
            <section>
              <h2 className="mb-3 font-brand-heading text-2xl font-bold text-brand-green">Delivery area</h2>
              {zonesQuery.isLoading ? <div className="skeleton h-16" />
                : zonesQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{zonesQuery.error.message}</p>
                  : zonesQuery.data?.length ? (
                    <>
                      <label className="form-label">Choose the zone that covers this address
                        <select className="field w-full" value={selectedZoneId} onChange={(event) => setZoneId(event.target.value)} required>
                          {zonesQuery.data.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} · {money(zone.delivery_fee_minor)} delivery{zone.area_description ? ` · ${zone.area_description}` : ''}</option>)}
                        </select>
                      </label>
                      <p className="mt-2 text-xs leading-5 text-brand-ink/55">Please choose the zone that serves your area. If your neighborhood is not listed, check a nearby branch.</p>
                      {selectedZone && subtotal < selectedZone.minimum_order_minor && <p className="mt-3 bg-brand-yellow/20 p-3 text-sm text-brand-ink">Minimum order for {selectedZone.name}: {money(selectedZone.minimum_order_minor)}.</p>}
                    </>
                  ) : (
                    <div className="bg-brand-yellow/20 p-4">
                      <p className="text-sm font-bold text-brand-ink">Delivery is unavailable at this branch right now.</p>
                      <p className="mt-1 text-sm text-brand-ink/70">Try pickup or choose another branch for delivery.</p>
                    </div>
                  )}
              {addressesQuery.data?.some((item) => item.id === selectedAddressId && item.latitude && item.longitude) && (
                <div className="mt-3 bg-brand-cream p-4">
                  <p className="text-sm text-brand-ink/70">Not sure this delivery zone covers your address? Find the nearest branch and check its service area.</p>
                  <button className="mt-2 text-sm font-bold text-brand-green" type="button" onClick={() => void findNearestBranch()}>Check nearest branch</button>
                  {nearestBranch && nearestBranch.id !== branch.id && <button className="mt-2 block text-sm font-bold text-brand-green" type="button" onClick={() => window.dispatchEvent(new CustomEvent('farmershaus:choose-branch', { detail: nearestBranch }))}>Switch to {nearestBranch.name}</button>}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 font-brand-heading text-2xl font-bold text-brand-green">Fulfillment time</h2>
            {slotsQuery.isLoading ? <div className="skeleton h-16" />
              : slotsQuery.error ? <p className="bg-red-50 p-4 text-sm text-brand-tomato">{slotsQuery.error.message}</p>
                : slotsQuery.data?.length ? (
                  <label className="form-label">Available {fulfillment} slots
                    <select className="field w-full" value={selectedSlotId} onChange={(event) => setSlotId(event.target.value)} required>
                      {slotsQuery.data.map((slot) => <option key={slot.id} value={slot.id}>{new Date(slot.starts_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} – {new Date(slot.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</option>)}
                    </select>
                  </label>
                ) : <p className="bg-brand-cream p-4 text-sm text-brand-ink/65">No {fulfillment} slots are currently available. Please try again later or contact the branch.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="bg-brand-cream p-4"><p className="text-xs font-bold uppercase tracking-wider text-brand-ink/55">Order contact</p><p className="mt-2 font-semibold">{profileQuery.data?.display_name || 'Your account'}</p><p className="mt-1 text-sm text-brand-ink/65">{profileQuery.data?.phone}</p></div>
            <label className="form-label">Order notes (optional)<textarea className="field w-full" rows={3} value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Anything our team should know?" /></label>
          </section>
        </div>

        <aside className="checkout-summary">
          <h2 className="font-brand-heading text-2xl font-bold text-brand-green">Order summary</h2>
          <div className="my-4 space-y-3">{cart.items.map((item) => {
            const price = item.product?.unit_price_minor ?? basketPrices.get(item.basket_package?.id ?? '') ?? 0
            return <div className="flex justify-between gap-3 text-sm" key={item.id}><span>{item.product?.name ?? item.basket_package?.name} × {item.quantity}</span><strong>{money(price * item.quantity)}</strong></div>
          })}</div>
          <label className="form-label">Voucher code
            <input className="field w-full uppercase" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value)} placeholder="Enter code" autoComplete="off" />
          </label>
          {activeVoucherError && <p className="mt-2 text-xs text-brand-tomato" role="status">{activeVoucherError}</p>}
          {activeVoucher && <p className="mt-2 text-xs font-semibold text-brand-green" role="status">Voucher applied · save {money(discount)}</p>}
          <div className="checkout-summary__line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="checkout-summary__line"><span>Delivery</span><strong>{fulfillment === 'pickup' ? 'Free' : selectedZone ? money(deliveryFee) : 'Choose area'}</strong></div>
          {discount > 0 && <div className="checkout-summary__line text-brand-green"><span>Voucher</span><strong>−{money(discount)}</strong></div>}
          <div className="checkout-summary__total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="button button-primary mt-5 w-full justify-center" disabled={checkoutMutation.isPending || slotsQuery.isLoading || !selectedSlotId || !slotsQuery.data?.length || (fulfillment === 'delivery' && (!selectedAddressId || !selectedZoneId || !zonesQuery.data?.length || Boolean(selectedZone && subtotal < selectedZone.minimum_order_minor)))}>{checkoutMutation.isPending ? 'Creating order…' : 'Place order and pay'}</button>
          <p className="mt-3 text-center text-xs leading-5 text-brand-ink/55">Payment is collected securely after the order is created. Stock is reserved for a limited time.</p>
          <Link to="/cart" className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-brand-green"><Icon name="arrow" className="rotate-180" /> Back to cart</Link>
        </aside>
      </form>
    </div>
  )
}

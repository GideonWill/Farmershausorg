import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, downloadFile, money, type CustomerOrder, type OrderPayment, type OrderStatus } from '../lib/api'
import { useSiteSettings } from '../hooks/useStoreData'
import { notify } from '../lib/notifications'
import { Icon } from '../components/ui'

const timeline: Array<{ status: OrderStatus; title: string; detail: string }> = [
  { status: 'confirmed', title: 'Order confirmed', detail: 'Payment received and your order is with the branch.' },
  { status: 'picking', title: 'Being prepared', detail: 'The team is selecting your fresh items.' },
  { status: 'ready_for_dispatch', title: 'Ready', detail: 'Your order is ready for pickup or dispatch.' },
  { status: 'out_for_delivery', title: 'On its way', detail: 'Your delivery is on its way to you.' },
  { status: 'delivered', title: 'Complete', detail: 'Your order has been completed.' },
]
const networks = [
  { value: 'mtn', label: 'MTN MoMo' },
  { value: 'telecel', label: 'Telecel Cash' },
  { value: 'airteltigo', label: 'AirtelTigo Money' },
]

export function OrderPage() {
  const { orderNumber = '' } = useParams()
  const [method, setMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [network, setNetwork] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [paymentStarted, setPaymentStarted] = useState(false)
  const [payment, setPayment] = useState<OrderPayment | null>(null)
  const queryClient = useQueryClient()
  const { data: site } = useSiteSettings()

  const orderQuery = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: () => api<CustomerOrder>(`/orders/${orderNumber}/tracking/`),
    enabled: Boolean(orderNumber),
    refetchInterval: (query) => {
      const current = query.state.data as CustomerOrder | undefined
      return current && !['delivered', 'cancelled', 'expired'].includes(current.status) ? 7000 : false
    },
  })
  const order = orderQuery.data
  const paymentQuery = useQuery({
    queryKey: ['payment-status', orderNumber],
    queryFn: () => api<OrderPayment>(`/payments/orders/${orderNumber}/status/`),
    enabled: Boolean(order && order.status === 'awaiting_payment'),
    refetchInterval: (query) => {
      const current = query.state.data as OrderPayment | undefined
      return current && !['succeeded', 'failed', 'expired', 'refunded'].includes(current.status) ? 5000 : false
    },
  })

  const startPayment = useMutation({
    mutationFn: () => {
      if (method === 'mobile_money' && !phone.trim()) throw new Error('Enter the mobile money phone number.')
      const isRetry = paymentStarted || ['failed', 'expired'].includes(paymentQuery.data?.status ?? payment?.status ?? '')
      const endpoint = `/payments/orders/${orderNumber}/${isRetry ? 'retry' : 'initiate'}/`
      return api<OrderPayment>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          method,
          idempotency_key: crypto.randomUUID(),
          ...(method === 'mobile_money' ? { phone: phone.trim(), network } : {}),
        }),
      })
    },
    onSuccess: (result) => {
      setPayment(result)
      setPaymentStarted(true)
      void queryClient.invalidateQueries({ queryKey: ['payment-status', orderNumber] })
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Payment could not be started.', 'error'),
  })

  const cancelOrder = useMutation({
    mutationFn: () => api<CustomerOrder>(`/orders/${orderNumber}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Customer requested cancellation before payment.' }),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', orderNumber] })
      notify('Your unpaid order has been cancelled.', 'success')
    },
    onError: (error) => notify(error instanceof Error ? error.message : 'Order could not be cancelled.', 'error'),
  })

  const receipt = useMutation({
    mutationFn: () => downloadFile(`/orders/${orderNumber}/receipt.pdf`, `farmershaus-${orderNumber}-receipt.pdf`),
    onError: (error) => notify(error instanceof Error ? error.message : 'Receipt could not be downloaded.', 'error'),
  })

  if (orderQuery.isLoading) return <div className="section-wrap"><div className="skeleton h-64" /></div>
  if (orderQuery.error || !order) return <div className="section-wrap min-h-[55vh]"><h1 className="section-title">We couldn’t load this order</h1><p className="mt-3 text-brand-ink/65">{orderQuery.error instanceof Error ? orderQuery.error.message : 'Check the order number and try again.'}</p><Link className="button button-primary mt-5" to="/account">Go to my account</Link></div>

  const activePayment = paymentQuery.data ?? payment
  const paid = order.payment_status === 'succeeded' || Boolean(order.paid_at)
  const currentStep = timeline.findIndex((step) => step.status === order.status)
  const isComplete = ['delivered', 'cancelled', 'expired'].includes(order.status)
  const phoneNumbers = [site?.contact.primary_phone, site?.contact.secondary_phone].filter(Boolean) as string[]

  return (
    <div className="section-wrap min-h-[65vh]">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{paid ? 'Thank you for your order' : 'Order created'}</p>
          <h1 className="section-title">{paid ? 'We’re on it.' : 'Complete your payment'}</h1>
          <p className="mt-2 text-sm text-brand-ink/60">Order <strong>{order.order_number}</strong> · {order.branch_snapshot.name}</p>
        </div>
        <span className={`status-pill ${paid ? 'status-pill--success' : ''}`}>{order.status.replaceAll('_', ' ')}</span>
      </div>

      {!paid && order.status === 'awaiting_payment' && (
        <section className="payment-panel mb-9" aria-labelledby="payment-title">
          <div className="mb-5"><h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="payment-title">Pay securely</h2><p className="mt-1 text-sm text-brand-ink/60">Amount due · <strong>{money(order.total_amount_minor, order.currency)}</strong></p></div>
          {paymentQuery.isError && <p className="mb-4 bg-red-50 p-3 text-sm text-brand-tomato">{paymentQuery.error.message}</p>}
          {paymentQuery.isLoading && <p className="mb-4 text-sm text-brand-ink/60">Checking payment status…</p>}
          {activePayment && ['pending', 'created'].includes(activePayment.status) && (
            <div className="mb-5 bg-brand-yellow/20 p-4">
              <p className="font-semibold text-brand-ink">Waiting for payment confirmation</p>
              <p className="mt-1 text-sm leading-6 text-brand-ink/70">Approve the request on your phone or complete the secure payment page. This page checks for confirmation automatically.</p>
              {(activePayment.current_attempt ?? activePayment.attempts[activePayment.attempts.length - 1])?.checkout_url && <a className="button button-primary mt-3" href={(activePayment.current_attempt ?? activePayment.attempts[activePayment.attempts.length - 1]).checkout_url} target="_blank" rel="noreferrer">Open secure payment page <Icon name="arrow" /></a>}
              <p className="mt-3 text-xs text-brand-ink/55">Do not pay twice. Confirmation can take a short time to reach us.</p>
            </div>
          )}
          {activePayment?.status === 'succeeded' && <p className="mb-4 bg-brand-green/10 p-4 text-sm font-semibold text-brand-green">Payment confirmed. Updating your order…</p>}
          {activePayment && ['failed', 'expired'].includes(activePayment.status) && <p className="mb-4 bg-red-50 p-4 text-sm text-brand-tomato">The last payment attempt {activePayment.status}. You can safely retry below.</p>}

          {(!activePayment || ['failed', 'expired'].includes(activePayment.status)) && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className={`fulfillment-choice ${method === 'mobile_money' ? 'fulfillment-choice--active' : ''}`} onClick={() => setMethod('mobile_money')}><Icon name="pin" />Mobile Money</button>
                <button type="button" className={`fulfillment-choice ${method === 'card' ? 'fulfillment-choice--active' : ''}`} onClick={() => setMethod('card')}><Icon name="check" />Card</button>
              </div>
              {method === 'mobile_money' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="form-label">Mobile money network
                    <select className="field w-full" value={network} onChange={(event) => setNetwork(event.target.value)}>{networks.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
                  </label>
                  <label className="form-label">Mobile money number
                    <input className="field w-full" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+233…" autoComplete="tel" required />
                  </label>
                </div>
              )}
              <button className="button button-primary" type="button" disabled={startPayment.isPending || paymentQuery.isLoading} onClick={() => startPayment.mutate()}>
                {startPayment.isPending ? 'Connecting to payment…' : activePayment ? 'Retry payment' : `Continue to ${method === 'card' ? 'card payment' : 'Mobile Money'}`}
              </button>
              <p className="text-xs leading-5 text-brand-ink/55">The payment provider must be enabled for this branch. If payment is unavailable, contact the branch before retrying.</p>
            </div>
          )}
          {!paid && <button className="mt-5 block text-sm font-semibold text-brand-tomato hover:underline" type="button" disabled={cancelOrder.isPending} onClick={() => { if (window.confirm('Cancel this unpaid order?')) cancelOrder.mutate() }}>Cancel unpaid order</button>}
        </section>
      )}

      {paid && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button className="button button-outline" disabled={receipt.isPending} onClick={() => receipt.mutate()}><Icon name="arrow" className="rotate-90" />{receipt.isPending ? 'Preparing receipt…' : 'Download receipt'}</button>
          {order.status === 'out_for_delivery' && (order.rider_name || order.rider_phone)
            ? <p className="text-sm text-brand-ink/65">Your rider: <strong>{order.rider_name}</strong>{order.rider_phone && <> · <a className="text-brand-green underline" href={`tel:${order.rider_phone}`}>{order.rider_phone}</a></>}</p>
            : order.status === 'out_for_delivery' && <p className="text-sm text-brand-ink/65">Rider details will appear here when the branch assigns a rider.</p>}
        </div>
      )}

      {paid && (
        <section className="mb-9" aria-labelledby="tracking-title">
          <div className="mb-5 flex items-center justify-between"><h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="tracking-title">Order progress</h2><span className="text-xs text-brand-ink/50">Updates automatically</span></div>
          {order.status === 'cancelled' || order.status === 'expired' ? (
            <p className="bg-brand-cream p-4 text-sm capitalize">This order is {order.status}.</p>
          ) : (
            <ol className="order-timeline">
              {timeline.map((step, index) => {
                const history = order.status_history.find((item) => item.to_status === step.status)
                const reached = index <= currentStep
                return <li className={`order-timeline__step ${reached ? 'order-timeline__step--reached' : ''}`} key={step.status}>
                  <span className="order-timeline__marker">{reached ? <Icon name="check" /> : <span>{index + 1}</span>}</span>
                  <div><h3 className="font-bold">{step.title}</h3><p className="mt-1 text-sm text-brand-ink/60">{step.detail}</p>{history && <time className="mt-1 block text-xs text-brand-ink/45">{new Date(history.created_at).toLocaleString()}</time>}</div>
                </li>
              })}
            </ol>
          )}
        </section>
      )}

      {paid && !isComplete && (
        <section className="mb-9 bg-brand-cream p-5">
          <h2 className="font-brand-heading text-xl font-bold text-brand-green">Need to cancel or change this order?</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/65">Online cancellation is unavailable after payment. Please call customer service or message us on WhatsApp for assistance.</p>
          <div className="mt-4 flex flex-wrap gap-2">{phoneNumbers.map((number) => <a className="button button-outline button-small" href={`tel:${number.replace(/\s/g, '')}`} key={number}>Call {number}</a>)}{site?.contact.whatsapp_numbers.map((number) => <a className="button button-primary button-small" href={`https://wa.me/${number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" key={number}>WhatsApp</a>)}</div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section><h2 className="mb-3 font-brand-heading text-xl font-bold text-brand-green">Items in this order</h2><div className="divide-y divide-brand-green/10 bg-white">{order.lines.filter((line) => !line.is_removed).map((line) => <div className="flex justify-between gap-4 py-3" key={line.id}><div><p className="font-semibold">{line.name_snapshot}</p><p className="mt-1 text-xs text-brand-ink/55">{line.quantity} × {line.unit_snapshot}</p></div><strong>{money(line.line_total_minor, order.currency)}</strong></div>)}</div>{order.refund_review_required && <p className="mt-3 bg-brand-yellow/20 p-3 text-sm text-brand-ink">A removed or substituted item changed your order total. Our team is reviewing a refund of {money(order.refund_difference_minor, order.currency)}.</p>}</section>
        <aside className="bg-brand-cream p-5"><h2 className="font-brand-heading text-xl font-bold text-brand-green">Order total</h2><div className="checkout-summary__line"><span>Subtotal</span><strong>{money(order.subtotal_minor, order.currency)}</strong></div><div className="checkout-summary__line"><span>Delivery</span><strong>{money(order.delivery_fee_minor, order.currency)}</strong></div>{order.discount_minor > 0 && <div className="checkout-summary__line"><span>Discount</span><strong>−{money(order.discount_minor, order.currency)}</strong></div>}<div className="checkout-summary__total"><span>Total</span><strong>{money(order.total_amount_minor, order.currency)}</strong></div><p className="mt-3 text-xs text-brand-ink/55">{order.fulfillment_method === 'delivery' ? `${order.address_snapshot.address_line_1}, ${order.address_snapshot.area}` : 'Pickup'} · {order.delivery_snapshot.slot_starts_at ? new Date(order.delivery_snapshot.slot_starts_at).toLocaleString() : 'Time to be confirmed'}</p></aside>
      </div>
      <Link to="/shop" className="button button-outline mt-8"><Icon name="arrow" className="rotate-180" />Continue shopping</Link>
    </div>
  )
}

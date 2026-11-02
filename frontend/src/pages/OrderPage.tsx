import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, downloadFile, money, type CustomerOrder, type OrderPayment, type OrderStatus } from '../lib/api'
import { useSiteSettings } from '../hooks/useStoreData'
import { notify } from '../lib/notifications'
import { Icon } from '../components/ui'
import { getProduceIcon } from '../lib/images'

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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNewSuccess = searchParams.get('success') === 'true'

  const [method, setMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [network, setNetwork] = useState('mtn')
  const [phone, setPhone] = useState('')
  const [paymentStarted, setPaymentStarted] = useState(false)
  const [payment, setPayment] = useState<OrderPayment | null>(null)
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(isNewSuccess ? 6 : null)
  const [autoRedirectCancelled, setAutoRedirectCancelled] = useState(false)

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

  // Smooth auto-redirect timer when order payment just succeeded
  useEffect(() => {
    if (redirectSeconds === null || autoRedirectCancelled) return
    if (redirectSeconds <= 0) {
      navigate('/account#orders')
      return
    }
    const timer = setTimeout(() => {
      setRedirectSeconds((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)
    return () => clearTimeout(timer)
  }, [redirectSeconds, autoRedirectCancelled, navigate])

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
  if (orderQuery.error || !order) {
    return (
      <div className="section-wrap min-h-[55vh]">
        <h1 className="section-title">We couldn’t load this order</h1>
        <p className="mt-3 text-brand-ink/65">{orderQuery.error instanceof Error ? orderQuery.error.message : 'Check the order number and try again.'}</p>
        <Link className="button button-primary mt-5" to="/account">Go to my account</Link>
      </div>
    )
  }

  const activePayment = paymentQuery.data ?? payment
  const paid = order.payment_status === 'succeeded' || Boolean(order.paid_at)
  const currentStep = timeline.findIndex((step) => step.status === order.status)
  const isComplete = ['delivered', 'cancelled', 'expired'].includes(order.status)
  const phoneNumbers = [site?.contact.primary_phone, site?.contact.secondary_phone].filter(Boolean) as string[]

  return (
    <div className="section-wrap min-h-[65vh]">
      {paid ? (
        /* ================================================================ */
        /* THANK YOU / PAYMENT SUCCESSFUL CELEBRATORY EXPERIENCE             */
        /* ================================================================ */
        <div className="mb-10 space-y-8">
          {/* Celebratory Hero Card */}
          <div className="relative overflow-hidden rounded-[2.2rem] bg-gradient-to-br from-brand-green via-[#0e4e37] to-[#073223] p-7 text-white shadow-xl sm:p-10">
            {/* Ambient decorative glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-yellow/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-emerald-500/15 blur-2xl" />

            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-3.5 py-1 text-xs font-bold text-emerald-300 backdrop-blur-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>PAYMENT SUCCESSFUL · ORDER CONFIRMED</span>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono font-semibold tracking-wider text-white/80">
                  #{order.order_number}
                </span>
              </div>

              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-yellow text-brand-green shadow-lg sm:h-20 sm:w-20">
                  <Icon name="check" className="h-9 w-9 stroke-[3]" />
                </div>
                <div>
                  <h1 className="font-brand-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Thank you for your order!
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
                    Your payment of <strong className="text-brand-yellow">{money(order.total_amount_minor, order.currency)}</strong> has gone through successfully.
                    FarmersHaus {order.branch_snapshot.name} has received your order and our staff is preparing your fresh harvest.
                  </p>
                </div>
              </div>

              {/* Smooth redirect notice if newly placed order */}
              {redirectSeconds !== null && !autoRedirectCancelled && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs text-white backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-yellow text-[11px] font-bold text-brand-green">
                      {redirectSeconds}
                    </span>
                    <span>
                      Taking you to your account order history in <strong>{redirectSeconds}s</strong>…
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/account#orders')}
                      className="font-bold text-brand-yellow hover:underline"
                    >
                      Go to orders now &rarr;
                    </button>
                    <span className="text-white/40">·</span>
                    <button
                      type="button"
                      onClick={() => setAutoRedirectCancelled(true)}
                      className="text-white/70 hover:text-white hover:underline"
                    >
                      Stay on this page
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-white/15 pt-6">
                <Link
                  to="/account#orders"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-yellow px-5 py-3 text-xs font-bold text-brand-green shadow-lg transition hover:bg-brand-yellow/90 active:scale-95 sm:text-sm"
                >
                  <span>Go to My Account (View Orders)</span>
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20 active:scale-95 sm:text-sm"
                  disabled={receipt.isPending}
                  onClick={() => receipt.mutate()}
                >
                  <Icon name="arrow" className="h-4 w-4 rotate-90" />
                  <span>{receipt.isPending ? 'Preparing receipt…' : 'Download PDF Receipt'}</span>
                </button>

                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-5 py-3 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:text-sm"
                >
                  <span>Continue shopping</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Live Order Timeline */}
          <section className="rounded-3xl border border-brand-green/15 bg-white p-6 shadow-2xs sm:p-8" aria-labelledby="tracking-title">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-brand-green/10 pb-4">
              <div>
                <h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="tracking-title">
                  Order Status &amp; Live Tracking
                </h2>
                <p className="mt-1 text-xs text-brand-ink/60">
                  Updates in real time as your branch team processes each step.
                </p>
              </div>
              <span className="status-pill status-pill--success capitalize">
                {order.status.replaceAll('_', ' ')}
              </span>
            </div>

            {order.status === 'cancelled' || order.status === 'expired' ? (
              <p className="rounded-2xl bg-brand-cream p-4 text-sm capitalize">This order is {order.status}.</p>
            ) : (
              <ol className="order-timeline">
                {timeline.map((step, index) => {
                  const history = order.status_history.find((item) => item.to_status === step.status)
                  const reached = index <= currentStep
                  return (
                    <li className={`order-timeline__step ${reached ? 'order-timeline__step--reached' : ''}`} key={step.status}>
                      <span className="order-timeline__marker">
                        {reached ? <Icon name="check" /> : <span>{index + 1}</span>}
                      </span>
                      <div>
                        <h3 className="font-bold text-brand-ink">{step.title}</h3>
                        <p className="mt-1 text-sm text-brand-ink/60">{step.detail}</p>
                        {history && <time className="mt-1 block text-xs text-brand-ink/45">{new Date(history.created_at).toLocaleString()}</time>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {order.status === 'out_for_delivery' && (order.rider_name || order.rider_phone) && (
              <div className="mt-6 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-sm text-brand-ink">
                <p className="font-bold text-brand-green">Assigned Courier / Rider</p>
                <p className="mt-1">
                  <strong>{order.rider_name}</strong>
                  {order.rider_phone && (
                    <>
                      {' · '}
                      <a className="font-semibold text-brand-green underline" href={`tel:${order.rider_phone}`}>
                        {order.rider_phone}
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ================================================================ */
        /* UNPAID ORDER PAYMENT PANEL (NO SIMULATE BOX)                      */
        /* ================================================================ */
        <div>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Order created</p>
              <h1 className="section-title">Complete your payment</h1>
              <p className="mt-2 text-sm text-brand-ink/60">
                Order <strong>{order.order_number}</strong> · {order.branch_snapshot.name}
              </p>
            </div>
            <span className="status-pill">{order.status.replaceAll('_', ' ')}</span>
          </div>

          <section className="payment-panel mb-9" aria-labelledby="payment-title">
            <div className="mb-5">
              <h2 className="font-brand-heading text-2xl font-bold text-brand-green" id="payment-title">
                Pay securely
              </h2>
              <p className="mt-1 text-sm text-brand-ink/60">
                Amount due · <strong>{money(order.total_amount_minor, order.currency)}</strong>
              </p>
            </div>
            {paymentQuery.isError && (
              <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-brand-tomato">{paymentQuery.error.message}</p>
            )}
            {paymentQuery.isLoading && <p className="mb-4 text-sm text-brand-ink/60">Checking payment status…</p>}
            {activePayment && ['pending', 'created'].includes(activePayment.status) && (
              <div className="mb-5 rounded-2xl bg-brand-yellow/20 p-4">
                <p className="font-semibold text-brand-ink">Waiting for payment confirmation</p>
                <p className="mt-1 text-sm leading-6 text-brand-ink/70">
                  Approve the request on your phone or complete the secure payment page. This page checks for confirmation automatically.
                </p>
                {(activePayment.current_attempt ?? activePayment.attempts[activePayment.attempts.length - 1])?.checkout_url && (
                  <a
                    className="button button-primary mt-3"
                    href={(activePayment.current_attempt ?? activePayment.attempts[activePayment.attempts.length - 1]).checkout_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open secure payment page <Icon name="arrow" />
                  </a>
                )}
                <p className="mt-3 text-xs text-brand-ink/55">Do not pay twice. Confirmation can take a short time to reach us.</p>
              </div>
            )}
            {activePayment?.status === 'succeeded' && (
              <p className="mb-4 rounded-xl bg-brand-green/10 p-4 text-sm font-semibold text-brand-green">
                Payment confirmed. Updating your order…
              </p>
            )}
            {activePayment && ['failed', 'expired'].includes(activePayment.status) && (
              <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-brand-tomato">
                The last payment attempt {activePayment.status}. You can safely retry below.
              </p>
            )}

            {(!activePayment || ['failed', 'expired'].includes(activePayment.status)) && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`fulfillment-choice ${method === 'mobile_money' ? 'fulfillment-choice--active' : ''}`}
                    onClick={() => setMethod('mobile_money')}
                  >
                    <Icon name="pin" />Mobile Money
                  </button>
                  <button
                    type="button"
                    className={`fulfillment-choice ${method === 'card' ? 'fulfillment-choice--active' : ''}`}
                    onClick={() => setMethod('card')}
                  >
                    <Icon name="check" />Card
                  </button>
                </div>
                {method === 'mobile_money' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="form-label">
                      Mobile money network
                      <select
                        className="field w-full"
                        value={network}
                        onChange={(event) => setNetwork(event.target.value)}
                      >
                        {networks.map((item) => (
                          <option value={item.value} key={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="form-label">
                      Mobile money number
                      <input
                        className="field w-full"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+233…"
                        autoComplete="tel"
                        required
                      />
                    </label>
                  </div>
                )}
                <button
                  className="button button-primary"
                  type="button"
                  disabled={startPayment.isPending || paymentQuery.isLoading}
                  onClick={() => startPayment.mutate()}
                >
                  {startPayment.isPending ? 'Connecting to payment…' : activePayment ? 'Retry payment' : `Continue to ${method === 'card' ? 'card payment' : 'Mobile Money'}`}
                </button>
                <p className="text-xs leading-5 text-brand-ink/55">
                  Secure transactions processed via Hubtel payment gateway.
                </p>
              </div>
            )}

            <button
              className="mt-5 block text-sm font-semibold text-brand-tomato hover:underline"
              type="button"
              disabled={cancelOrder.isPending}
              onClick={() => {
                if (window.confirm('Cancel this unpaid order?')) cancelOrder.mutate()
              }}
            >
              Cancel unpaid order
            </button>
          </section>
        </div>
      )}

      {/* Support / Change assistance banner */}
      {paid && !isComplete && (
        <section className="mb-9 rounded-3xl border border-brand-green/15 bg-brand-cream/80 p-6">
          <h2 className="font-brand-heading text-xl font-bold text-brand-green">Need to modify this order?</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/65">
            Since your produce is already being prepared fresh at {order.branch_snapshot.name}, please contact the branch directly for immediate assistance.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {phoneNumbers.map((num) => (
              <a className="button button-outline button-small" href={`tel:${num.replace(/\s/g, '')}`} key={num}>
                Call {num}
              </a>
            ))}
            {site?.contact.whatsapp_numbers.map((num) => (
              <a
                className="button button-primary button-small"
                href={`https://wa.me/${num.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                key={num}
              >
                WhatsApp
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Order Details & Summary Grid */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="rounded-3xl border border-brand-green/15 bg-white p-6 shadow-2xs">
          <h2 className="mb-4 font-brand-heading text-xl font-bold text-brand-green">Items in this order</h2>
          <div className="divide-y divide-brand-green/10">
            {order.lines.filter((line) => !line.is_removed).map((line) => {
              const slug = line.name_snapshot.toLowerCase().replace(/[^a-z0-9]+/g, '-')
              const icon = getProduceIcon(slug)
              return (
                <div className="flex items-center justify-between gap-4 py-3.5" key={line.id}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-cream text-xl select-none">
                      {icon}
                    </span>
                    <div>
                      <p className="font-semibold text-brand-ink">{line.name_snapshot}</p>
                      <p className="text-xs text-brand-ink/55">{line.quantity} × {line.unit_snapshot}</p>
                    </div>
                  </div>
                  <strong className="text-sm text-brand-ink">{money(line.line_total_minor, order.currency)}</strong>
                </div>
              )
            })}
          </div>
          {order.refund_review_required && (
            <p className="mt-4 rounded-xl bg-brand-yellow/20 p-3.5 text-xs text-brand-ink">
              A removed or substituted item changed your order total. Our team is reviewing a refund of {money(order.refund_difference_minor, order.currency)}.
            </p>
          )}
        </section>

        <aside className="h-fit rounded-3xl border border-brand-green/15 bg-brand-cream/80 p-6">
          <h2 className="font-brand-heading text-xl font-bold text-brand-green">Fulfillment &amp; Total</h2>
          <div className="mt-4 space-y-2.5 text-xs text-brand-ink/75">
            <div className="flex justify-between">
              <span>Produce Subtotal</span>
              <strong>{money(order.subtotal_minor, order.currency)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <strong>{money(order.delivery_fee_minor, order.currency)}</strong>
            </div>
            {order.discount_minor > 0 && (
              <div className="flex justify-between font-bold text-brand-green">
                <span>Discount</span>
                <strong>−{money(order.discount_minor, order.currency)}</strong>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-brand-green/15 pt-3 text-base font-bold text-brand-green">
              <span>Total Paid</span>
              <span className="font-brand-heading text-xl">{money(order.total_amount_minor, order.currency)}</span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-brand-green/10 bg-white/70 p-3.5 text-xs text-brand-ink/65">
            <p className="font-bold text-brand-ink">
              {order.fulfillment_method === 'delivery' ? 'Delivery Destination' : 'Store Pickup'}
            </p>
            <p className="mt-1">
              {order.fulfillment_method === 'delivery'
                ? `${order.address_snapshot.address_line_1}, ${order.address_snapshot.area}`
                : `FarmersHaus ${order.branch_snapshot.name}`}
            </p>
            <p className="mt-2 text-[11px] text-brand-ink/50">
              Time slot:{' '}
              {order.delivery_snapshot.slot_starts_at
                ? new Date(order.delivery_snapshot.slot_starts_at).toLocaleString()
                : 'Guaranteed fresh fulfillment'}
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link to="/shop" className="button button-outline">
          <Icon name="arrow" className="rotate-180" />
          <span>Continue shopping</span>
        </Link>
        <Link to="/account#orders" className="text-xs font-bold text-brand-green hover:underline">
          View full order history &rarr;
        </Link>
      </div>
    </div>
  )
}

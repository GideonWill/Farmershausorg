import type { CustomerOrder, OrderStatus } from './api'

const STORAGE_KEY = 'farmershaus_placed_orders'

const SEED_ORDERS: CustomerOrder[] = [
  {
    id: 'ord-seed-001',
    order_number: 'FH-90412',
    branch: 'b1',
    branch_snapshot: {
      id: 'b1',
      name: 'FarmersHaus East Legon',
      address: 'ARS Roundabout, East Legon, Accra',
      phone: '+233 55 048 8906',
    },
    fulfillment_method: 'delivery',
    fulfillment_slot: 'slot-1',
    delivery_snapshot: {
      zone: 'East Legon & Environs',
      fee_minor: 1500,
      method: 'delivery',
      slot_starts_at: new Date(Date.now() - 3600000).toISOString(),
      slot_ends_at: new Date(Date.now() + 7200000).toISOString(),
    },
    address_snapshot: {
      recipient_name: 'Akosua Mensah',
      phone: '+233 24 411 2233',
      address_line_1: 'Plot 48, Boundary Road',
      address_line_2: 'Near A&C Mall',
      area: 'East Legon',
      directions: 'Green gate opposite the pharmacy',
      latitude: null,
      longitude: null,
    },
    status: 'confirmed',
    payment_status: 'succeeded',
    currency: 'GHS',
    subtotal_minor: 14500,
    delivery_fee_minor: 1500,
    discount_minor: 0,
    total_amount_minor: 16000,
    voucher_code_snapshot: '',
    customer_note: 'Please select ripe avocados and firm tomatoes.',
    customer_name: 'Akosua Mensah',
    customer_phone: '+233 24 411 2233',
    rider_name: '',
    rider_phone: '',
    staff_confirmed_at: null,
    refund_difference_minor: 0,
    refund_review_required: false,
    stock_adjustment_note: '',
    lines: [
      {
        id: 'line-001',
        product_id: 'prod-apple',
        sku_snapshot: 'FRUIT-APP-01',
        name_snapshot: 'Crisp Red Royal Gala Apple',
        unit_snapshot: 'kg',
        quantity: 2,
        unit_price_minor: 3500,
        line_total_minor: 7000,
        gift_recipient_name: '',
        gift_message: '',
        components: [],
        is_removed: false,
      },
      {
        id: 'line-002',
        product_id: 'prod-pineapple',
        sku_snapshot: 'FRUIT-PINE-01',
        name_snapshot: 'Golden Sugar Loaf Pineapple',
        unit_snapshot: 'piece',
        quantity: 3,
        unit_price_minor: 2500,
        line_total_minor: 7500,
        gift_recipient_name: '',
        gift_message: '',
        components: [],
        is_removed: false,
      },
    ],
    status_history: [
      {
        from_status: null,
        to_status: 'awaiting_payment',
        note: 'Order submitted by customer',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        from_status: 'awaiting_payment',
        to_status: 'confirmed',
        note: 'Payment authorized via Hubtel MoMo',
        created_at: new Date(Date.now() - 3500000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    paid_at: new Date(Date.now() - 3500000).toISOString(),
    confirmed_at: new Date(Date.now() - 3500000).toISOString(),
    picking_at: null,
    ready_for_dispatch_at: null,
    out_for_delivery_at: null,
    cancelled_at: null,
    delivered_at: null,
    expired_at: null,
  },
  {
    id: 'ord-seed-002',
    order_number: 'FH-90413',
    branch: 'b1',
    branch_snapshot: {
      id: 'b1',
      name: 'FarmersHaus East Legon',
      address: 'ARS Roundabout, East Legon, Accra',
      phone: '+233 55 048 8906',
    },
    fulfillment_method: 'pickup',
    fulfillment_slot: 'slot-2',
    delivery_snapshot: {
      zone: '',
      fee_minor: 0,
      method: 'pickup',
      slot_starts_at: new Date(Date.now() - 7200000).toISOString(),
      slot_ends_at: new Date(Date.now() + 3600000).toISOString(),
    },
    address_snapshot: {
      recipient_name: 'Kwame Asante',
      phone: '+233 20 882 9944',
      address_line_1: '',
      address_line_2: '',
      area: '',
      directions: '',
      latitude: null,
      longitude: null,
    },
    status: 'picking',
    payment_status: 'succeeded',
    currency: 'GHS',
    subtotal_minor: 9800,
    delivery_fee_minor: 0,
    discount_minor: 0,
    total_amount_minor: 9800,
    voucher_code_snapshot: '',
    customer_note: 'Picking up around 3pm after work.',
    customer_name: 'Kwame Asante',
    customer_phone: '+233 20 882 9944',
    rider_name: '',
    rider_phone: '',
    staff_confirmed_at: new Date(Date.now() - 5000000).toISOString(),
    refund_difference_minor: 0,
    refund_review_required: false,
    stock_adjustment_note: '',
    lines: [
      {
        id: 'line-003',
        product_id: 'prod-orange',
        sku_snapshot: 'FRUIT-ORG-01',
        name_snapshot: 'Sweet Valencia Oranges',
        unit_snapshot: 'bag',
        quantity: 2,
        unit_price_minor: 4900,
        line_total_minor: 9800,
        gift_recipient_name: '',
        gift_message: '',
        components: [],
        is_removed: false,
      },
    ],
    status_history: [
      {
        from_status: null,
        to_status: 'awaiting_payment',
        note: 'Order submitted by customer',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        from_status: 'awaiting_payment',
        to_status: 'confirmed',
        note: 'Payment received',
        created_at: new Date(Date.now() - 7100000).toISOString(),
      },
      {
        from_status: 'confirmed',
        to_status: 'picking',
        note: 'Packing started by East Legon produce team',
        created_at: new Date(Date.now() - 5000000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 7200000).toISOString(),
    paid_at: new Date(Date.now() - 7100000).toISOString(),
    confirmed_at: new Date(Date.now() - 7100000).toISOString(),
    picking_at: new Date(Date.now() - 5000000).toISOString(),
    ready_for_dispatch_at: null,
    out_for_delivery_at: null,
    cancelled_at: null,
    delivered_at: null,
    expired_at: null,
  },
]

export function getPlacedOrders(branchId?: string): CustomerOrder[] {
  if (typeof window === 'undefined') return SEED_ORDERS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    let list: CustomerOrder[] = []
    if (raw) {
      list = JSON.parse(raw) as CustomerOrder[]
    } else {
      list = SEED_ORDERS
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
    if (branchId) {
      return list.filter((o) => !o.branch || o.branch === branchId || o.branch_snapshot.id === branchId)
    }
    return list
  } catch {
    return SEED_ORDERS
  }
}

export function savePlacedOrder(order: CustomerOrder): CustomerOrder {
  if (typeof window === 'undefined') return order
  try {
    const existing = getPlacedOrders()
    const index = existing.findIndex((o) => o.order_number === order.order_number || o.id === order.id)
    if (index >= 0) {
      existing[index] = { ...existing[index], ...order }
    } else {
      existing.unshift(order)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    window.dispatchEvent(new Event('farmershaus:orders-updated'))
  } catch (err) {
    console.warn('Could not save placed order to local store:', err)
  }
  return order
}

export function getOrderByNumber(orderNumber: string): CustomerOrder | null {
  const all = getPlacedOrders()
  return all.find((o) => o.order_number.toLowerCase() === orderNumber.toLowerCase()) ?? null
}

export function updateOrderStatusInStore(
  orderNumber: string,
  newStatus: OrderStatus,
  rider?: { name: string; phone: string },
): CustomerOrder | null {
  if (typeof window === 'undefined') return null
  const all = getPlacedOrders()
  const target = all.find((o) => o.order_number.toLowerCase() === orderNumber.toLowerCase())
  if (!target) return null

  const now = new Date().toISOString()
  target.status = newStatus
  if (newStatus === 'confirmed' && !target.staff_confirmed_at) {
    target.staff_confirmed_at = now
    target.confirmed_at = now
  } else if (newStatus === 'picking') {
    target.picking_at = now
  } else if (newStatus === 'ready_for_dispatch') {
    target.ready_for_dispatch_at = now
  } else if (newStatus === 'out_for_delivery') {
    target.out_for_delivery_at = now
  } else if (newStatus === 'delivered') {
    target.delivered_at = now
  } else if (newStatus === 'cancelled') {
    target.cancelled_at = now
  }

  if (rider) {
    target.rider_name = rider.name
    target.rider_phone = rider.phone
  }

  target.status_history.unshift({
    from_status: target.status,
    to_status: newStatus,
    note: `Status updated to ${newStatus.replace(/_/g, ' ')}`,
    created_at: now,
  })

  savePlacedOrder(target)
  return target
}

export function generateOrderNumber(): string {
  const randomSuffix = Math.floor(10000 + Math.random() * 90000)
  return `FH-${randomSuffix}`
}

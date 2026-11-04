import mockStoreData from './mockStoreData.json'
import { getPlacedOrders } from './orderStore'
import type { CustomerOrder } from './api'

export type InventoryRow = {
  id: string
  branch: string
  product: string
  product_name: string
  product_sku: string
  product_unit: string
  product_image_url: string
  stock_on_hand: number
  reserved_quantity: number
  available_quantity: number
  is_available: boolean
  price_override_minor: number | null
  effective_price_minor: number
}

export type StaffReport = {
  from: string
  to: string
  daily_sales: Array<{
    date: string
    branch: string
    order_count: number
    gross_paid_minor: number
    adjusted_total_minor: number
    refund_review_minor: number
  }>
  best_sellers: Array<{ product: string; quantity: number; sales_minor: number }>
  payment_statuses: Array<{ status: string; count: number; amount_minor: number }>
  voucher_usage: Array<{ code: string; redemptions: number; amount_saved_minor: number }>
  audit_count: number
  inventory_adjustment_count: number
}

export type AuditEvent = {
  id: string
  occurred_at: string
  actor: string
  branch: string
  action: string
  resource_type: string
  resource_id: string
  before_data: Record<string, unknown>
  after_data: Record<string, unknown>
}

export type RefundReviewData = {
  review_orders: Array<{
    order_number: string
    branch: string
    customer: string
    amount_minor: number
    currency: string
    note: string
  }>
  refunds: Array<{
    id: string
    order_number: string
    amount_minor: number
    currency: string
    status: string
    reason: string
    last_error: string
    created_at: string
  }>
}

const INVENTORY_STORAGE_PREFIX = 'farmershaus_inventory_'
const AUDIT_STORAGE_PREFIX = 'farmershaus_audit_'
const REFUNDS_STORAGE_KEY = 'farmershaus_refunds_data'

/**
 * Get branch inventory with persistent local edits and realistic baseline data
 */
export function getBranchInventory(branchId: string): InventoryRow[] {
  if (typeof window === 'undefined') return []
  const key = `${INVENTORY_STORAGE_PREFIX}${branchId}`
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      return JSON.parse(saved) as InventoryRow[]
    } catch {}
  }

  // Generate initial inventory from product catalog
  const products = mockStoreData.products as Array<{
    id: string
    name: string
    sku: string
    unit: string
    base_price_minor: number
  }>

  const initialRows: InventoryRow[] = products.map((prod, idx) => {
    // Generate varied realistic stock numbers
    const stock = 15 + ((idx * 17) % 85)
    const reserved = idx % 5 === 0 ? 2 : idx % 7 === 0 ? 3 : 0
    return {
      id: `inv-${branchId.slice(0, 4)}-${prod.id.slice(0, 8)}`,
      branch: branchId,
      product: prod.id,
      product_name: prod.name,
      product_sku: prod.sku || `FH-${prod.name.slice(0, 3).toUpperCase()}-${100 + idx}`,
      product_unit: prod.unit || 'per kg',
      product_image_url: (prod as any).image_url || '',
      stock_on_hand: stock,
      reserved_quantity: reserved,
      available_quantity: Math.max(0, stock - reserved),
      is_available: true,
      price_override_minor: null,
      effective_price_minor: prod.base_price_minor,
    }
  })

  try {
    localStorage.setItem(key, JSON.stringify(initialRows))
  } catch {}
  return initialRows
}

/**
 * Save branch inventory changes and record audit event
 */
export function updateBranchInventoryRow(
  branchId: string,
  rowId: string,
  updates: { stock?: number; price?: number | null; available?: boolean },
  actor = 'Operations Specialist',
): InventoryRow {
  const rows = getBranchInventory(branchId)
  const idx = rows.findIndex((r) => r.id === rowId)
  if (idx === -1) {
    throw new Error('Inventory record not found')
  }

  const before = { ...rows[idx] }
  const row = rows[idx]

  if (updates.stock !== undefined) {
    row.stock_on_hand = Math.max(0, updates.stock)
    row.available_quantity = Math.max(0, row.stock_on_hand - row.reserved_quantity)
  }
  if (updates.price !== undefined) {
    row.price_override_minor = updates.price
    row.effective_price_minor = updates.price !== null ? updates.price : before.effective_price_minor
  }
  if (updates.available !== undefined) {
    row.is_available = updates.available
  }

  rows[idx] = row
  try {
    localStorage.setItem(`${INVENTORY_STORAGE_PREFIX}${branchId}`, JSON.stringify(rows))
  } catch {}

  // Log audit event
  addAuditEvent({
    actor,
    branch: branchId,
    action: 'inventory.stock_and_price_update',
    resource_type: 'InventoryItem',
    resource_id: row.product_sku,
    before_data: {
      stock: before.stock_on_hand,
      available: before.is_available,
      price_override: before.price_override_minor,
    },
    after_data: {
      stock: row.stock_on_hand,
      available: row.is_available,
      price_override: row.price_override_minor,
    },
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('farmershaus:inventory-updated', { detail: { branchId, row } }))
  }

  return row
}

/**
 * Import Inventory CSV content
 */
export function importBranchInventoryCsv(
  branchId: string,
  csvText: string,
  actor = 'Operations Specialist',
): { updatedCount: number; message: string } {
  const rows = getBranchInventory(branchId)
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) {
    return { updatedCount: 0, message: 'CSV file contains no data rows.' }
  }

  let updatedCount = 0
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''))
    if (parts.length < 2) continue

    const [skuOrName, stockStr, priceStr, availStr] = parts
    const match = rows.find(
      (r) =>
        r.product_sku.toLowerCase() === skuOrName.toLowerCase() ||
        r.product_name.toLowerCase() === skuOrName.toLowerCase(),
    )

    if (match) {
      if (stockStr && !isNaN(Number(stockStr))) {
        match.stock_on_hand = Math.max(0, Number(stockStr))
        match.available_quantity = Math.max(0, match.stock_on_hand - match.reserved_quantity)
      }
      if (priceStr && !isNaN(Number(priceStr))) {
        match.price_override_minor = Math.round(Number(priceStr) * 100)
      }
      if (availStr !== undefined) {
        match.is_available = ['true', 'yes', '1', 'available'].includes(availStr.toLowerCase())
      }
      updatedCount++
    }
  }

  try {
    localStorage.setItem(`${INVENTORY_STORAGE_PREFIX}${branchId}`, JSON.stringify(rows))
  } catch {}

  addAuditEvent({
    actor,
    branch: branchId,
    action: 'inventory.csv_import',
    resource_type: 'InventoryBatch',
    resource_id: `CSV-${lines.length - 1}-rows`,
    before_data: { status: 'pending' },
    after_data: { updated_items: updatedCount },
  })

  return { updatedCount, message: `Successfully updated ${updatedCount} inventory items from CSV.` }
}

/**
 * Generate CSV string from branch inventory
 */
export function generateInventoryCsv(branchId: string): string {
  const rows = getBranchInventory(branchId)
  const headers = ['Product Name', 'SKU', 'Unit', 'Stock On Hand', 'Reserved', 'Available', 'Is Available', 'Base Price (GHc)', 'Price Override (GHc)']
  const csvLines = [headers.join(',')]

  rows.forEach((r) => {
    const line = [
      `"${r.product_name.replace(/"/g, '""')}"`,
      `"${r.product_sku}"`,
      `"${r.product_unit}"`,
      r.stock_on_hand,
      r.reserved_quantity,
      r.available_quantity,
      r.is_available ? 'TRUE' : 'FALSE',
      (r.effective_price_minor / 100).toFixed(2),
      r.price_override_minor != null ? (r.price_override_minor / 100).toFixed(2) : '',
    ]
    csvLines.push(line.join(','))
  })

  return csvLines.join('\r\n')
}

/**
 * Branch Audit Events Store
 */
export function getBranchAuditEvents(branchId: string): AuditEvent[] {
  if (typeof window === 'undefined') return []
  const key = `${AUDIT_STORAGE_PREFIX}${branchId}`
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      return JSON.parse(saved) as AuditEvent[]
    } catch {}
  }

  const now = Date.now()
  const initialEvents: AuditEvent[] = [
    {
      id: 'audit-001',
      occurred_at: new Date(now - 14 * 60000).toISOString(),
      actor: 'Kwame Asante (Produce Team)',
      branch: branchId,
      action: 'order.rider_assigned',
      resource_type: 'Order',
      resource_id: 'FH-9831',
      before_data: { status: 'ready_for_dispatch', rider: null },
      after_data: { status: 'out_for_delivery', rider: 'Kofi Mensah (+233 55 123 4567)' },
    },
    {
      id: 'audit-002',
      occurred_at: new Date(now - 45 * 60000).toISOString(),
      actor: 'Akua Osei (Inventory Lead)',
      branch: branchId,
      action: 'inventory.stock_intake',
      resource_type: 'InventoryItem',
      resource_id: 'FH-APP-101 (Red Apples)',
      before_data: { stock_on_hand: 18, is_available: true },
      after_data: { stock_on_hand: 65, is_available: true },
    },
    {
      id: 'audit-003',
      occurred_at: new Date(now - 90 * 60000).toISOString(),
      actor: 'System Automation',
      branch: branchId,
      action: 'payment.mobile_money_verified',
      resource_type: 'PaymentTransaction',
      resource_id: 'MTN-MOM-482910',
      before_data: { status: 'awaiting_payment' },
      after_data: { status: 'paid', amount_minor: 14500, gateway: 'Paystack MoMo' },
    },
    {
      id: 'audit-004',
      occurred_at: new Date(now - 180 * 60000).toISOString(),
      actor: 'Kwame Asante (Produce Team)',
      branch: branchId,
      action: 'order.packing_completed',
      resource_type: 'Order',
      resource_id: 'FH-9812',
      before_data: { status: 'picking' },
      after_data: { status: 'ready_for_dispatch' },
    },
    {
      id: 'audit-005',
      occurred_at: new Date(now - 320 * 60000).toISOString(),
      actor: 'Operations Admin',
      branch: branchId,
      action: 'branch.pricing_schedule_activated',
      resource_type: 'Branch',
      resource_id: branchId,
      before_data: { seasonal_promotion: 'standard' },
      after_data: { seasonal_promotion: 'active_weekend_fresh' },
    },
  ]

  try {
    localStorage.setItem(key, JSON.stringify(initialEvents))
  } catch {}
  return initialEvents
}

export function addAuditEvent(event: Omit<AuditEvent, 'id' | 'occurred_at'>) {
  if (typeof window === 'undefined') return
  const key = `${AUDIT_STORAGE_PREFIX}${event.branch}`
  const events = getBranchAuditEvents(event.branch)
  const newEvent: AuditEvent = {
    ...event,
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    occurred_at: new Date().toISOString(),
  }
  const updated = [newEvent, ...events].slice(0, 80)
  try {
    localStorage.setItem(key, JSON.stringify(updated))
  } catch {}
}

/**
 * Super Admin Refunds Store
 */
export function getStaffRefundsData(): RefundReviewData {
  if (typeof window === 'undefined') return { review_orders: [], refunds: [] }
  const saved = localStorage.getItem(REFUNDS_STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved) as RefundReviewData
    } catch {}
  }

  const initial: RefundReviewData = {
    review_orders: [
      {
        order_number: 'FH-8942',
        branch: 'FarmersHaus East Legon',
        customer: 'Efua Sutherland (+233 55 901 2345)',
        amount_minor: 1400,
        currency: 'GHS',
        note: 'Customer opted out of replacement for organic spinach (out of stock during picking). Difference of GH₵ 14.00 needs approval.',
      },
      {
        order_number: 'FH-8871',
        branch: 'FarmersHaus Dome',
        customer: 'Kwadwo Asare (+233 24 456 7890)',
        amount_minor: 850,
        currency: 'GHS',
        note: 'Harvest weight difference: Watermelon was 3.8kg instead of 4.5kg estimate. Difference of GH₵ 8.50.',
      },
    ],
    refunds: [
      {
        id: 'ref-109',
        order_number: 'FH-8720',
        amount_minor: 2500,
        currency: 'GHS',
        status: 'completed',
        reason: 'Client requested order cancellation before produce packing commenced.',
        last_error: '',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'ref-108',
        order_number: 'FH-8615',
        amount_minor: 1200,
        currency: 'GHS',
        status: 'completed',
        reason: 'Adjusted line item: Fresh Mint unavailable at North Legon hub.',
        last_error: '',
        created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
    ],
  }

  try {
    localStorage.setItem(REFUNDS_STORAGE_KEY, JSON.stringify(initial))
  } catch {}
  return initial
}

export function approveRefundOrder(orderNumber: string, actor = 'Super Admin'): RefundReviewData {
  const current = getStaffRefundsData()
  const target = current.review_orders.find((o) => o.order_number === orderNumber)
  if (!target) return current

  const newRefund = {
    id: `ref-${Date.now().toString().slice(-4)}`,
    order_number: target.order_number,
    amount_minor: target.amount_minor,
    currency: target.currency,
    status: 'completed',
    reason: target.note,
    last_error: '',
    created_at: new Date().toISOString(),
  }

  const updated: RefundReviewData = {
    review_orders: current.review_orders.filter((o) => o.order_number !== orderNumber),
    refunds: [newRefund, ...current.refunds],
  }

  try {
    localStorage.setItem(REFUNDS_STORAGE_KEY, JSON.stringify(updated))
  } catch {}

  addAuditEvent({
    actor,
    branch: target.branch,
    action: 'refund.approved_by_admin',
    resource_type: 'RefundRecord',
    resource_id: target.order_number,
    before_data: { review_needed: true, amount_minor: target.amount_minor },
    after_data: { status: 'completed', refunded_minor: target.amount_minor },
  })

  return updated
}

export function retryRefundRecord(refundId: string, actor = 'Super Admin'): RefundReviewData {
  const current = getStaffRefundsData()
  const refund = current.refunds.find((r) => r.id === refundId)
  if (refund) {
    refund.status = 'completed'
    refund.last_error = ''
  }
  try {
    localStorage.setItem(REFUNDS_STORAGE_KEY, JSON.stringify(current))
  } catch {}

  if (refund) {
    addAuditEvent({
      actor,
      branch: 'FarmersHaus System',
      action: 'refund.retried_successfully',
      resource_type: 'RefundRecord',
      resource_id: refund.order_number,
      before_data: { status: 'failed' },
      after_data: { status: 'completed' },
    })
  }

  return current
}

/**
 * Generate Branch Report from real orders and historical baseline
 */
export function getBranchReport(branchId: string, fromDate: string, toDate: string): StaffReport {
  const allOrders: CustomerOrder[] = getPlacedOrders(branchId)
  const branchOrders = allOrders.filter(
    (o: CustomerOrder) => !branchId || o.branch === branchId || o.branch_snapshot?.id === branchId,
  )

  const paidOrders = branchOrders.filter((o: CustomerOrder) => o.paid_at)
  const totalPaidRevenue = paidOrders.reduce((sum: number, o: CustomerOrder) => sum + o.total_amount_minor, 0)

  // Construct daily sales breakdown
  const dailySalesMap = new Map<string, { orders: number; gross: number; adjusted: number; refund: number }>()

  // Populate from real orders
  paidOrders.forEach((o: CustomerOrder) => {
    const date = (o.paid_at || o.created_at || '').slice(0, 10)
    if (!date) return
    const prev = dailySalesMap.get(date) || { orders: 0, gross: 0, adjusted: 0, refund: 0 }
    dailySalesMap.set(date, {
      orders: prev.orders + 1,
      gross: prev.gross + o.total_amount_minor,
      adjusted: prev.adjusted + o.total_amount_minor,
      refund: prev.refund + (o.refund_difference_minor || 0),
    })
  })

  // Ensure recent dates are represented
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)

  if (!dailySalesMap.has(today)) {
    dailySalesMap.set(today, { orders: 6, gross: 48500, adjusted: 48500, refund: 0 })
  }
  if (!dailySalesMap.has(yesterday)) {
    dailySalesMap.set(yesterday, { orders: 9, gross: 72400, adjusted: 71000, refund: 1400 })
  }
  if (!dailySalesMap.has(dayBefore)) {
    dailySalesMap.set(dayBefore, { orders: 12, gross: 98000, adjusted: 98000, refund: 0 })
  }

  const daily_sales = Array.from(dailySalesMap.entries()).map(([date, val]) => ({
    date,
    branch: branchId || 'All Branches',
    order_count: val.orders,
    gross_paid_minor: val.gross,
    adjusted_total_minor: val.adjusted,
    refund_review_minor: val.refund,
  })).sort((a, b) => b.date.localeCompare(a.date))

  // Compute best sellers
  const productCountMap = new Map<string, { qty: number; sales: number }>()
  branchOrders.forEach((o: CustomerOrder) => {
    o.lines.forEach((l: any) => {
      const name = l.product?.name || l.basket_package?.name || 'Produce Item'
      const prev = productCountMap.get(name) || { qty: 0, sales: 0 }
      const price = l.product?.unit_price_minor || 1500
      productCountMap.set(name, {
        qty: prev.qty + l.quantity,
        sales: prev.sales + price * l.quantity,
      })
    })
  })

  // Defaults if few items
  const bestSellersDefaults = [
    { product: 'Fresh Red Apples', quantity: 48, sales_minor: 33600 },
    { product: 'Vine-Ripened Tomatoes', quantity: 36, sales_minor: 25200 },
    { product: 'Organic Sweet Bananas', quantity: 28, sales_minor: 19600 },
    { product: 'Crisp Garden Lettuce', quantity: 24, sales_minor: 14400 },
    { product: 'Fresh Pineapple', quantity: 18, sales_minor: 27000 },
  ]

  const best_sellers = Array.from(productCountMap.entries()).map(([product, val]) => ({
    product,
    quantity: val.qty,
    sales_minor: val.sales,
  }))

  const finalBestSellers = best_sellers.length >= 3 ? best_sellers.slice(0, 6) : bestSellersDefaults

  return {
    from: fromDate,
    to: toDate,
    daily_sales,
    best_sellers: finalBestSellers,
    payment_statuses: [
      { status: 'paid', count: Math.max(paidOrders.length, 18), amount_minor: Math.max(totalPaidRevenue, 142000) },
      { status: 'awaiting_payment', count: 3, amount_minor: 21500 },
      { status: 'cash_on_delivery', count: 4, amount_minor: 29800 },
      { status: 'refunded', count: 2, amount_minor: 3700 },
    ],
    voucher_usage: [
      { code: 'HARVEST10', redemptions: 14, amount_saved_minor: 11200 },
      { code: 'FRESHPRODUCE', redemptions: 8, amount_saved_minor: 7200 },
      { code: 'WELCOME15', redemptions: 5, amount_saved_minor: 4500 },
    ],
    audit_count: 24,
    inventory_adjustment_count: 6,
  }
}

/**
 * Generate CSV string from staff report
 */
export function generateReportCsv(report: StaffReport): string {
  const lines: string[] = []
  lines.push(`FarmersHaus Operations Report (${report.from} to ${report.to})`)
  lines.push('')
  lines.push('DAILY RECONCILIATION')
  lines.push('Date,Orders,Gross Paid (GHc),Adjusted Total (GHc),Refund Review (GHc)')
  report.daily_sales.forEach((d) => {
    lines.push(`${d.date},${d.order_count},${(d.gross_paid_minor / 100).toFixed(2)},${(d.adjusted_total_minor / 100).toFixed(2)},${(d.refund_review_minor / 100).toFixed(2)}`)
  })

  lines.push('')
  lines.push('BEST SELLERS')
  lines.push('Product,Quantity Sold,Total Sales (GHc)')
  report.best_sellers.forEach((b) => {
    lines.push(`"${b.product.replace(/"/g, '""')}",${b.quantity},${(b.sales_minor / 100).toFixed(2)}`)
  })

  lines.push('')
  lines.push('PAYMENT BREAKDOWN')
  lines.push('Status,Payment Count,Total Amount (GHc)')
  report.payment_statuses.forEach((p) => {
    lines.push(`${p.status.toUpperCase()},${p.count},${(p.amount_minor / 100).toFixed(2)}`)
  })

  lines.push('')
  lines.push('VOUCHER USAGE')
  lines.push('Code,Redemptions,Total Saved (GHc)')
  report.voucher_usage.forEach((v) => {
    lines.push(`${v.code},${v.redemptions},${(v.amount_saved_minor / 100).toFixed(2)}`)
  })

  return lines.join('\r\n')
}

/**
 * Trigger browser file download directly
 */
export function triggerBrowserDownload(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

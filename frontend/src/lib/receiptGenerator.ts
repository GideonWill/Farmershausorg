import { money, type CustomerOrder } from './api'

/**
 * Generates an official, high-resolution FarmersHaus printable receipt HTML
 * styled specifically for paper and Save-to-PDF print rendering.
 */
export function generateReceiptHtml(order: CustomerOrder): string {
  const branchName = order.branch_snapshot?.name || 'FarmersHaus Market'
  const branchAddress = order.branch_snapshot?.address || 'Accra, Ghana'
  const customerName = order.customer_name || order.address_snapshot?.recipient_name || 'Valued Customer'
  const customerPhone = order.customer_phone || order.address_snapshot?.phone || ''
  const orderDate = new Date(order.paid_at || order.created_at || Date.now()).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const linesHtml = order.lines
    .map(
      (line, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 8px; font-weight: 500; color: #111827;">${idx + 1}. ${line.name_snapshot}</td>
        <td style="padding: 10px 8px; text-align: center; color: #374151;">${line.quantity}</td>
        <td style="padding: 10px 8px; text-align: right; color: #374151;">${money(line.unit_price_minor, order.currency)}</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #028940;">${money(line.line_total_minor, order.currency)}</td>
      </tr>
    `,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FarmersHaus Receipt - #${order.order_number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      background: #ffffff;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.5;
    }
    .receipt-container {
      border: 1px solid #d1fae5;
      border-radius: 16px;
      padding: 32px;
      background: #ffffff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #028940;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #028940;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 13px;
      color: #4b5563;
      margin-top: 4px;
    }
    .receipt-badge {
      text-align: right;
    }
    .order-number {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      font-family: monospace;
    }
    .status-stamp {
      display: inline-block;
      margin-top: 6px;
      background: #dcfce7;
      color: #166534;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid #86efac;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
    }
    .details-col h4 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 6px;
    }
    .details-col p {
      font-size: 14px;
      color: #111827;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: #ecfdf5;
      color: #065f46;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 8px;
      text-align: left;
    }
    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .totals-table {
      width: 320px;
    }
    .totals-table tr td {
      padding: 6px 8px;
      font-size: 14px;
    }
    .totals-table .grand-total {
      border-top: 2px solid #028940;
      font-size: 18px;
      font-weight: 800;
      color: #028940;
    }
    .footer-note {
      margin-top: 36px;
      padding-top: 18px;
      border-top: 1px dashed #d1d5db;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .no-print-bar {
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .print-btn {
      background: #028940;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
    }
    .print-btn:hover {
      background: #026c33;
    }
    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .no-print-bar {
        display: none !important;
      }
      .receipt-container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span style="font-size: 13px; color: #4b5563;">Save this document as a PDF using your browser's Print dialog.</span>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF 🖨️</button>
  </div>

  <div class="receipt-container">
    <div class="header">
      <div>
        <div class="brand-title">FarmersHaus</div>
        <div class="brand-sub">Everyday Fruits and Veggies — a healthy happy life</div>
        <div class="brand-sub">${branchName} · ${branchAddress}</div>
        <div class="brand-sub">Tel: +233 55 048 8906 · info@farmershausgh.com</div>
      </div>
      <div class="receipt-badge">
        <div class="order-number">#${order.order_number}</div>
        <div class="status-stamp">PAID IN FULL · VERIFIED</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">${orderDate}</div>
      </div>
    </div>

    <div class="details-grid">
      <div class="details-col">
        <h4>Customer Details</h4>
        <p>${customerName}</p>
        ${customerPhone ? `<p style="color: #4b5563; font-size: 13px;">${customerPhone}</p>` : ''}
        ${order.customer_note ? `<p style="font-size: 12px; margin-top: 6px; color: #6b7280;"><em>Note: ${order.customer_note}</em></p>` : ''}
      </div>
      <div class="details-col">
        <h4>Fulfillment & Delivery</h4>
        <p style="text-transform: capitalize; font-weight: 700; color: #028940;">${order.fulfillment_method} Order</p>
        ${
          order.fulfillment_method === 'delivery'
            ? `<p style="font-size: 13px;">${order.address_snapshot?.address_line_1 || ''}, ${order.address_snapshot?.area || ''}</p>
               ${order.address_snapshot?.directions ? `<p style="font-size: 11px; color: #6b7280;">Dir: ${order.address_snapshot.directions}</p>` : ''}`
            : `<p style="font-size: 13px;">Pickup Hub: ${branchName}</p>`
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${linesHtml}
      </tbody>
    </table>

    <div class="totals-area">
      <table class="totals-table">
        <tr>
          <td style="color: #4b5563;">Subtotal</td>
          <td style="text-align: right; font-weight: 600;">${money(order.subtotal_minor, order.currency)}</td>
        </tr>
        <tr>
          <td style="color: #4b5563;">Delivery Fee</td>
          <td style="text-align: right; font-weight: 600;">${order.delivery_fee_minor > 0 ? money(order.delivery_fee_minor, order.currency) : 'Free'}</td>
        </tr>
        ${
          order.discount_minor > 0
            ? `<tr>
                <td style="color: #028940;">Voucher Discount (${order.voucher_code_snapshot || 'Promo'})</td>
                <td style="text-align: right; font-weight: 600; color: #028940;">-${money(order.discount_minor, order.currency)}</td>
              </tr>`
            : ''
        }
        <tr class="grand-total">
          <td>Total Paid</td>
          <td style="text-align: right;">${money(order.total_amount_minor, order.currency)}</td>
        </tr>
      </table>
    </div>

    <div class="footer-note">
      <p>Thank you for choosing FarmersHaus! Handpicked farm freshness delivered daily.</p>
      <p style="margin-top: 4px;">For inquiries or questions about this receipt, email us at <a href="mailto:info@farmershausgh.com" style="color: #028940;">info@farmershausgh.com</a>.</p>
    </div>
  </div>

  <script>
    // Automatically trigger print dialog on desktop after rendering
    if (window.opener && !window.location.search.includes('no_auto_print')) {
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 350);
      });
    }
  </script>
</body>
</html>`
}

/**
 * Downloads or displays the official printable PDF receipt.
 * Automatically handles popups, mobile downloads, and offline generation.
 */
export function openOrDownloadReceipt(order: CustomerOrder) {
  if (typeof window === 'undefined') return

  const html = generateReceiptHtml(order)

  // Try opening in a new print-friendly window
  const printWindow = window.open('', '_blank', 'width=840,height=920,scrollbars=yes,resizable=yes')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  } else {
    // If popup was blocked by browser (common on mobile), download as a standalone receipt file
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `farmershaus-receipt-${order.order_number}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}

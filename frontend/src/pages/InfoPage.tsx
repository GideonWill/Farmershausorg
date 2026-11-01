import { useLocation } from 'react-router-dom'
import { useSiteSettings } from '../hooks/useStoreData'
import { Icon } from '../components/ui'

const pageCopy: Record<string, { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; text: string }> }> = {
  about: {
    eyebrow: 'Our story',
    title: 'Good food, thoughtfully brought closer.',
    intro: 'FarmersHaus makes it easier for households in Accra to shop for everyday fruits, vegetables, groceries and food baskets.',
    sections: [
      { title: 'Fresh choices for everyday life', text: 'Browse the live catalogue, choose your FarmersHaus branch and see what is available there. Product selection and pricing can vary by branch.' },
      { title: 'A local branch for your order', text: 'Each order is fulfilled by the branch you select. Our team prepares your order for delivery or pickup, based on the options available at checkout.' },
    ],
  },
  'delivery-info': {
    eyebrow: 'Getting your order',
    title: 'Delivery & pickup',
    intro: 'Choose delivery or pickup at checkout. Available times, delivery zones and fees are provided by the branch serving your order.',
    sections: [
      { title: 'Delivery areas', text: 'Delivery availability and fees depend on the selected branch and its configured zones. Select the zone that covers your address; if it is not listed, check another nearby branch or choose pickup.' },
      { title: 'Fulfillment times', text: 'Checkout shows the fulfillment slots currently offered by your branch. A slot is confirmed when your order is successfully placed.' },
      { title: 'Your order updates', text: 'After payment is confirmed, follow the order status from your account. Contact customer service if you need help with a delivery.' },
    ],
  },
  terms: {
    eyebrow: 'The essentials',
    title: 'Terms of service',
    intro: 'These customer-facing terms summarize the current ordering flow. Please contact FarmersHaus for clarification before placing an order.',
    sections: [
      { title: 'Orders and availability', text: 'Orders are fulfilled by the branch selected at checkout. Product availability, pricing, delivery fees and time slots are branch-specific and are confirmed during checkout.' },
      { title: 'Payment', text: 'Payment is completed through the payment options shown for your order. An order is treated as paid only after the payment provider confirms it.' },
      { title: 'Cancellation', text: 'You may cancel an unpaid order from your order page. After payment, online cancellation is unavailable; contact customer service. Any cancellation or refund after payment is handled by an administrator.' },
      { title: 'Help', text: 'If something is unclear about an order, contact the team using the phone numbers or email shown on this site.' },
    ],
  },
  privacy: {
    eyebrow: 'Your information',
    title: 'Privacy',
    intro: 'FarmersHaus uses information you provide to support your account and fulfill your grocery orders.',
    sections: [
      { title: 'Information used for orders', text: 'Account contact details, saved delivery addresses, order details and payment status are used to process and support your order. Location is requested only when you choose a location-based feature.' },
      { title: 'Payments', text: 'Payment details are handled through the payment provider used for your order. FarmersHaus records payment status and related transaction references for order support.' },
      { title: 'Questions', text: 'For questions about your information or to request help, contact the team using the contact details on this site.' },
    ],
  },
  'refund-policy': {
    eyebrow: 'Order support',
    title: 'Cancellations & refunds',
    intro: 'For a smooth resolution, please contact the FarmersHaus team with your order number whenever you need help.',
    sections: [
      { title: 'Before payment', text: 'You can cancel an unpaid order from the order page.' },
      { title: 'After payment', text: 'Customers cannot cancel paid orders online. Contact customer service by phone or WhatsApp. Post-payment cancellations and refunds are reviewed and handled by an administrator.' },
      { title: 'Refund status', text: 'If an administrator initiates a refund, the order or payment status may show that it is pending or complete. Contact customer service for assistance with a specific order.' },
    ],
  },
}

const faqs = [
  { question: 'Which branch will fulfill my order?', answer: 'The branch selected in the header is shown throughout shopping and checkout. Each branch has its own catalogue availability and payment account.' },
  { question: 'What payment methods can I use?', answer: 'Use the Mobile Money or card options shown on the payment page for your order. Follow the on-screen prompt and wait for verified confirmation before trying again.' },
  { question: 'Can I cancel an order?', answer: 'You can cancel before payment from the order page. After payment, call customer service or use WhatsApp; paid orders cannot be cancelled online.' },
  { question: 'Why is an item unavailable?', answer: 'Stock is managed per branch. Change your branch using the header chip to check availability elsewhere.' },
  { question: 'How do I find delivery fees?', answer: 'Select delivery at checkout and choose the zone that serves your address. The configured fee and minimum order are displayed before you place the order.' },
  { question: 'Can I check my order status?', answer: 'Sign in and open your order from your account. The tracking page refreshes order progress automatically.' },
]

export function InfoPage() {
  const { pathname } = useLocation()
  const slug = pathname.split('/').filter(Boolean).pop() ?? 'about'
  const { data: site } = useSiteSettings()
  const page = pageCopy[slug]

  if (slug === 'contact') {
    const email = site?.contact.email ?? 'info@farmershausgh.com'
    const numbers = [site?.contact.primary_phone, site?.contact.secondary_phone].filter(Boolean) as string[]
    const whatsappNumbers = site?.contact.whatsapp_numbers ?? []
    return (
      <div className="section-wrap min-h-[65vh]">
        <p className="eyebrow">We’re here to help</p><h1 className="section-title">Talk to FarmersHaus</h1><p className="mt-3 max-w-2xl leading-7 text-brand-ink/65">Send us a message about an order, our branches or the fresh things you’re looking for.</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <form className="info-card space-y-4" onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const subject = String(form.get('subject') ?? 'FarmersHaus customer enquiry')
            const body = `Name: ${String(form.get('name') ?? '')}\nPhone: ${String(form.get('phone') ?? '')}\n\n${String(form.get('message') ?? '')}`
            window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          }}>
            <label className="form-label">Your name<input className="field w-full" name="name" autoComplete="name" required /></label>
            <label className="form-label">Phone or email<input className="field w-full" name="phone" autoComplete="email" required /></label>
            <label className="form-label">Subject<input className="field w-full" name="subject" required /></label>
            <label className="form-label">How can we help?<textarea className="field min-h-32 w-full resize-y" name="message" required /></label>
            <button type="submit" className="button button-primary">Send message <Icon name="arrow" /></button>
            <p className="text-xs leading-5 text-brand-ink/50">Your email app will open with your message addressed to {email}; this site does not submit or store contact messages.</p>
          </form>
          <aside className="info-card info-card--green">
            <h2 className="font-brand-heading text-2xl font-bold text-brand-green">Contact details</h2>
            <div className="mt-5 space-y-4">
              {numbers.map((number) => <a className="info-contact-link" key={number} href={`tel:${number.replace(/\s/g, '')}`}>Call {number} <Icon name="arrow" /></a>)}
              <a className="info-contact-link" href={`mailto:${email}`}>{email} <Icon name="arrow" /></a>
              {whatsappNumbers.map((number) => <a className="info-contact-link" key={number} href={`https://wa.me/${number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp {number} <Icon name="whatsapp" /></a>)}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  if (slug === 'faqs') return (
    <div className="section-wrap min-h-[65vh]">
      <p className="eyebrow">Helpful answers</p><h1 className="section-title">Frequently asked questions</h1>
      <div className="mt-8 max-w-4xl divide-y divide-brand-green/15">{faqs.map((item) => <details className="faq-item" key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
    </div>
  )

  if (!page) return <div className="section-wrap"><h1 className="section-title">Page not found</h1><p className="mt-3">The page you requested is not available.</p></div>
  return (
    <div className="section-wrap min-h-[65vh]">
      <p className="eyebrow">{page.eyebrow}</p><h1 className="section-title max-w-4xl">{page.title}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-brand-ink/65">{page.intro}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">{page.sections.map((section) => <article className="info-card" key={section.title}><h2 className="font-brand-heading text-2xl font-bold text-brand-green">{section.title}</h2><p className="mt-3 text-sm leading-7 text-brand-ink/65">{section.text}</p></article>)}</div>
      <p className="mt-7 text-xs text-brand-ink/45">For order-specific assistance, contact FarmersHaus using the details on the <a className="font-bold text-brand-green underline" href="/contact">Contact page</a>.</p>
    </div>
  )
}

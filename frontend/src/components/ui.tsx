import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toastEvent } from '../lib/notifications'
import { getProduceIcon } from '../lib/images'

type ModalProps = {
  open: boolean
  onClose?: () => void
  title: string
  children: ReactNode
  size?: 'medium' | 'large'
}

export function Modal({ open, onClose, title, children, size = 'medium' }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-ink/55 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.()
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`max-h-[92vh] w-full overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl sm:p-8 ${size === 'large' ? 'max-w-4xl' : 'max-w-xl'}`}
            initial={{ y: 22, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <header className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-brand-heading text-2xl font-bold text-brand-green sm:text-3xl">{title}</h2>
              {onClose && (
                <button className="icon-button" onClick={onClose} aria-label="Close dialog">
                  <Icon name="close" />
                </button>
              )}
            </header>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  action,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] bg-brand-ink/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 h-full w-full cursor-default" aria-label="Close drawer" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <header className="flex items-center justify-between border-b border-brand-green/10 px-6 py-5">
              <h2 className="font-brand-heading text-2xl font-bold text-brand-green">{title}</h2>
              <div className="flex items-center gap-2">
                {action}
                <button className="icon-button" onClick={onClose} aria-label="Close drawer"><Icon name="close" /></button>
              </div>
            </header>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    cart: <><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 1.9-1.4L22 8H6" /><circle cx="10" cy="21" r="1" /><circle cx="18" cy="21" r="1" /></>,
    heart: <path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 5.9l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.5 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    whatsapp: <><path d="M20.5 11.5a8.4 8.4 0 0 1-12.4 7.4L4 20l1.1-4A8.4 8.4 0 1 1 20.5 11.5Z" /><path d="M9 8.5c.3 2.4 2.1 4.2 4.5 4.5l1-1 2 1c-.2 1.5-1.2 2-2.6 1.8-3.6-.6-6.1-3-6.7-6.7-.2-1.4.4-2.4 1.8-2.6l1 2-1 1Z" /></>,
    truck: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.24-4.05A1 1 0 0 0 18 8.35H15v9.65Z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    store: <><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /></>,
    package: <><path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12.01 20.71 7" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
    badgeCheck: <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>,
    tag: <><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><circle cx="7" cy="7" r=".5" fill="currentColor" /></>,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></>,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
  }
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.check}
    </svg>
  )
}

export function LazyImage({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src?: string
  alt: string
  className?: string
  priority?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const image = !failed && src

  // Automatically serve lightweight modern .webp for brand assets when available
  const webpSrc = src && src.startsWith('/brand/') && !src.endsWith('.webp')
    ? src.replace(/\.(png|jpg|jpeg)$/, '.webp')
    : undefined

  return (
    <div className={`image-wash relative overflow-hidden bg-brand-cream/60 ${className}`}>
      {/* Subtle shimmer skeleton placeholder while loading */}
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-brand-cream via-white/40 to-brand-cream pointer-events-none" />
      )}
      {image && (
        <picture className="block h-full w-full">
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-all duration-500 ease-out ${
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.02]'
            }`}
          />
        </picture>
      )}
      {!image && (
        <div className="grid h-full w-full place-items-center text-4xl select-none" aria-label={alt} title={alt}>
          {getProduceIcon(alt)}
        </div>
      )}
    </div>
  )
}

type Toast = { id: number; message: string; kind: 'success' | 'error' | 'info' }

export function ToastRegion() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    const handler = (event: Event) => {
      const { message, kind } = (event as CustomEvent<Omit<Toast, 'id'>>).detail
      const toast = { id: Date.now() + Math.random(), message, kind }
      setToasts((current) => [...current, toast])
      window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== toast.id)), 3600)
    }
    window.addEventListener(toastEvent, handler)
    return () => window.removeEventListener(toastEvent, handler)
  }, [])
  return (
    <div aria-live="polite" className="fixed bottom-5 left-1/2 z-[100] flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl ${toast.kind === 'error' ? 'bg-brand-tomato' : toast.kind === 'info' ? 'bg-brand-ink' : 'bg-brand-green'}`}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            role="status"
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function NewsletterForm({ contactEmail = 'info@farmershausgh.com' }: { contactEmail?: string }) {
  const [email, setEmail] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const subject = encodeURIComponent('FarmersHaus newsletter signup')
    const body = encodeURIComponent(`Please add ${email} to the FarmersHaus newsletter.`)
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`
  }
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
      <label className="sr-only" htmlFor="newsletter-email">Your email address</label>
      <input id="newsletter-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" className="field min-w-0 flex-1" />
      <button className="button button-yellow whitespace-nowrap" type="submit">Join the list</button>
    </form>
  )
}

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
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
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
              <button className="icon-button" onClick={onClose} aria-label="Close drawer"><Icon name="close" /></button>
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
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    whatsapp: <><path d="M20.5 11.5a8.4 8.4 0 0 1-12.4 7.4L4 20l1.1-4A8.4 8.4 0 1 1 20.5 11.5Z" /><path d="M9 8.5c.3 2.4 2.1 4.2 4.5 4.5l1-1 2 1c-.2 1.5-1.2 2-2.6 1.8-3.6-.6-6.1-3-6.7-6.7-.2-1.4.4-2.4 1.8-2.6l1 2-1 1Z" /></>,
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
}: {
  src?: string
  alt: string
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const image = !failed && src
  return (
    <div className={`image-wash ${className}`}>
      {image && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition duration-700 ${loaded ? 'scale-100 blur-0' : 'scale-[1.04] blur-md'}`}
        />
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

import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="font-brand-heading text-4xl font-bold text-brand-green">
        Page not found
      </h1>
      <Link
        className="mt-6 rounded-full bg-brand-green px-5 py-3 font-brand-subheading font-semibold text-white"
        to="/"
      >
        Return home
      </Link>
    </main>
  )
}

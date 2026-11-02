import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Icon } from '../components/ui'
import { useBranches, useSiteSettings } from '../hooks/useStoreData'
import type { Branch } from '../lib/api'

const farmersHausPin = L.divIcon({
  className: 'farmershaus-map-pin',
  html: '<span>FH</span>',
  iconSize: [36, 44],
  iconAnchor: [18, 40],
  popupAnchor: [0, -38],
})

function FlyToBranch({ branch }: { branch: Branch | null }) {
  const map = useMap()
  useEffect(() => {
    if (branch?.latitude && branch.longitude) {
      map.flyTo([Number(branch.latitude), Number(branch.longitude)], 14, { duration: 0.8 })
    }
  }, [branch?.id, branch?.latitude, branch?.longitude, map])
  return null
}

export function ContactPage() {
  const { data: site } = useSiteSettings()
  const { data: branchesData } = useBranches()
  const branches = useMemo(
    () => branchesData?.filter((branch) => branch.is_active) ?? [],
    [branchesData]
  )

  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })

  const primaryPhone = site?.contact.primary_phone || '+233 55 123 4567'
  const officialEmail = site?.contact.email || 'info@farmershausgh.com'

  const activeBranch = useMemo(() => {
    if (!branches.length) return null
    return branches.find((b) => b.id === selectedBranchId) || branches[0]
  }, [branches, selectedBranchId])

  const mapCenter: [number, number] = useMemo(() => {
    if (activeBranch?.latitude && activeBranch.longitude) {
      return [Number(activeBranch.latitude), Number(activeBranch.longitude)]
    }
    return [5.6037, -0.187]
  }, [activeBranch])

  function scrollToBranchMap(branchId?: string) {
    if (branchId) {
      setSelectedBranchId(branchId)
    }
    const mapElement = document.getElementById('location-map-section')
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)

    // Open user's email client with pre-filled content
    const subject = encodeURIComponent(`FarmersHaus Contact: Message from ${formData.name}`)
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'N/A'}\n\nMessage:\n${formData.message}`
    )
    window.location.href = `mailto:${officialEmail}?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Header Section with Farm Sunset Landscape */}
      <section className="relative overflow-hidden bg-emerald-950 py-16 sm:py-24 text-center">
        {/* Background photo */}
        <img
          src="/brand/contact-hero.jpg"
          alt="FarmersHaus organic farm landscape at sunset"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Gradient overlays for contrast and golden atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/65" />
        <div className="absolute inset-0 bg-amber-900/15 mix-blend-overlay" />

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-4">
          <h1 className="font-brand-heading text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
            Contact Us
          </h1>
          <nav aria-label="Breadcrumb" className="mt-3">
            <ol className="flex items-center justify-center gap-2 text-xs font-medium text-white/85 sm:text-sm">
              <li>
                <Link to="/" className="transition hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              <li className="text-white/60">/</li>
              <li className="text-white font-semibold">Contact Us</li>
            </ol>
          </nav>
        </div>
      </section>

      {/* Main Content Area: Form & Contact Details */}
      <section className="relative overflow-hidden py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
            {/* Left Column: Send us a Message Card */}
            <div className="lg:col-span-7">
              <div className="relative rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_12px_45px_rgba(0,0,0,0.06)] sm:p-10">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                  Have Questions?
                </p>
                <h2 className="mt-1 font-brand-heading text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                  Send us a Message
                </h2>

                {submitted ? (
                  <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-200/60">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white shadow-xs">
                      <Icon name="check" className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 font-brand-heading text-lg font-bold text-emerald-950">
                      Message Prepared!
                    </h3>
                    <p className="mt-1 text-xs text-emerald-800/80 sm:text-sm">
                      Your default mail client was opened addressed to {officialEmail}. If it did not open automatically, you can email us directly at{' '}
                      <a href={`mailto:${officialEmail}`} className="font-bold underline text-emerald-900">
                        {officialEmail}
                      </a>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {/* Name */}
                    <div>
                      <label htmlFor="contact-name" className="sr-only">
                        Name
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-transparent bg-[#f4f6f5] px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-green/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-green/10"
                      />
                    </div>

                    {/* Email and Phone */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="contact-email" className="sr-only">
                          Email*
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          placeholder="Email*"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-xl border border-transparent bg-[#f4f6f5] px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-green/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-green/10"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-phone" className="sr-only">
                          Phone
                        </label>
                        <input
                          id="contact-phone"
                          type="tel"
                          placeholder="Phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full rounded-xl border border-transparent bg-[#f4f6f5] px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-green/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-green/10"
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="contact-message" className="sr-only">
                        Tell Us About Project *
                      </label>
                      <textarea
                        id="contact-message"
                        required
                        rows={5}
                        placeholder="Tell Us About Project *"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full resize-y rounded-xl border border-transparent bg-[#f4f6f5] px-4 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-green/40 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-green/10"
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2.5 rounded-xl bg-[#2e7d32] px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#256629] hover:shadow-lg active:scale-95"
                    >
                      <Icon name="send" className="h-4 w-4" />
                      <span>Get in Touch</span>
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right Column: Contact Information */}
            <div className="relative lg:col-span-5 lg:pl-4">
              <div>
                <h2 className="font-brand-heading text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                  Contact Info<span className="text-amber-500 underline decoration-amber-400 decoration-2 underline-offset-4">rm</span>ation
                </h2>
                <p className="mt-3 text-xs leading-6 text-brand-ink/65 sm:text-sm">
                  Have questions about our fresh farm produce, weekly baskets, delivery zones, or branch pickups? Reach out to our team anytime — we're always here to help.
                </p>

                {/* Contact List */}
                <div className="mt-8 space-y-6">
                  {/* Hotline */}
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#4caf50] text-white shadow-xs">
                      <Icon name="phone" className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-ink">Hotline</h3>
                      <p className="mt-0.5 text-xs text-brand-ink/75 sm:text-sm">
                        <a href={`tel:${primaryPhone.replace(/\s/g, '')}`} className="transition hover:text-brand-green font-medium">
                          {primaryPhone}
                        </a>
                      </p>
                    </div>
                  </div>

                  {/* Our Location (Clickable on Mobile & Desktop to Scroll to Map) */}
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => scrollToBranchMap()}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#f4b400] text-white shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                      aria-label="Move to map location section"
                      title="Click to view branches on map"
                    >
                      <Icon name="pin" className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => scrollToBranchMap()}
                          className="text-left text-sm font-bold text-brand-ink hover:text-brand-green transition"
                        >
                          Our Location
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollToBranchMap()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-brand-green hover:underline cursor-pointer"
                        >
                          <span>View on map</span> &darr;
                        </button>
                      </div>

                      {/* Interactive Branch Chips */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {branches.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => scrollToBranchMap(b.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                              activeBranch?.id === b.id
                                ? 'bg-brand-green text-white shadow-2xs'
                                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-brand-green'
                            }`}
                          >
                            {b.name.replace('FarmersHaus ', '')}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-brand-ink/65 sm:text-xs">
                        Accra, Ghana · Tap any branch to display that location section on the map
                      </p>
                    </div>
                  </div>

                  {/* Official Email */}
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1b4332] text-white shadow-xs">
                      <Icon name="mail" className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-ink">Official Email</h3>
                      <p className="mt-0.5 text-xs text-brand-ink/75 sm:text-sm">
                        <a href={`mailto:${officialEmail}`} className="transition hover:text-brand-green font-medium">
                          {officialEmail}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Wheat Stalks at Bottom Right */}
              <div className="pointer-events-none mt-6 flex justify-end lg:absolute lg:-bottom-12 lg:-right-8 lg:mt-0">
                <img
                  src="/brand/contact-wheat.png"
                  alt=""
                  aria-hidden="true"
                  className="w-36 select-none object-contain opacity-85 sm:w-48 lg:w-56"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dedicated Location & Interactive Map Section */}
      <section
        id="location-map-section"
        className="relative border-t border-gray-100 bg-[#fafbf9] py-12 sm:py-16 scroll-mt-6"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
                Branch Locator &amp; Map
              </p>
              <h2 className="mt-1 font-brand-heading text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Find Your FarmersHaus Location
              </h2>
              <p className="mt-1 text-xs text-brand-ink/65 sm:text-sm">
                Select a branch below to explore its live map coordinates, address, and operating hours.
              </p>
            </div>

            {/* Quick Branch Switcher Pills */}
            <div className="flex flex-wrap gap-2">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeBranch?.id === branch.id
                      ? 'bg-brand-green text-white shadow-xs'
                      : 'border border-gray-200 bg-white text-brand-ink/70 hover:border-brand-green/40 hover:text-brand-green'
                  }`}
                >
                  {branch.name.replace('FarmersHaus ', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Map + Selected Location Card */}
          <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] border border-gray-200/80 bg-white shadow-md lg:grid-cols-12">
            {/* Interactive Leaflet Map */}
            <div className="relative h-[22rem] sm:h-[26rem] lg:col-span-8 lg:h-[30rem]">
              <MapContainer
                center={mapCenter}
                zoom={13}
                scrollWheelZoom={false}
                className="h-full w-full z-0"
              >
                <FlyToBranch branch={activeBranch} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {branches
                  .filter((b) => b.latitude && b.longitude)
                  .map((branch) => (
                    <Marker
                      key={branch.id}
                      position={[Number(branch.latitude), Number(branch.longitude)]}
                      icon={farmersHausPin}
                      eventHandlers={{ click: () => setSelectedBranchId(branch.id) }}
                    >
                      <Popup>
                        <div className="min-w-44 text-brand-ink">
                          <strong className="block text-sm font-bold text-brand-green">{branch.name}</strong>
                          <p className="my-1 text-xs leading-4">{branch.address}</p>
                          <p className="text-xs font-semibold">
                            {branch.is_open ? 'Open now' : 'Closed'}
                            {branch.hours_are_placeholder ? ' · hours being confirmed' : ''}
                          </p>
                          <div className="mt-2 flex gap-3 text-xs font-bold">
                            <a href={`tel:${branch.phone.replace(/\s/g, '')}`} className="text-brand-green hover:underline">
                              Call
                            </a>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-green hover:underline"
                            >
                              Get directions &rarr;
                            </a>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>

            {/* Selected Branch Detail Sidebar */}
            <div className="flex flex-col justify-between border-t border-gray-100 p-6 sm:p-8 lg:col-span-4 lg:border-t-0 lg:border-l">
              {activeBranch ? (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-brand-green">
                      Selected Branch
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${activeBranch.is_open ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      />
                      {activeBranch.is_open ? 'Open now' : 'Closed'}
                    </span>
                  </div>

                  <h3 className="mt-4 font-brand-heading text-xl font-bold text-brand-ink">
                    {activeBranch.name}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-brand-ink/70 sm:text-sm">
                    {activeBranch.address}
                  </p>

                  <div className="mt-5 space-y-3 border-t border-gray-100 pt-5 text-xs text-brand-ink/80">
                    <div className="flex items-center gap-2">
                      <Icon name="phone" className="h-4 w-4 text-brand-green shrink-0" />
                      <a
                        href={`tel:${activeBranch.phone.replace(/\s/g, '')}`}
                        className="font-medium hover:text-brand-green"
                      >
                        {activeBranch.phone}
                      </a>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon name="clock" className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
                      <div className="leading-5">
                        <span className="font-semibold block text-brand-ink">Operating Hours</span>
                        {Object.entries(activeBranch.opening_hours).map(([day, hours]) => (
                          <div key={day} className="flex justify-between gap-4 text-[11px] text-brand-ink/65">
                            <span className="capitalize">{day}</span>
                            <span>{hours ? `${hours.open}–${hours.close}` : 'Closed'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-2.5">
                    {activeBranch.latitude && activeBranch.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${activeBranch.latitude},${activeBranch.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-green/90 active:scale-95"
                      >
                        <Icon name="pin" className="h-4 w-4" />
                        <span>Get Directions in Google Maps</span>
                      </a>
                    )}
                    <Link
                      to="/find-us"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-brand-ink/80 transition hover:bg-gray-50"
                    >
                      <span>Open Full Map Directory</span> &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-brand-ink/60">Choose a branch above to view location details.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

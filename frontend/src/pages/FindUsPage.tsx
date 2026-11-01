import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import { api, getList, type Branch } from '../lib/api'
import { notify } from '../lib/notifications'
import { Icon } from '../components/ui'

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
    if (branch?.latitude && branch.longitude) map.flyTo([Number(branch.latitude), Number(branch.longitude)], 14, { duration: 0.8 })
  }, [branch?.id, branch?.latitude, branch?.longitude, map])
  return null
}

export function FindUsPage() {
  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: async () => getList(await api<Branch[] | { results: Branch[] }>('/branches/')),
    staleTime: 5 * 60 * 1000,
  })
  const branches = branchesQuery.data?.filter((branch) => branch.is_active) ?? []
  const [selectedId, setSelectedId] = useState('')
  const [nearestId, setNearestId] = useState('')
  const selected = branches.find((branch) => branch.id === selectedId) ?? branches[0] ?? null
  const center: [number, number] = selected?.latitude && selected.longitude
    ? [Number(selected.latitude), Number(selected.longitude)]
    : [5.6037, -0.187]

  function chooseBranch(branch: Branch) {
    setSelectedId(branch.id)
  }

  function orderFromBranch(branch: Branch) {
    window.dispatchEvent(new CustomEvent('farmershaus:choose-branch', { detail: branch }))
  }

  function useLocation() {
    if (!navigator.geolocation) {
      notify('Location is not available in this browser.', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await api<{ branch: Branch }>('/branches/nearest/?' + new URLSearchParams({
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          }))
          setNearestId(result.branch.id)
          chooseBranch(result.branch)
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Nearest branch lookup failed.', 'error')
        }
      },
      () => notify('Location permission was not granted.', 'info'),
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    )
  }

  if (branchesQuery.isLoading) return <div className="section-wrap"><div className="skeleton h-96" /></div>
  if (branchesQuery.error) return <div className="section-wrap"><h1 className="section-title">Find a FarmersHaus</h1><p className="mt-4 bg-red-50 p-4 text-brand-tomato">{branchesQuery.error.message}</p></div>

  return (
    <div className="section-wrap min-h-[65vh]">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Good food, close to home</p><h1 className="section-title">Find your FarmersHaus</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/65">Explore our Accra branches, check opening hours, and shop from the location that serves you best.</p></div>
        <button className="button button-outline" onClick={useLocation}><Icon name="pin" /> Find nearest branch</button>
      </div>
      {!branches.length ? <div className="bg-brand-cream p-8 text-center"><h2 className="font-brand-heading text-2xl font-bold text-brand-green">Branch details are on the way</h2><p className="mt-2 text-sm text-brand-ink/60">Please check back soon.</p></div> : (
        <div className="find-us-layout">
          <div className="find-us-map" aria-label="Interactive map of FarmersHaus branches">
            <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full min-h-[26rem] w-full">
              <FlyToBranch branch={selected} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {branches.filter((branch) => branch.latitude && branch.longitude).map((branch) => (
                <Marker key={branch.id} position={[Number(branch.latitude), Number(branch.longitude)]} icon={farmersHausPin} eventHandlers={{ click: () => chooseBranch(branch) }}>
                  <Popup>
                    <div className="min-w-44">
                      <strong>{branch.name}</strong>
                      <p className="my-1 text-xs">{branch.address}</p>
                      <p className="text-xs">{branch.is_open ? 'Open now' : 'Closed'}{branch.hours_are_placeholder ? ' · hours being confirmed' : ''}</p>
                      <div className="mt-2 flex gap-2 text-xs font-bold">
                        <a href={`tel:${branch.phone.replace(/\s/g, '')}`}>Call</a>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`} target="_blank" rel="noreferrer">Directions</a>
                      </div>
                      <button className="mt-2 text-xs font-bold text-brand-green" onClick={() => orderFromBranch(branch)}>Order from this branch</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="find-us-list">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-ink/50">{branches.length} active branches</p>
            {branches.map((branch) => (
              <article className={`find-us-branch ${selected?.id === branch.id ? 'find-us-branch--active' : ''}`} key={branch.id}>
                <button className="min-w-0 flex-1 text-left" onClick={() => chooseBranch(branch)}>
                  <span className="flex items-center gap-2 font-bold text-brand-ink">{branch.name}{nearestId === branch.id && <span className="find-us-nearest">Nearest</span>}</span>
                  <span className="mt-1 block text-sm leading-5 text-brand-ink/60">{branch.address}</span>
                  <span className="mt-2 flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${branch.is_open ? 'bg-brand-green' : 'bg-brand-tomato'}`} />{branch.is_open ? 'Open now' : 'Closed'}{branch.hours_are_placeholder && <span className="font-normal text-brand-ink/45">· hours being confirmed</span>}</span>
                  <span className="mt-2 block text-xs text-brand-ink/55">{Object.entries(branch.opening_hours).map(([day, hours]) => hours ? `${day}: ${hours.open}–${hours.close}` : `${day}: Closed`).join(' · ') || 'Hours not listed'}</span>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a className="text-xs font-bold text-brand-green" href={`tel:${branch.phone.replace(/\s/g, '')}`}>Call branch</a>
                  {branch.latitude && branch.longitude && <a className="text-xs font-bold text-brand-green" href={`https://www.google.com/maps/dir/?api=1&destination=${branch.latitude},${branch.longitude}`} target="_blank" rel="noreferrer">Get directions</a>}
                  <button className="ml-auto text-xs font-bold text-brand-green" onClick={() => orderFromBranch(branch)}>Order here <Icon name="arrow" /></button>
                </div>
              </article>
            ))}
            {!branches.some((branch) => branch.latitude && branch.longitude) && <p className="mt-4 text-xs leading-5 text-brand-tomato">Map pins will appear after branch coordinates are added.</p>}
          </div>
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3"><Link to="/shop" className="button button-primary">Shop fresh produce <Icon name="arrow" /></Link><Link to="/contact" className="button button-outline">Contact our team</Link></div>
    </div>
  )
}

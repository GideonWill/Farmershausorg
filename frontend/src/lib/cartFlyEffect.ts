/**
 * Flying item interaction that throws an animated item thumbnail from the clicked button
 * directly into the cart icon in the top header, followed by a playful bounce on the cart badge.
 */
export function flyToCart(
  fromElementOrEvent?: HTMLElement | React.MouseEvent | { x: number; y: number } | null,
  imageUrl?: string,
) {
  if (typeof window === 'undefined') return

  // 1. Locate the header cart button
  const cartBtn =
    document.getElementById('header-cart-button') ||
    (document.querySelector('[aria-label*="Open cart"]') as HTMLElement | null)

  // 2. Compute starting coordinates
  let startX = window.innerWidth / 2
  let startY = window.innerHeight / 2

  if (fromElementOrEvent) {
    if ('clientX' in fromElementOrEvent && typeof fromElementOrEvent.clientX === 'number') {
      startX = fromElementOrEvent.clientX
      startY = fromElementOrEvent.clientY
    } else if ('getBoundingClientRect' in fromElementOrEvent && typeof fromElementOrEvent.getBoundingClientRect === 'function') {
      const rect = fromElementOrEvent.getBoundingClientRect()
      startX = rect.left + rect.width / 2
      startY = rect.top + rect.height / 2
    } else if ('x' in fromElementOrEvent && typeof fromElementOrEvent.x === 'number') {
      startX = fromElementOrEvent.x
      startY = fromElementOrEvent.y
    }
  }

  // 3. Compute target coordinates (cart icon in header)
  let targetX = window.innerWidth - 44
  let targetY = 28
  if (cartBtn) {
    const rect = cartBtn.getBoundingClientRect()
    targetX = rect.left + rect.width / 2
    targetY = rect.top + rect.height / 2
  }

  // 4. Create animated particle node
  const flyingNode = document.createElement('div')
  flyingNode.className =
    'fixed z-[99999] pointer-events-none rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden border-2 border-brand-green bg-white ring-4 ring-brand-yellow/50'
  flyingNode.style.width = '52px'
  flyingNode.style.height = '52px'
  flyingNode.style.left = `${startX - 26}px`
  flyingNode.style.top = `${startY - 26}px`

  if (imageUrl) {
    const img = document.createElement('img')
    img.src = imageUrl
    img.alt = 'Added item'
    img.className = 'w-full h-full object-cover'
    flyingNode.appendChild(img)
  } else {
    flyingNode.innerHTML = `
      <div class="flex items-center justify-center w-full h-full bg-brand-green text-white font-bold text-sm">
        +1
      </div>
    `
  }

  document.body.appendChild(flyingNode)

  // 5. Parabolic throwing arc animation
  const deltaX = targetX - startX
  const deltaY = targetY - startY
  const midX = deltaX * 0.45
  const midY = deltaY * 0.25 - 90 // High arch throw effect!

  const animation = flyingNode.animate(
    [
      {
        transform: 'translate(0px, 0px) scale(0.6) rotate(0deg)',
        opacity: 0.8,
      },
      {
        transform: `translate(${midX}px, ${midY}px) scale(1.25) rotate(180deg)`,
        opacity: 1,
        offset: 0.45,
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.2) rotate(360deg)`,
        opacity: 0.2,
      },
    ],
    {
      duration: 720,
      easing: 'cubic-bezier(0.25, 0.9, 0.25, 1)',
      fill: 'forwards',
    },
  )

  animation.onfinish = () => {
    flyingNode.remove()

    // 6. Playful bounce on the cart button
    if (cartBtn) {
      cartBtn.classList.remove('cart-bounce-effect')
      void cartBtn.offsetWidth // Force reflow
      cartBtn.classList.add('cart-bounce-effect')
      setTimeout(() => cartBtn.classList.remove('cart-bounce-effect'), 600)
    }
  }
}


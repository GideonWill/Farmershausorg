import fs from 'node:fs'

const path = 'frontend/src/components/Storefront.tsx'
let text = fs.readFileSync(path, 'utf8')

const lines = text.split('\n')
const retIdx = lines.findIndex(l => l.includes('announcement_bar_text'))

if (retIdx !== -1) {
  // Find '<>' line before this
  let openIdx = -1
  for (let i = retIdx; i >= 0; i--) {
    if (lines[i].trim() === '<>') {
      openIdx = i
      break
    }
  }
  // Find </header> after this
  let closeIdx = -1
  for (let i = retIdx; i < lines.length; i++) {
    if (lines[i].includes('</header>')) {
      closeIdx = i
      break
    }
  }

  if (openIdx !== -1 && closeIdx !== -1) {
    lines[openIdx] = '    <div className="sticky top-0 z-50 shadow-sm">'
    // Update header class to remove sticky and border (handled by container)
    for (let i = openIdx; i < closeIdx; i++) {
      if (lines[i].includes('header data-storefront-nav')) {
        lines[i] = '      <header data-storefront-nav className="border-b border-brand-green/10 bg-white/95 backdrop-blur-md">'
        break
      }
    }
    lines[closeIdx] = '      </header>\n    </div>'
    fs.writeFileSync(path, lines.join('\n'), 'utf8')
    console.log('Successfully wrapped Header in sticky top-0 z-50 container!')
  }
}

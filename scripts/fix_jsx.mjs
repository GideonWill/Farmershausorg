import fs from 'node:fs'

const path = 'frontend/src/components/Storefront.tsx'
let text = fs.readFileSync(path, 'utf8')

// Re-wrap return with React Fragment <> ... </> so Drawer & BranchPicker remain siblings
text = text.replace(
  '<div className="sticky top-0 z-50 shadow-sm">\n      <div className="bg-brand-green px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">',
  '<>\n    <div className="sticky top-0 z-50 shadow-sm">\n      <div className="bg-brand-green px-4 py-2 text-center text-xs font-semibold tracking-wide text-white sm:text-sm">'
)

fs.writeFileSync(path, text, 'utf8')
console.log('Fixed Header JSX fragments')

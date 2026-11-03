import fs from 'node:fs'
const path = 'frontend/src/components/FarmToBasketExperience.tsx'
const content = fs.readFileSync(path, 'utf8')
const lines = content.split('\n')
lines[2] = 'const farmToBasketVideo = "/videos/farm-to-basket.mp4"'
fs.writeFileSync(path, lines.join('\n'), 'utf8')
console.log('Video line updated in FarmToBasketExperience')

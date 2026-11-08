import './app-page.css'
import { mountMagid } from './embed/mountMagid'

// The full app: Magid owns the page. Embedding pages use the embed build's mountMagid instead (src/embed/index.ts).
mountMagid(document.getElementById('root')!, { mode: 'app' })

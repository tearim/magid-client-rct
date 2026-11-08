// Entry of the embed build (npm run build:embed → dist-embed/magid-embed.js + magid-embed.css):
//   import { mountMagid } from './magid-embed.js';
//   const magid = mountMagid(document.getElementById('story'), { baseUrl: 'https://stories.example.org', story: '…' });
export { mountMagid, type MagidHandle } from './mountMagid';
export type { MagidMountOptions } from './options';

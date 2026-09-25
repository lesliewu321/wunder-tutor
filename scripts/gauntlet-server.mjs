// Separate, credential-free Vite server for browser gauntlets; never changes port 5173.
import {createServer} from 'vite';
const server=await createServer({cacheDir:'.wrangler/vite-gauntlet',envDir:'.wrangler/qa-empty-env',optimizeDeps:{entries:['index.html']},server:{hmr:false,host:'127.0.0.1',port:5176,strictPort:true,watch:{ignored:['**/.env*','**/astra-lessons/library/**']}}});
await server.listen();server.printUrls();

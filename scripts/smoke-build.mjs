import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port','8788','--inspector-port','0'],{env:{...process.env,QLOO_API_KEY:'',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},stdio:['ignore','pipe','pipe']});
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Worker startup timed out.')),45_000);
    const observe=chunk=>{if(chunk.toString().includes('Ready on')){clearTimeout(timer);resolve();}};
    child.stdout.on('data',observe); child.stderr.on('data',observe);
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Worker exited before testing (${code}).`));});
  });
  const root='http://127.0.0.1:8788';
  const page=await fetch(root);assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('TastePilot'));assert.ok(html.includes('Find my discoveries'));assert.equal(/hack_[a-f0-9]{30,}/i.test(html),false);
  const health=await fetch(`${root}/api/health`);assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
  const api=await fetch(`${root}/api/plan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorites:[{name:'Interstellar',type:'movie'}],city:'Muscat',priceLevel:3,categories:['travel']})});
  assert.equal(api.status,503);assert.equal((await api.json()).code,'not_configured');
  console.log('Built Worker smoke check passed: homepage, health endpoint, and missing-secret response.');
} finally {child.kill('SIGTERM');}

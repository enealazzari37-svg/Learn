const fs=require('fs');
const ROOT='http://localhost:8080/';
const demo=fs.readFileSync(__dirname+'/demo-en.js','utf8');
async function prepContext(c){
  await c.addInitScript(()=>{try{localStorage.setItem('studix-lang','en');localStorage.setItem('lumi-theme','light')}catch{}});
  await c.route(/\/core\.js(\?.*)?$/,async r=>{const res=await r.fetch();let t=await res.text();const a=t.indexOf('function demoData() {'),b=t.indexOf('\nlet _st;');t=t.slice(0,a)+demo+'\n'+t.slice(b);r.fulfill({response:res,body:t,headers:{...res.headers(),'content-type':'application/javascript'}})});
  await c.route(/supabase|vercel|_vercel|\/api\//,r=>r.abort());
}
module.exports={prepContext,ROOT};

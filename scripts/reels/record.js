const {chromium}=require('playwright');const fs=require('fs');const {prepContext}=require('./lib');const {execSync}=require('child_process');
const name=process.argv[2], FPS=30, out=__dirname+'/out/'+name, preview=process.argv.includes('--preview');
(async()=>{
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  const cfg=fs.readFileSync(__dirname+'/reels/'+name+'.js','utf8');
  const b=await chromium.launch();const c=await b.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1});await prepContext(c);
  await c.route(/__reel\.html$/,r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(__dirname+'/stage.html','utf8')}));
  const p=await c.newPage();p.on('console',m=>{if(/act|ERR/.test(m.text()))console.log('[page]',m.text())});p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('http://localhost:8080/__reel.html');
  await p.waitForFunction(()=>{const d=document.getElementById('app').contentDocument;return d&&d.querySelector('.nav-i')});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{const d=REEL.doc();REEL.css('.clog{visibility:hidden!important}.nav-i.prof small{font-size:0!important}.nav-i.prof small::after{content:"Student";font-size:11px}');});
  await p.addScriptTag({content:cfg});await p.waitForTimeout(1500);
  const dur=await p.evaluate(()=>REEL.dur);const taps=await p.evaluate(()=>REEL.taps.map(x=>x.t));fs.writeFileSync(`${out}-taps.json`,JSON.stringify(taps));
  const cdp=await c.newCDPSession(p);await cdp.send('Animation.enable');
  // Echtzeit-Verhältnis messen
  let t0=Date.now();for(let i=0;i<5;i++)await p.screenshot({type:'jpeg',quality:90});const wall=(Date.now()-t0)/5/1000+0.01;
  const rate=Math.min(1,(1/FPS)/wall);await cdp.send('Animation.setPlaybackRate',{playbackRate:rate});console.log('frame wall',wall.toFixed(3),'rate',rate.toFixed(2));
  const N=Math.round(dur*FPS), step=preview?6:1;
  for(let f=0;f<N;f+=step){const t=f/FPS;await p.evaluate(t=>REEL.tick(t),t);
    if(!preview){const w=Date.now();await p.screenshot({path:`${out}/${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:93});const el=(Date.now()-w)/1000;}
    else await p.screenshot({path:`${out}/${String(f/step).padStart(5,'0')}.jpg`,type:'jpeg',quality:70});
  }
  await b.close();
  if(preview){execSync(`ffmpeg -v error -y -pattern_type glob -i '${out}/*.jpg' -vf "scale=216:-1,tile=10x${Math.ceil(N/step/10)}" -frames:v 1 ${__dirname}/out/${name}-sheet.jpg`);console.log('sheet');}
  else{execSync(`python3 ${__dirname}/music.py ${dur} ${out}-taps.json ${out}.wav`);execSync(`ffmpeg -v error -y -framerate ${FPS} -i '${out}/%05d.jpg' -i ${out}.wav -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -movflags +faststart -af loudnorm=I=-14:TP=-1.5:LRA=9 -c:a aac -b:a 192k -ar 48000 -shortest ${__dirname}/out/${name}.mp4`);console.log('video done');}
})();

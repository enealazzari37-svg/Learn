(()=>{const R=REEL;R.go('focus');R.win().scrollTo(0,0);R.css('.hdock{display:none!important}');
const C=(t,f)=>({t,f}), clk=(t,el)=>{R.clicks.push(t);return C(t+.08,()=>{const e=typeof el==="string"?R.q(el):el();e&&e.click()})};
const start=()=>R.qt('button','Start'), preset=()=>R.qt('button','50/10');
const ring=()=>{const w=R.doc().createTreeWalker(R.doc().body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())if(/^\d\d:\d\d$/.test(n.textContent.trim())&&n.parentElement.closest('.page, main'))return n.parentElement.parentElement;return null;};
const chart=()=>{const h=R.qt('h2,h3,b,div','Study time in the last');return h&&h.closest('section,.card,.panel')||h&&h.parentElement.parentElement;};
const scr=(t0,t1,a,b)=>({t0,t1,f:(R,p)=>R.win().scrollTo(0,a+(b-a)*p)});
R.setup({dur:17,icon:'timer',badge:'Focus',
 hls:[{t:.2,a:"Can't focus?",b:'Lock in.'},{t:4.4,a:'One timer.',b:'Zero distractions.'},{t:8.4,a:'Every minute',b:'adds up.'},{t:12,a:'Build the habit.',b:'One session at a time.'}],
 tweens:[scr(8.2,9.6,0,400)],
 cam:[{t:0},{t:.6},{t:2.6,at:R.fsel(ring,1.45,1080,.75)},{t:7.8,at:R.fsel(ring,1.45,1080,.75)},{t:9.8,...R.focus(417,420,1.35,540,1080)},{t:11.6,...R.focus(417,420,1.35,540,1080)},{t:13}],
 cur:{hide:7.4,pts:[{t:2.4,sel:preset},{t:3.3,sel:preset,d:.9},{t:4.6,sel:start,d:.9}]},
 acts:[clk(3.4,preset),clk(4.8,start)],
 end:{at:14.2,t:'Studix <b>Focus</b>',s:'Study deeper. Stress less.'}});
})();

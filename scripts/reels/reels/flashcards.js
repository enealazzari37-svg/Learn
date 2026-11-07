(()=>{const R=REEL;R.go('cards');
const learn=()=>[...R.doc().querySelectorAll('.deckgrid button')].filter(b=>/Learn/.test(b.textContent))[0];
const deck=()=>R.q('.deckgrid').firstElementChild;
const show=()=>R.qt('button','Show answer'), rate=n=>R.q(`.rate button[data-r="${n}"]`);
const card=()=>{const f=R.q('.face.front');return f&&f.parentElement.parentElement;};
const C=(t,f)=>({t,f}), clk=(t,el)=>{R.clicks.push(t);return C(t+.08,()=>{const e=el();e&&e.click()})};
R.setup({dur:22,icon:'cards',badge:'Flashcards',
 hls:[{t:.2,a:'Exams coming up?',b:'Study smarter.'},{t:4.3,a:'Flashcards that',b:'remember for you.'},{t:8.6,a:'Flip it.',b:'Rate it.'},{t:12.6,a:'Hard ones come back.',b:'Easy ones wait.'},{t:16.4,a:'Spaced repetition,',b:'built right in.'}],
 cam:[{t:0},{t:.8},{t:3.0,at:R.fsel(deck,1.75,980)},{t:4.5,at:R.fsel(deck,1.75,980)},{t:5.7,at:R.fsel(card,1.3,1150,.8)},{t:15.6,at:R.fsel(card,1.3,1150,.8)},{t:17.2}],
 cur:{hide:15.8,pts:[{t:2.6,sel:learn},{t:3.8,sel:learn,d:1},{t:6.4,sel:show,d:1},{t:8.2,sel:()=>rate(2),d:.9},{t:9.8,sel:show,d:.8},{t:11.1,sel:()=>rate(3),d:.8},{t:13.2,sel:show,d:.8},{t:14.4,sel:()=>rate(0),d:.8}]},
 acts:[clk(4.0,learn),clk(6.7,show),clk(8.5,()=>rate(2)),clk(10.0,show),clk(11.3,()=>rate(3)),clk(13.4,show),clk(14.6,()=>rate(0)),C(15.9,()=>R.go('cards'))],
 end:{at:19.4,t:'Studix <b>Flashcards</b>',s:'Remember more. Study less.'}});
})();

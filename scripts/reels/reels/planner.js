(()=>{const R=REEL;R.go('today');R.win().scrollTo(0,0);R.css('.hdock{display:none!important}');
const C=(t,f)=>({t,f}), clk=(t,el)=>{R.taps.push({t,sel:el});return C(t+.08,()=>{const e=typeof el==="string"?R.q(el):el();e&&e.click()})};
const scr=(t0,t1,a,b)=>({t0,t1,f:(R,p)=>R.win().scrollTo(0,a+(b-a)*p)});
R.setup({dur:22,icon:'cal',badge:'Planner',
 hls:[{t:.2,a:'Your whole week.',b:'In one place.'},{t:4.2,a:'Add a task.',b:'Done in seconds.'},{t:9.4,a:'Timetable, homework',b:'and exams.'},{t:14.2,a:'Know your grades.',b:'Always.'}],
 tweens:[scr(1.2,3.6,0,760)],
 cam:[{t:0},{t:2.4},{t:4.0,at:R.fsel('.w-tasks',1.55,1130,.55)},{t:9.0,at:R.fsel('.w-tasks',1.55,1130,.55)},{t:9.4},{t:10.2},{t:12.4,...R.focus(417,250,1.45,540,1080)},{t:14.0},{t:14.6},{t:16.2,at:R.fsel('.glist',1.35,1150,.35)},{t:19}],
 acts:[clk(5.0,'#todo-i'),...R.typeActs(5.3,'#todo-i','Read chapter 5 for history',13),C(7.6,R=>{const f=R.q('#todo-f');f&&f.requestSubmit();R.q('#todo-i').blur();}),C(9.3,R=>{R.win().scrollTo(0,0);R.go('planner')}),C(14.1,R=>{R.win().scrollTo(0,0);R.go('grades')})],
 end:{at:19.2,t:'Studix <b>Planner</b>',s:'Your week, sorted.'}});
})();

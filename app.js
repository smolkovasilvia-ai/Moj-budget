(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const store = {
    get(k, d){ try { const v=localStorage.getItem('mns_'+k); return v===null?d:JSON.parse(v); } catch { return d; } },
    set(k,v){ localStorage.setItem('mns_'+k, JSON.stringify(v)); },
    removeAll(){ Object.keys(localStorage).filter(k=>k.startsWith('mns_')).forEach(k=>localStorage.removeItem(k)); }
  };
  const state = {
    age: store.get('age',4), location:'home', time:'any', parentEnergy:'any', solo:false, noPrep:false, noMess:false, noPrint:false,
    categories:new Set(), favorites:new Set(store.get('favorites',[])), history:store.get('history',[]), current:null,
    sound:store.get('sound',false), motion:store.get('motion',true), deferredPrompt:null
  };
  const catLabels={movement:'POHYBOVÁ HRA',creative:'TVORIVÁ HRA',brain:'HLAVIČKOVÁ HRA',pretend:'HRA NA FANTÁZIU',calm:'POKOJNÁ HRA',sensory:'ZMYSLOVÁ HRA'};
  const catColors={movement:['#c9ebd6','#8ac9a3'],creative:['#ffd772','#ffad91'],brain:['#cbe7f5','#a9c9ef'],pretend:['#e1d7fa','#c2aff0'],calm:['#dceee8','#b7d9ca'],sensory:['#ffe1c7','#f7b98b']};

  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1800)}
  function beep(){ if(!state.sound) return; try{const c=new (window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();o.frequency.value=540;g.gain.setValueAtTime(.05,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);}catch{} }
  function saveBasics(){store.set('age',state.age);store.set('favorites',[...state.favorites]);store.set('history',state.history.slice(-30));store.set('sound',state.sound);store.set('motion',state.motion)}
  function updateFavCount(){ $('#favCount').textContent=state.favorites.size; }
  function fits(a){
    if(state.age<a.ageMin||state.age>a.ageMax) return false;
    if(!a.locations.includes(state.location)) return false;
    if(state.time!=='any' && a.time>Number(state.time)) return false;
    if(state.parentEnergy!=='any' && a.parentEnergy!==state.parentEnergy && !(state.parentEnergy==='high')) return false;
    if(state.solo && !a.solo) return false;
    if(state.noPrep && !a.noPrep) return false;
    if(state.noMess && !a.noMess) return false;
    if(state.noPrint && !a.noPrint) return false;
    if(state.categories.size && !state.categories.has(a.category)) return false;
    return true;
  }
  function candidates(){return window.ACTIVITIES.filter(fits)}
  function weightedPick(list){
    const recent=new Set(state.history.slice(-8));
    let pool=list.filter(a=>!recent.has(a.id)); if(!pool.length) pool=list;
    if(!pool.length) return null;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function suggest(){
    let list=candidates();
    if(!list.length){
      const saved={time:state.time,parentEnergy:state.parentEnergy,solo:state.solo,noPrep:state.noPrep,noMess:state.noMess,noPrint:state.noPrint,categories:new Set(state.categories)};
      state.time='any'; state.parentEnergy='any'; state.solo=false; state.noPrep=false; state.noMess=false; state.noPrint=false; state.categories.clear();
      list=candidates();
      Object.assign(state,{time:saved.time,parentEnergy:saved.parentEnergy,solo:saved.solo,noPrep:saved.noPrep,noMess:saved.noMess,noPrint:saved.noPrint,categories:saved.categories});
      toast('Taká kombinácia bola príliš úzka — vybral som najbližší dobrý nápad.');
    }
    const a=weightedPick(list); if(a) showActivity(a);
  }
  function showView(name){
    ['homeView','activityView','favoritesView','settingsView'].forEach(id=>$('#'+id).hidden=true);
    $('#'+name+'View').hidden=false;
    $$('.nav-item').forEach(x=>x.classList.remove('active'));
    const map={home:'home',favorites:'favorites',settings:'settings'}; if(map[name]) $(`[data-nav="${map[name]}"]`)?.classList.add('active');
    window.scrollTo({top:0,behavior:state.motion?'smooth':'auto'});
  }
  function showActivity(a){
    state.current=a; state.history.push(a.id); saveBasics();
    const [c1,c2]=catColors[a.category]||catColors.creative;
    $('#activityVisual').style.background=`linear-gradient(135deg,${c1},${c2})`;
    $('#activityEmoji').textContent=a.emoji; $('#activityKicker').textContent=catLabels[a.category]||'AKTIVITA';
    $('#activityTitle').textContent=a.title; $('#activityIntro').textContent=a.intro;
    $('#activityMeta').innerHTML=[`${a.ageMin}–${a.ageMax} r.`,`⏱ ${a.time} min`,a.solo?'🧸 zvládne aj samo':'🤝 spolu',a.noPrep?'⚡ bez prípravy':'🧺 malá príprava',a.noMess?'✨ bez neporiadku':'🎨 môže byť tvorivo'].map(x=>`<span class="meta-chip">${x}</span>`).join('');
    $('#activitySteps').innerHTML=a.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('');
    $('#activityMaterials').textContent=a.materials; $('#materialsBox').hidden=a.materials==='nič';
    $('#activityTip').textContent=a.tip; $('#activitySafety').textContent=a.safety; $('#safetyBox').hidden=!a.safety;
    const fav=state.favorites.has(a.id); $('#favActivity').textContent=fav?'♥':'♡'; $('#favActivity').classList.toggle('active',fav);
    $('#favActivity').setAttribute('aria-label',fav?'Odstrániť z obľúbených':'Pridať do obľúbených');
    showView('activity'); beep();
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
  function toggleFav(){ if(!state.current)return; const id=state.current.id; if(state.favorites.has(id)){state.favorites.delete(id);toast('Odstránené z obľúbených');}else{state.favorites.add(id);toast('Uložené do obľúbených ♥');} saveBasics();updateFavCount();showActivityNoNav(state.current); }
  function showActivityNoNav(a){const fav=state.favorites.has(a.id);$('#favActivity').textContent=fav?'♥':'♡';$('#favActivity').classList.toggle('active',fav)}
  function renderFavorites(){
    const list=window.ACTIVITIES.filter(a=>state.favorites.has(a.id));
    $('#favoritesList').innerHTML=list.length?list.map(a=>`<button class="list-card" data-id="${a.id}"><span class="emoji">${a.emoji}</span><span><b>${escapeHtml(a.title)}</b><small>${a.ageMin}–${a.ageMax} r. · ${a.time} min · ${catLabels[a.category].toLowerCase()}</small></span></button>`).join(''):`<div class="empty-state"><span>♡</span><b>Zatiaľ nič uložené</b><p>Pri dobrej aktivite ťukni na srdiečko a nájdeš ju tu.</p></div>`;
    $$('#favoritesList .list-card').forEach(b=>b.onclick=()=>showActivity(window.ACTIVITIES.find(a=>a.id===b.dataset.id)));
  }
  function updateChallenges(){
    const pool=window.ACTIVITIES.filter(a=>state.age>=a.ageMin&&state.age<=a.ageMax&&a.locations.includes('home'));
    const chosen=[]; const cats=new Set();
    for(const a of pool.sort(()=>Math.random()-.5)){if(chosen.length===3)break;if(!cats.has(a.category)){chosen.push(a);cats.add(a.category)}}
    $('#challengeGrid').innerHTML=chosen.map(a=>`<button class="challenge" data-id="${a.id}"><span>${a.emoji}</span><b>${escapeHtml(a.title)}</b><small>${a.time} min · ${catLabels[a.category].toLowerCase()}</small></button>`).join('');
    $$('#challengeGrid .challenge').forEach(b=>b.onclick=()=>showActivity(window.ACTIVITIES.find(a=>a.id===b.dataset.id)));
  }
  function setPreset(p){
    resetFilters(false);
    if(p==='quiet'){state.location='home';state.time='20';state.parentEnergy='low';state.solo=true;state.noPrep=true;state.categories=new Set(['calm','brain','creative']);}
    if(p==='energy'){state.location='home';state.time='20';state.parentEnergy='medium';state.noPrep=true;state.categories=new Set(['movement']);}
    if(p==='rain'){state.location='home';state.time='40';state.parentEnergy='any';state.categories=new Set(['creative','pretend','brain','movement']);}
    if(p==='travel'){state.location='travel';state.time='any';state.parentEnergy='low';state.noPrep=true;state.noMess=true;}
    syncControls();suggest();
  }
  function resetFilters(sync=true){state.time='any';state.parentEnergy='any';state.solo=false;state.noPrep=false;state.noMess=false;state.noPrint=false;state.categories.clear();if(sync)syncControls()}
  function syncControls(){
    $('#ageSelect').value=state.age; $('#settingsAge').value=state.age;
    $$('.pill').forEach(b=>b.classList.toggle('active',b.dataset.location===state.location));
    $$('#timeFilter button').forEach(b=>b.classList.toggle('active',b.dataset.value===state.time));
    $$('#parentEnergyFilter button').forEach(b=>b.classList.toggle('active',b.dataset.value===state.parentEnergy));
    $('#soloFilter').checked=state.solo;$('#noPrepFilter').checked=state.noPrep;$('#noMessFilter').checked=state.noMess;$('#noPrintFilter').checked=state.noPrint;
    $$('#categoryFilter button').forEach(b=>b.classList.toggle('active',state.categories.has(b.dataset.value)));
    $('#soundSetting').checked=state.sound;$('#motionSetting').checked=state.motion;document.body.classList.toggle('no-motion',!state.motion);
  }
  function done(){
    const today=new Date().toISOString().slice(0,10); const d=store.get('done',{}); d[today]=(d[today]||0)+1; store.set('done',d);
    const n=d[today]; $('#streakText').textContent=n===1?'Dnešná prvá hotová aktivita 🌟':`Dnes hotovo: ${n} aktivity`; toast('Super. Hotovo sa ráta! 🌟');beep();
  }
  function bind(){
    $('#surpriseBtn').onclick=suggest; $('#anotherBtn').onclick=suggest; $('#favActivity').onclick=toggleFav; $('#doneBtn').onclick=done;
    $('#backHome').onclick=()=>showView('home'); $('#brandBtn').onclick=()=>showView('home'); $('#favoritesBtn').onclick=()=>{renderFavorites();showView('favorites')}; $('#settingsBtn').onclick=()=>showView('settings');
    $$('[data-back]').forEach(b=>b.onclick=()=>showView('home'));
    $$('.pill').forEach(b=>b.onclick=()=>{state.location=b.dataset.location;syncControls()});
    $('#ageSelect').onchange=e=>{state.age=Number(e.target.value);saveBasics();syncControls();updateChallenges()};
    $('#ageMinus').onclick=()=>{state.age=Math.max(2,state.age-1);saveBasics();syncControls();updateChallenges()}; $('#agePlus').onclick=()=>{state.age=Math.min(8,state.age+1);saveBasics();syncControls();updateChallenges()};
    $('#filtersToggle').onclick=()=>{const p=$('#filtersPanel'),open=p.hidden;p.hidden=!open;$('#filtersToggle').setAttribute('aria-expanded',open)};
    $$('#timeFilter button').forEach(b=>b.onclick=()=>{state.time=b.dataset.value;syncControls()});
    $$('#parentEnergyFilter button').forEach(b=>b.onclick=()=>{state.parentEnergy=b.dataset.value;syncControls()});
    ['solo','noPrep','noMess','noPrint'].forEach(k=>$('#'+k+'Filter').onchange=e=>{state[k]=e.target.checked});
    $$('#categoryFilter button').forEach(b=>b.onclick=()=>{const v=b.dataset.value;state.categories.has(v)?state.categories.delete(v):state.categories.add(v);syncControls()});
    $('#resetFilters').onclick=()=>resetFilters();
    $$('.shortcut').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset)); $('#refreshChallenges').onclick=updateChallenges;
    $$('.nav-item').forEach(b=>b.onclick=()=>{const n=b.dataset.nav;if(n==='home')showView('home');if(n==='favorites'){renderFavorites();showView('favorites')}if(n==='settings')showView('settings');if(n==='random')suggest()});
    $('#settingsAge').onchange=e=>{state.age=Number(e.target.value);saveBasics();syncControls();updateChallenges()};
    $('#soundSetting').onchange=e=>{state.sound=e.target.checked;saveBasics()}; $('#motionSetting').onchange=e=>{state.motion=e.target.checked;saveBasics();syncControls()};
    $('#clearDataBtn').onclick=()=>{if(confirm('Naozaj vymazať obľúbené, históriu a nastavenia z tohto zariadenia?')){store.removeAll();location.reload()}};
    $('#installBtn').onclick=installApp; $('#installDialog [data-close-dialog]').onclick=()=>$('#installDialog').close();
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e});
  }
  async function installApp(){
    if(state.deferredPrompt){state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;return;}
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent); $('#installInstructions').innerHTML=ios?'<ol><li>Otvor túto stránku v Safari.</li><li>Ťukni na tlačidlo <b>Zdieľať</b>.</li><li>Vyber <b>Pridať na plochu</b>.</li><li>Potvrď názov a pridanie.</li></ol>':'<p>V menu prehliadača vyber možnosť <b>Nainštalovať aplikáciu</b> alebo <b>Pridať na plochu</b>. Ak ju prehliadač neponúka, appku môžeš ďalej používať priamo cez tento web.</p>';
    $('#installDialog').showModal();
  }
  function init(){
    bind(); syncControls(); updateFavCount(); updateChallenges();
    const today=new Date().toISOString().slice(0,10),d=store.get('done',{});if(d[today])$('#streakText').textContent=`Dnes hotovo: ${d[today]} aktivity`;
    if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  init();
})();

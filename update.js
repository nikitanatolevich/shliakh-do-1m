(() => {
  'use strict';
  const current=document.querySelector('meta[name="app-version"]').content;
  const notice=document.getElementById('updateNotice');
  let registration,pending=false,checking=false,reloading=false,activated=false;
  const dirtyForms=new Set();
  const initialController=navigator.serviceWorker?.controller;
  const safe=()=>!document.hidden&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select')&&!dirtyForms.size&&!window.financeCloudBusy?.();
  function restorePoint(){
    window.financeApp?.checkpoint();
    sessionStorage.setItem('shliakh:update-view',JSON.stringify({month:document.getElementById('planningMonth')?.value||document.getElementById('planningContent')?.dataset.month,tab:document.getElementById('planningTab')?.value||document.getElementById('planningContent')?.dataset.tab,scroll:window.scrollY}));
  }
  function apply(){
    if(!pending||reloading)return;
    if(!safe()){notice.hidden=false;notice.textContent='Оновлення готове — буде застосовано після завершення редагування.';return;}
    try{restorePoint();}catch{notice.hidden=false;notice.textContent='Не вдалося зберегти чернетку. Оновлення відкладено; створіть JSON-копію.';return;}
    notice.hidden=false;notice.textContent='Оновлюю застосунок…';
    if(registration?.waiting){registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});return;}
    if(activated||!('serviceWorker' in navigator)){reloading=true;location.reload();}
  }
  async function check(){
    if(checking||!navigator.onLine)return;
    checking=true;
    try{
      const response=await fetch('./version.txt?check='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!response.ok)return;
      const latest=(await response.text()).trim();
      if(!/^\d+$/.test(latest)||Number(latest)<=Number(current))return;
      pending=true;notice.hidden=false;notice.textContent='Завантажую оновлення…';
      if(registration){await registration.update();if(registration.waiting)apply();}
      else if(!('serviceWorker' in navigator))apply();
    }catch{/* Offline or transient error: keep the working local version. */}
    finally{checking=false;}
  }
  document.addEventListener('input',e=>{const form=e.target.closest('#monthlyPlanForm,#forecastForm');if(form)dirtyForms.add(form.id);});
  document.addEventListener('submit',e=>{dirtyForms.delete(e.target.id);setTimeout(apply,0);});
  document.addEventListener('focusout',()=>setTimeout(apply,100));
  document.addEventListener('click',()=>setTimeout(apply,100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();apply();}});
  window.addEventListener('online',check);
  window.addEventListener('pagehide',()=>{try{restorePoint();}catch{}});
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(initialController||pending){activated=true;pending=true;apply();}
    });
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
      registration=reg;
      if(reg.waiting){pending=true;apply();}
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){pending=true;apply();}});
      });
      check();
    }).catch(()=>{notice.hidden=false;notice.textContent='Офлайн-оновлення недоступні в цьому браузері.';});
  }else check();
  setInterval(()=>{if(!document.hidden){check();apply();}},60000);
  const url=new URL(location.href);if(url.searchParams.has('v')){url.searchParams.delete('v');history.replaceState(null,'',url.pathname+url.search+url.hash);}
})();

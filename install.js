(() => {
  let promptEvent;
  const button=document.getElementById('installApp');
  const help=document.getElementById('installHelp');
  const state=document.getElementById('installState');
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  function showState(){
    if(standalone()){state.textContent='Відкрито з головного екрана. Вхід зберігається на цьому пристрої.';button.hidden=true;help.hidden=true;}
    else {state.textContent='Додай іконку на головний екран, щоб відкривати застосунок окремо від браузера.';button.hidden=false;}
  }
  function instructions(){
    help.hidden=false;
    const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    help.textContent=ios?'iPhone / Chrome: натисни «Поділитися» праворуч від адреси → «На початковий екран» → «Додати». Якщо є перемикач «Відкривати як вебпрограму», увімкни його. Потім запускай застосунок з нової іконки.':'У меню браузера вибери «Встановити застосунок» або «Додати на головний екран». Якщо такого пункту немає, відкрий сайт у Chrome або Safari.';
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;button.textContent='Встановити застосунок';});
  window.addEventListener('appinstalled',()=>{promptEvent=null;state.textContent='Іконку додано. Відкрий застосунок з головного екрана.';button.hidden=true;});
  button.onclick=async()=>{if(promptEvent){const event=promptEvent;promptEvent=null;await event.prompt();await event.userChoice;}else instructions();};
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',showState);
  showState();
})();

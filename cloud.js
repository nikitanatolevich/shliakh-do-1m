/* Public browser key only. Access is enforced by database ownership policies. */
(() => {
  'use strict';
  const URL = 'https://dbscdgngumungwrjbbqo.supabase.co';
  const KEY = 'sb_publishable_svjnmv3XcvgNkMBdDNcWng_P8w8LTCO';
  const SESSION = 'shliakh:cloud-session';
  const clean = value => { const data=JSON.parse(JSON.stringify(value)); window.cleanupTestData?.(data); delete data.planningDrafts; delete data.meta; return data; };
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const fingerprint = value => JSON.stringify(canonical(clean(value)));
  function merge(base,local,remote,path='',conflicts=[]){
    if(equal(local,remote))return {value:local,conflicts};
    if(equal(local,base))return {value:remote,conflicts};
    if(equal(remote,base))return {value:local,conflicts};
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    if(object(local)&&object(remote)&&(base===undefined||object(base))){
      const value={};for(const key of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){const result=merge(base?.[key],local[key],remote[key],path+'/'+key,conflicts);if(result.value!==undefined)value[key]=result.value;}
      return {value,conflicts};
    }
    if(Array.isArray(local)&&Array.isArray(remote)&&(base===undefined||Array.isArray(base))&&[...(base||[]),...local,...remote].every(v=>object(v)&&typeof v.id==='string')){
      const map=arr=>Object.fromEntries((arr||[]).map(v=>[v.id,v]));const result=merge(map(base),map(local),map(remote),path,conflicts);
      return {value:Object.values(result.value),conflicts};
    }
    conflicts.push(path);return {value:local,conflicts};
  }
  window.financeCloudData = {clean,fingerprint,merge};
  let session, user, base, choice=false, busy=false, stopped=false, timer, refreshPromise;
  window.financeCloudBusy=()=>busy||!!refreshPromise;
  try { session=JSON.parse(localStorage.getItem(SESSION)); } catch { session=null; }
  const panel=document.getElementById('cloudPanel');
  const status=document.getElementById('cloudStatus');
  const message=document.getElementById('cloudMessage');
  const login=document.getElementById('cloudLogin');
  const controls=document.getElementById('cloudControls');
  const decisions=document.getElementById('cloudDecisions');
  const say=text=>{status.textContent=text;message.textContent=text;};
  const metaKey=()=>`shliakh:cloud-base:${user.id}`;
  const remember=(revision,hash)=>{base={revision,hash};localStorage.setItem(metaKey(),JSON.stringify(base));};
  const backup=()=>{
    const stamp=new Date().toISOString();
    localStorage.setItem('shliakh:before-cloud-backup',JSON.stringify({at:stamp,data:window.financeApp.read()}));
  };
  const persistSession=data=>{session={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+data.expires_in};localStorage.setItem(SESSION,JSON.stringify(session));};
  async function api(path,{method='GET',body,auth=true}={}) {
    if(auth) await ensureSession();
    const headers={apikey:KEY};if(auth)headers.Authorization=`Bearer ${session.access_token}`;
    if(body)headers['Content-Type']='application/json';
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    let response,data;
    try{response=await fetch(URL+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});data=await response.json().catch(()=>null);}
    catch(error){if(error.name==='AbortError')throw new Error('Сервер не відповів за 15 секунд. Перевір інтернет і повтори.');throw error;}
    finally{clearTimeout(timeout);}
    if(!response.ok){const error=new Error(data?.message||data?.msg||data?.error_description||'Помилка з’єднання');error.code=data?.error_code||data?.code;error.status=response.status;throw error;}
    return data;
  }
  async function ensureSession() {
    if(!session)throw new Error('Потрібно увійти');
    const refresh=async()=>{
      try{const latest=JSON.parse(localStorage.getItem(SESSION));if(latest?.refresh_token)session=latest;}catch{}
      if(session.expires_at>Date.now()/1000+60)return;
      const data=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});persistSession(data);
    };
    if(!refreshPromise)refreshPromise=(navigator.locks?.request?navigator.locks.request('shliakh:session-refresh',refresh):refresh()).finally(()=>{refreshPromise=null;});
    await refreshPromise;
  }
  async function remote(){const rows=await api('/rest/v1/finance_snapshots?select=payload,revision,updated_at');return rows[0]||null;}
  function decision(text,exists){choice=true;decisions.hidden=false;document.getElementById('cloudDownload').hidden=!exists;say(text);}
  function validate(data){if(data?.version!==1||!Array.isArray(data.assets)||!Array.isArray(data.debts)||!Array.isArray(data.transactions))throw new Error('Невідома структура хмарної копії');}
  const conflictingDraftKeys=row=>{const local=window.financeApp.read();return Object.keys(local.planningDrafts||{}).filter(key=>!equal(local.planning?.[key],row.payload.planning?.[key]));};
  function receive(row,discardDraftKeys=[]){validate(row.payload);backup();window.financeApp.apply(row.payload,{discardDraftKeys});remember(row.revision,fingerprint(row.payload));say('Синхронізовано • '+new Date(row.updated_at).toLocaleTimeString('uk-UA'));}
  async function write(expected) {
    const payload=clean(window.financeApp.read());
    const rows=await api('/rest/v1/rpc/save_finance_snapshot',{method:'POST',body:{p_payload:payload,p_expected_revision:expected}});
    remember(rows[0].revision,fingerprint(payload));say('Синхронізовано • '+new Date().toLocaleTimeString('uk-UA'));
  }
  async function connect() {
    user=await api('/auth/v1/user');
    login.hidden=true;document.getElementById('cloudLinkLogin').hidden=true;controls.hidden=false;document.getElementById('cloudAccount').textContent=user.email;
    try{base=JSON.parse(localStorage.getItem(metaKey()));}catch{base=null;}
    if(base?.hash){try{base.hash=fingerprint(JSON.parse(base.hash));}catch{base=null;}}
    const row=await remote();
    if(!base){decision(row?'Знайдено хмарну копію. Обери, які дані використати для першого підключення.':'Хмара порожня. Почни з пристрою, де вже є твої дані.',!!row);return;}
    stopped=false;await sync();
  }
  async function sync() {
    if(!user){say('Увійди в акаунт для синхронізації');return;}
    if(choice){say('Спершу обери: дані цього пристрою чи хмарна копія.');return;}
    if(stopped){say('Потрібно вийти та увійти знову');return;}
    if(busy){say('Запит уже виконується • зачекай до 15 секунд');return;}
    busy=true;
    say('Перевіряю хмару…');
    try {
      if(!navigator.onLine){say('Немає інтернету • зміни збережені на пристрої');return;}
      const row=await remote();const hash=fingerprint(window.financeApp.read());
      if(!row){decision('Хмарної копії немає. Обери дані цього пристрою для початку.',false);return;}
      if(row.revision!==base?.revision){
        if(conflictingDraftKeys(row).length){decision('Хмарний план має зміни в тих самих розділах, де є локальні чернетки. Вибери копію; чернетки буде зарезервовано.',true);return;}
        if(hash!==base?.hash){
          let original;try{original=JSON.parse(base.hash);}catch{decision('Потрібно вибрати початкову копію даних.',true);return;}
          const result=merge(original,clean(window.financeApp.read()),row.payload);
          if(result.conflicts.length){decision('Є суперечливі зміни в тих самих даних. Вибери копію; локальну буде зарезервовано.',true);return;}
          backup();window.financeApp.apply(result.value);await write(row.revision);return;
        }
        if(document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select')){say('Є оновлення з іншого пристрою • заверш редагування');return;}
        receive(row);
      } else if(hash!==base?.hash){say('Синхронізація…');await write(row.revision);}
      else say('Синхронізовано');
    } catch(error) {
      if(error.code==='P0001')decision('Дані змінилися на іншому пристрої. Вибери копію для продовження.',true);
      else if(error.status===401||error.status===403){stopped=true;say('Сесію завершено або немає доступу. Вийди та увійди знову.');}
      else say('Не синхронізовано • локальні дані збережені. '+error.message);
    } finally {busy=false;}
  }
  document.getElementById('cloudSend').onclick=async()=>{
    const email=document.getElementById('cloudEmail');if(!email.reportValidity())return;
    const button=document.getElementById('cloudSend');button.disabled=true;
    try{await api('/auth/v1/otp?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',auth:false,body:{email:email.value.trim(),create_user:true}});say(navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches?'Новий лист надіслано. Скопіюй посилання з найновішого листа, не відкриваючи його, та встав нижче у «Увійти в установленій іконці на iPhone».':'Лист надіслано. Відкрий посилання з найновішого листа на цьому пристрої.');}
    catch(error){say('Не вдалося надіслати лист: '+error.message);}
    finally{button.disabled=false;}
  };
  document.getElementById('cloudVerify').onclick=async()=>{
    const email=document.getElementById('cloudEmail'),token=document.getElementById('cloudCode');if(!email.reportValidity()||!token.reportValidity())return;
    try{const data=await api('/auth/v1/verify',{method:'POST',auth:false,body:{email:email.value.trim(),token:token.value.trim(),type:'email'}});persistSession(data);token.value='';await connect();}
    catch(error){say('Не вдалося увійти: '+error.message);}
  };
  document.getElementById('cloudVerifyLink').onclick=async()=>{
    const field=document.getElementById('cloudLoginLink');
    const button=document.getElementById('cloudVerifyLink');if(button.disabled)return;button.disabled=true;
    try{
      const link=new window.URL(field.value.trim());
      if(link.origin!==URL||link.pathname!=='/auth/v1/verify')throw new Error('Потрібне оригінальне посилання входу з листа Supabase');
      const hash=link.searchParams.get('token')||link.searchParams.get('token_hash');
      if(!hash||hash.length<20||hash.length>500)throw new Error('Посилання не містить одноразового токена');
      const data=await api('/auth/v1/verify',{method:'POST',auth:false,body:{token_hash:hash,type:'email'}});
      field.value='';persistSession(data);await connect();
    }catch(error){field.value='';say(error.code==='otp_expired'?'Посилання вже використане або втратило чинність. Натисни «Отримати лист для входу» та скопіюй посилання з найновішого листа, не відкриваючи його. Старе посилання повторно не працює.':'Не вдалося увійти: '+(error instanceof TypeError?'Перевір інтернет і встав повне посилання з листа.':error.message));}
    finally{button.disabled=false;}
  };
  document.getElementById('cloudUpload').onclick=async()=>{
    if(busy)return;busy=true;
    try{
      const row=await remote();
      if(row&&!confirm('Замінити хмарну копію даними цього пристрою? Збережіть JSON-копію обох версій перед заміною.'))return;
      backup();if(row)localStorage.setItem('shliakh:remote-conflict-backup',JSON.stringify(row.payload));
      await write(row?.revision||0);choice=false;stopped=false;decisions.hidden=true;
    }catch(error){say('Не збережено в хмару: '+error.message);}finally{busy=false;}
  };
  document.getElementById('cloudDownload').onclick=async()=>{
    if(busy)return;busy=true;
    try{const row=await remote();if(!row)throw new Error('Хмарна копія відсутня');if(!confirm('Використати хмарні дані? Поточні дані та конфліктні чернетки будуть зарезервовані; неконфліктні чернетки залишаться.'))return;receive(row,conflictingDraftKeys(row));choice=false;stopped=false;decisions.hidden=true;}
    catch(error){say('Не завантажено: '+error.message);}finally{busy=false;}
  };
  document.getElementById('cloudSync').onclick=()=>sync();
  document.getElementById('cloudLogout').onclick=async()=>{
    stopped=true;clearTimeout(timer);
    try{if(session)await api('/auth/v1/logout?scope=local',{method:'POST'});}catch{}
    session=null;user=null;base=null;choice=false;localStorage.removeItem(SESSION);
    controls.hidden=true;decisions.hidden=true;login.hidden=false;document.getElementById('cloudLinkLogin').hidden=false;say('Вихід виконано • дані залишились на цьому пристрої');
  };
  document.getElementById('cloudBackup').onclick=()=>{
    const raw=localStorage.getItem('shliakh:before-cloud-backup');if(!raw){say('Резервну копію ще не створено');return;}
    const data=JSON.parse(raw);const a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob([JSON.stringify(data.data,null,2)],{type:'application/json'}));a.download='shliakh-before-cloud.json';a.click();setTimeout(()=>window.URL.revokeObjectURL(a.href),1000);
  };
  window.addEventListener('finance-change',()=>{if(user&&!choice){say('Є локальні зміни • очікують синхронізації');clearTimeout(timer);timer=setTimeout(sync,900);}});
  window.addEventListener('online',()=>sync());
  setInterval(()=>{if(!document.hidden)sync();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  (async()=>{
    try{
      const hash=new URLSearchParams((window.financeAuthHash||location.hash).slice(1));delete window.financeAuthHash;
      if(hash.has('access_token')){persistSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in')||3600)});history.replaceState(null,'',location.pathname+'#data');}
      if(session)await connect();else say('Лише на пристрої • увійди для синхронізації');
    }catch(error){say('Не вдалося підключитися: '+error.message);}
  })();
})();

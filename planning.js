/* Локальний помісячний план. Дані є частиною загальної JSON-копії. */
window.planningCategories = ['Дім','Авто','Підписки','Їжа','Подарунки','Заощадження','Відпустка','На всяк випадок'];
window.prepareSavingsPlan = function(plan) {
  let row = plan.rows.find(r => r.percentSavings);
  if (!row && Number(plan.reserve) > 0) {
    row = plan.rows.find(r => String(r.category).trim().toLowerCase() === 'заощадження');
    if (!row) { row = {name:'Заощадження',category:'Заощадження',planned:0,actual:0,payer:'',note:''}; plan.rows.push(row); }
    row.percentSavings = true;
  }
  if (row) {
    row.category = 'Заощадження';
    row.planned = Math.round(Math.max(0, Number(plan.income)||0) * Math.min(100,Math.max(0,Number(plan.reserve)||0))) / 100;
  }
  return plan;
};
window.planningTotals = function(plan) {
  window.prepareSavingsPlan(plan);
  const planned = plan.rows.reduce((s,r)=>s+(Number(r.planned)||0),0);
  const actual = plan.rows.reduce((s,r)=>s+(Number(r.actual)||0),0);
  return {planned,actual,remainingPlan:plan.income-planned,remainingActual:plan.income-actual};
};
window.planningAssetRoutes = [
  {category:'Заощадження',id:'planning-savings',name:'Подушка безпеки з планування',bucket:'emergency'},
  {category:'На всяк випадок',id:'planning-contingency',name:'На всяк випадок з планування',bucket:'planned'},
  {category:'Відпустка',id:'planning-vacation',name:'Відпустка з планування',bucket:'planned'}
];
window.syncPlanningSavings = function(state) {
  const before = JSON.stringify(state.planning || {});
  Object.values(state.planning || {}).forEach(window.prepareSavingsPlan);
  let changed = before !== JSON.stringify(state.planning || {});
  window.planningAssetRoutes.forEach(route => {
    let amount = 0;
    Object.values(state.planning || {}).forEach(plan => (plan.rows || []).forEach(row => {
      if (String(row.category).trim().toLowerCase() === route.category.toLowerCase()) amount += Math.max(0, Number(row.actual) || 0);
    }));
    amount = Math.round(amount * 100) / 100;
    const asset = state.assets.find(a => a.id === route.id);
    if (amount === 0) { if (asset) {state.assets = state.assets.filter(a => a.id !== route.id);changed=true;} return; }
    if (asset && asset.amount === amount && asset.bucket === route.bucket && asset.name === route.name) return;
    const next = {id:route.id, name:route.name, amount, bucket:route.bucket, verified:false, source:'planning'};
    if (asset) Object.assign(asset,next); else state.assets.push(next);
    changed = true;
  });
  return changed;
};
window.cleanupTestDrafts = function(state) {
  let removed=0;
  for(const key of ['2099-11:ЗП','2099-12:ЗП']){
    const plan=state.planningDrafts?.[key];if(!plan)continue;
    const known=/^(Тест з телефона|Тест з ноутбука|Чернетка телефону|Чернетка ноутбука(?: — збереження після оновлення)?|Нова стаття)$/;
    if(Number(plan.income||0)===0&&Number(plan.reserve||0)===0&&Array.isArray(plan.rows)&&plan.rows.every(r=>known.test(String(r.name).trim())&&Number(r.planned||0)===0&&Number(r.actual||0)===0&&!r.note&&!r.payer)){
      delete state.planningDrafts[key];removed++;
    }
  }
  return removed;
};
window.capturePlanningDraft = function(state, host=document.getElementById('planningContent')) {
  if(!host)return;
  const month=host.querySelector('#planningMonth')?.value,tab=host.querySelector('#planningTab')?.value;
  if(!month||!tab)return;
  const key=`${month}:${tab}`;
  const original=state.planningDrafts?.[key]||state.planning?.[key]||{income:0,reserve:0,rows:[]};
  const draft=JSON.parse(JSON.stringify(original));
  host.querySelectorAll('[data-plan],[data-row][data-field]').forEach(input=>{
    if(input.disabled)return;
    const initial=input.tagName==='SELECT' ? ([...input.options].find(option=>option.defaultSelected)||input.options[0])?.value : input.defaultValue;
    if(input.value===initial)return;
    const field=input.dataset.field;
    if(input.dataset.plan){const value=Number(input.value);if(Number.isFinite(value)&&value>=0)draft[input.dataset.plan]=value;}
    else if(draft.rows[Number(input.dataset.row)]){
      if(['planned','actual'].includes(field)){const value=Number(input.value);if(Number.isFinite(value)&&value>=0)draft.rows[Number(input.dataset.row)][field]=value;}
      else draft.rows[Number(input.dataset.row)][field]=input.value.trim();
    }
  });
  if(JSON.stringify(draft)!==JSON.stringify(original)){state.planningDrafts||={};state.planningDrafts[key]=draft;}
};
window.cancelPlanningChanges = function(state, key) {
  if (state.planningDrafts) delete state.planningDrafts[key];
};
window.savePlanning = function(state, key, draft) {
  const plan = JSON.parse(JSON.stringify(draft));
  window.prepareSavingsPlan(plan);
  const month = key.slice(0,7);
  const day = new Date().toLocaleDateString('sv-SE');
  state.planning ||= {}; state.transactions ||= [];
  state.planning[key] = plan;
  state.transactions = state.transactions.filter(t => t.planningKey !== key);
  plan.rows.forEach((row,index) => {
    const amount = Math.round(Math.max(0,Number(row.actual)||0)*100)/100;
    const route = window.planningAssetRoutes.find(r => r.category.toLowerCase() === String(row.category).trim().toLowerCase());
    if (amount > 0 && !route) state.transactions.push({id:`planning:${key}:${index}`,planningKey:key,source:'planning',date:day.startsWith(month)?day:`${month}-01`,type:'expense',category:row.category,bucket:'current',amount,note:`${row.name || ''}${row.note ? ': '+row.note : ''}`});
  });
  if (state.planningDrafts) delete state.planningDrafts[key];
  window.syncPlanningSavings(state);
};
window.renderPlanning = function(state, persist) {
  const host = document.getElementById('planningContent');
  if (!host) return;
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:0}).format(v || 0);
  const month = host.dataset.month || new Date().toLocaleDateString('sv-SE').slice(0,7);
  const tab = host.dataset.tab || 'ЗП';
  const tabs = ['ЗП','Винагорода','Аудит','Відпустка'];
  state.planning ||= {};
  state.planningDrafts ||= {};
  const key = `${month}:${tab}`;
  const plan = JSON.parse(JSON.stringify(state.planningDrafts[key] || state.planning[key] || {income:0,reserve:0,rows:[]}));
  const {planned,actual,remainingPlan,remainingActual}=window.planningTotals(plan);
  const reserved=plan.income*plan.reserve/100;
  host.innerHTML = `<div class="filters"><label>Місяць<input id="planningMonth" type="month" value="${month}"></label><label>Розділ<select id="planningTab">${tabs.map(t=>`<option ${t===tab?'selected':''}>${t}</option>`).join('')}</select></label><button type="button" class="secondary" id="copyPlanning">Копіювати попередній місяць</button></div>
  <div class="card"><div class="two-col"><label class="stack-form">Доступний бюджет, ₴<input type="number" min="0" step="0.01" data-plan="income" value="${plan.income}"></label><label class="stack-form">План заощаджень від бюджету, %<input type="number" min="0" max="100" step="0.1" data-plan="reserve" value="${plan.reserve}"></label></div><p class="fine-print">План заощаджень: ${fmt(reserved)} — уже включений у статтю «Заощадження». Окремого віднімання резерву немає. В активи потрапляє тільки факт.</p></div>
  <div class="metric-grid"><article class="metric"><span>План розподілу (із заощадженнями)</span><strong>${fmt(planned)}</strong></article><article class="metric"><span>Факт розподілу (із заощадженнями)</span><strong>${fmt(actual)}</strong></article><article class="metric"><span>Залишок за планом</span><strong>${fmt(remainingPlan)}</strong></article><article class="metric"><span>Залишок за фактом</span><strong>${fmt(remainingActual)}</strong></article></div>
  <article class="card"><div class="card-heading"><h2>${escape(tab)} · ${month}</h2><button class="primary small" id="addPlanningRow">+ Стаття</button></div><div class="table-wrap"><table class="data-table planning-table"><thead><tr><th>Стаття</th><th>Категорія</th><th>План, ₴</th><th>Факт, ₴</th><th>Відхилення</th><th>% бюджету</th><th>Ким оплачено</th><th>Примітки</th><th></th></tr></thead><tbody>${plan.rows.map((r,i)=>`<tr>${['name','category','planned','actual'].map(f=>`<td><input aria-label="${{name:'Стаття',category:'Категорія',planned:'План',actual:'Факт'}[f]} ${i+1}" data-row="${i}" data-field="${f}" type="${['planned','actual'].includes(f)?'number':'text'}" ${['planned','actual'].includes(f)?'min="0" step="0.01"':''} value="${escape(r[f])}"></td>`).join('')}<td>${fmt(r.planned-r.actual)}</td><td>${plan.income?(r.planned/plan.income*100).toFixed(1):'—'}%</td>${['payer','note'].map(f=>`<td><input aria-label="${f==='payer'?'Ким оплачено':'Примітки'} ${i+1}" data-row="${i}" data-field="${f}" value="${escape(r[f])}"></td>`).join('')}<td><button class="text-button" data-remove-plan="${i}" aria-label="Видалити статтю ${i+1}">×</button></td></tr>`).join('')}</tbody><tfoot><tr><th colspan="2">Разом</th><th>${fmt(planned)}</th><th>${fmt(actual)}</th><th>${fmt(planned-actual)}</th><th colspan="4"></th></tr></tfoot></table></div>${!plan.rows.length?'<p class="empty">Додайте першу статтю плану. Приватні значення з Google-таблиці не завантажуються автоматично.</p>':''}<p class="fine-print">Додатне відхилення = витрачено менше плану. Факт тут вводиться вручну; він не створює транзакцій і не змінює активи. Розділи — окремі бюджети: не підсумовуйте аудит із тими самими статтями ЗП повторно.</p></article>`;
  host.querySelectorAll('input[data-field="category"]').forEach(input => {
    const select = document.createElement('select');
    select.dataset.row = input.dataset.row; select.dataset.field = 'category';
    select.setAttribute('aria-label', input.getAttribute('aria-label'));
    const value = input.value.trim();
    const selected = window.planningCategories.find(c => c.toLowerCase() === value.toLowerCase());
    select.innerHTML = `<option value="">${value && !selected ? escape(value)+' — оберіть категорію' : 'Оберіть категорію'}</option>` + window.planningCategories.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('');
    input.replaceWith(select);
  });
  host.querySelectorAll('[data-row]').forEach(input => {
    if (plan.rows[Number(input.dataset.row)]?.percentSavings && ['category','planned'].includes(input.dataset.field)) {
      input.disabled = true; input.title = 'План цієї статті задається відсотком від бюджету';
    }
  });
  const note = host.querySelector('article.card .fine-print');
  if (note) note.textContent = 'Перенесення відбувається тільки після «Зберегти»: факт «Заощадження» → Подушка безпеки; «На всяк випадок» та «Відпустка» → окремі активи у Planned Expenses. Факт інших категорій → журнал витрат (за минулі місяці дата — перше число місяця). Не дублюйте ці витрати вручну. Повторне збереження оновлює записи цього розділу. Внески в активи не записуються як витрати.';
  const actions = document.createElement('div'); actions.className = 'filters';
  actions.innerHTML = '<button class="primary" id="savePlanning">Зберегти</button><button class="secondary" id="cancelPlanning">Скасувати зміни</button><span role="status">' + (state.planningDrafts[key] ? 'Чернетка — ще не перенесено' : 'Показано збережений стан') + '</span><button class="secondary" data-view-link="money">Перевірити активи та борги</button><button class="secondary" data-open="snapshot">Контроль місяця</button><button class="secondary" data-view-link="data">Резервна копія</button>';
  host.prepend(actions);
  const commit=(redraw=true)=>{
    state.planningDrafts[key]=plan;persist('draft');
    if(redraw){window.renderPlanning(state,persist);return;}
    const totals=window.planningTotals(plan);
    host.querySelector('[role="status"]').textContent='Чернетка — натисніть «Зберегти» для перенесення';
    host.querySelectorAll('.metric strong').forEach((el,i)=>{el.textContent=fmt([totals.planned,totals.actual,totals.remainingPlan,totals.remainingActual][i]);});
    host.querySelectorAll('tbody tr').forEach((tr,i)=>{const r=plan.rows[i];if(!r)return;tr.cells[4].textContent=fmt(r.planned-r.actual);tr.cells[5].textContent=plan.income?(r.planned/plan.income*100).toFixed(1)+'%':'—';if(r.percentSavings)tr.querySelector('[data-field="planned"]').value=r.planned;});
    const footer=host.querySelector('tfoot tr');if(footer){footer.cells[1].textContent=fmt(totals.planned);footer.cells[2].textContent=fmt(totals.actual);footer.cells[3].textContent=fmt(totals.planned-totals.actual);}
    const description=host.querySelector('.card .fine-print');if(description)description.textContent=`План заощаджень: ${fmt(plan.income*plan.reserve/100)} — включений у статтю «Заощадження». В активи потрапляє тільки збережений факт.`;
  };
  host.onpointerdown=e=>{if(['savePlanning','cancelPlanning'].includes(e.target.id))e.preventDefault();};
  host.oninput=e=>{
    if(e.target.dataset.row!==undefined&&['name','payer','note'].includes(e.target.dataset.field)){
      plan.rows[Number(e.target.dataset.row)][e.target.dataset.field]=e.target.value;commit(false);
    }
  };
  host.onchange=e=>{
    if(e.target.id==='planningMonth'){host.dataset.month=e.target.value;window.renderPlanning(state,persist);return;}
    if(e.target.id==='planningTab'){host.dataset.tab=e.target.value;window.renderPlanning(state,persist);return;}
    if(e.target.matches('input[type=number]')&&!e.target.checkValidity()){e.target.reportValidity();return;}
    if(e.target.dataset.plan){plan[e.target.dataset.plan]=Number(e.target.value)||0;commit(false);}
    if(e.target.dataset.row!==undefined){const f=e.target.dataset.field;plan.rows[Number(e.target.dataset.row)][f]=['planned','actual'].includes(f)?Number(e.target.value)||0:e.target.value.trim();commit(false);}
  };
  host.onclick=e=>{
    if(e.target.id==='cancelPlanning'){
      window.cancelPlanningChanges(state,key);persist();window.renderPlanning(state,persist);
      host.querySelector('[role="status"]').textContent = 'Зміни скасовано. Показано останній збережений план.';
      host.querySelector('#cancelPlanning').focus();return;
    }
    if(e.target.id==='savePlanning'){
      const inputs=[...host.querySelectorAll('input,select')];
      for(const input of inputs){if(!input.checkValidity()){input.reportValidity();return;}}
      inputs.forEach(input=>{if(input.dataset.plan)plan[input.dataset.plan]=Number(input.value)||0;if(input.dataset.row!==undefined&&!input.disabled){const f=input.dataset.field;plan.rows[Number(input.dataset.row)][f]=['planned','actual'].includes(f)?Number(input.value)||0:input.value.trim();}});
      if(plan.rows.some(r=>Number(r.actual)>0&&!window.planningCategories.some(c=>c.toLowerCase()===String(r.category).trim().toLowerCase()))){alert('Оберіть категорію для кожної статті з фактичною сумою.');return;}
      window.savePlanning(state,key,plan);persist();window.renderPlanning(state,persist);
      host.querySelector('[role="status"]').textContent='Збережено. Фактичні суми перенесено в активи та витрати.';
      host.querySelector('#savePlanning').focus();return;
    }
    if(e.target.id==='addPlanningRow'){plan.rows.push({name:'Нова стаття',category:'',planned:0,actual:0,payer:'',note:''});commit();}
    if(e.target.dataset.removePlan!==undefined){const index=Number(e.target.dataset.removePlan);if(plan.rows[index].percentSavings){alert('Ця стаття пов’язана з відсотком. Щоб прибрати план, встановіть 0%. Фактичний внесок збережеться.');return;}if(confirm('Видалити статтю плану?')){plan.rows.splice(index,1);commit();}}
    if(e.target.id==='copyPlanning'){
      const date=new Date(`${month}-01T12:00:00`);date.setMonth(date.getMonth()-1);const prev=`${date.toLocaleDateString('sv-SE').slice(0,7)}:${tab}`;
      if(!state.planning[prev]){alert('У попередньому місяці немає плану цього розділу.');return;}
      if(plan.rows.length&&!confirm('Замінити поточний план копією попереднього місяця?'))return;
      state.planningDrafts[key]=JSON.parse(JSON.stringify(state.planning[prev]));state.planningDrafts[key].rows.forEach(r=>r.actual=0);persist();window.renderPlanning(state,persist);
    }
  };
};

/* Локальний помісячний план. Дані є частиною загальної JSON-копії. */
window.planningCategories = ['Дім','Авто','Підписки','Їжа','Подарунки','Заощадження','Відпустка','На всяк випадок'];
window.syncPlanningSavings = function(state) {
  const id = 'planning-savings';
  let amount = 0;
  Object.values(state.planning || {}).forEach(plan => (plan.rows || []).forEach(row => {
    if (String(row.category).trim().toLowerCase() === 'заощадження') amount += Math.max(0, Number(row.actual) || 0);
  }));
  amount = Math.round(amount * 100) / 100;
  const asset = state.assets.find(a => a.id === id);
  if (amount === 0) { if (!asset) return false; state.assets = state.assets.filter(a => a.id !== id); return true; }
  if (asset && asset.amount === amount) return false;
  const next = {id, name:'Заощадження з планування', amount, bucket:'capital', verified:false, source:'planning'};
  if (asset) Object.assign(asset,next); else state.assets.push(next);
  return true;
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
  const key = `${month}:${tab}`;
  const plan = state.planning[key] || {income:0,reserve:0,rows:[]};
  const sum = field => plan.rows.reduce((s,r)=>s+(Number(r[field])||0),0);
  const planned=sum('planned'), actual=sum('actual');
  const reserved=plan.income*plan.reserve/100;
  host.innerHTML = `<div class="filters"><label>Місяць<input id="planningMonth" type="month" value="${month}"></label><label>Розділ<select id="planningTab">${tabs.map(t=>`<option ${t===tab?'selected':''}>${t}</option>`).join('')}</select></label><button type="button" class="secondary" id="copyPlanning">Копіювати попередній місяць</button></div>
  <div class="card"><div class="two-col"><label class="stack-form">Доступний бюджет, ₴<input type="number" min="0" step="0.01" data-plan="income" value="${plan.income}"></label><label class="stack-form">Відкладати від бюджету, %<input type="number" min="0" max="100" step="0.1" data-plan="reserve" value="${plan.reserve}"></label></div><p class="fine-print">Резерв: ${fmt(reserved)}. Відсоток кожної статті рахується від доступного бюджету.</p></div>
  <div class="metric-grid"><article class="metric"><span>План витрат</span><strong>${fmt(planned)}</strong></article><article class="metric"><span>Факт витрат</span><strong>${fmt(actual)}</strong></article><article class="metric"><span>Залишок за планом після резерву</span><strong>${fmt(plan.income-reserved-planned)}</strong></article><article class="metric"><span>Залишок за фактом після резерву</span><strong>${fmt(plan.income-reserved-actual)}</strong></article></div>
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
  const note = host.querySelector('article.card .fine-print');
  if (note) note.textContent = 'Факт у категорії «Заощадження» автоматично формує актив «Заощадження з планування» у кошику Capital. Зміна суми, категорії або видалення рядка перераховує актив. Не додавайте ці самі внески вручну в активи. Інші категорії не змінюють активів. Не дублюйте одну оплату в різних розділах.';
  const actions = document.createElement('div'); actions.className = 'filters';
  actions.innerHTML = '<button class="secondary" data-view-link="money">Перевірити активи та борги</button><button class="secondary" data-open="snapshot">Контроль місяця</button><button class="secondary" data-view-link="data">Резервна копія</button>';
  host.prepend(actions);
  const commit=()=>{state.planning[key]=plan;persist();window.renderPlanning(state,persist);};
  host.onchange=e=>{
    if(e.target.id==='planningMonth'){host.dataset.month=e.target.value;window.renderPlanning(state,persist);return;}
    if(e.target.id==='planningTab'){host.dataset.tab=e.target.value;window.renderPlanning(state,persist);return;}
    if(e.target.matches('input[type=number]')&&!e.target.checkValidity()){e.target.reportValidity();return;}
    if(e.target.dataset.plan){plan[e.target.dataset.plan]=Number(e.target.value)||0;commit();}
    if(e.target.dataset.row!==undefined){const f=e.target.dataset.field;plan.rows[Number(e.target.dataset.row)][f]=['planned','actual'].includes(f)?Number(e.target.value)||0:e.target.value.trim();commit();}
  };
  host.onclick=e=>{
    if(e.target.id==='addPlanningRow'){plan.rows.push({name:'Нова стаття',category:'',planned:0,actual:0,payer:'',note:''});commit();}
    if(e.target.dataset.removePlan!==undefined&&confirm('Видалити статтю плану?')){plan.rows.splice(Number(e.target.dataset.removePlan),1);commit();}
    if(e.target.id==='copyPlanning'){
      const date=new Date(`${month}-01T12:00:00`);date.setMonth(date.getMonth()-1);const prev=`${date.toLocaleDateString('sv-SE').slice(0,7)}:${tab}`;
      if(!state.planning[prev]){alert('У попередньому місяці немає плану цього розділу.');return;}
      if(plan.rows.length&&!confirm('Замінити поточний план копією попереднього місяця?'))return;
      state.planning[key]=JSON.parse(JSON.stringify(state.planning[prev]));state.planning[key].rows.forEach(r=>r.actual=0);persist();window.renderPlanning(state,persist);
    }
  };
};

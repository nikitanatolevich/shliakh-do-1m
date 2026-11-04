(() => {
  'use strict';

  const STORAGE_KEY = 'shliakh-do-1m:v1';
  const TARGET = 1_000_000;
  const BUCKETS = {
    current: { label: 'Current Life', color: '#ed7c56', hint: 'Щоденні гроші' },
    planned: { label: 'Planned Expenses', color: '#dfb12f', hint: 'Заплановані витрати' },
    emergency: { label: 'Emergency Fund', color: '#4fb9a0', hint: 'Подушка безпеки' },
    capital: { label: 'Capital', color: '#7e77dd', hint: 'Капітал та інвестиції' }
  };
  const FIN_LEVELS = [
    { value: 0, label: 'L0', name: 'Вразливість' },
    { value: 60_000, label: '60k', name: 'Базова опора' },
    { value: 120_000, label: '120k', name: 'Стабільність' },
    { value: 200_000, label: '200k', name: 'Розгін' },
    { value: 500_000, label: '500k', name: 'Масштаб' },
    { value: 1_000_000, label: '1M', name: 'Ціль' }
  ];
  const BUSINESS_LEVELS = [
    { value: 0, label: 'L0', name: 'Перевірка попиту' },
    { value: 1, label: 'Перший продаж', name: 'Є оплата' },
    { value: 1_000, label: '1k/міс', name: 'Перший ритм' },
    { value: 5_000, label: '5k/міс', name: 'Тяга' },
    { value: 10_000, label: '10k/міс', name: 'Система' },
    { value: 30_000, label: '30k/міс', name: 'Стабільний канал' }
  ];
  const nowMonth = () => new Date().toISOString().slice(0, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const money = value => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(Number(value) || 0);
  const number = value => new Intl.NumberFormat('uk-UA').format(Number(value) || 0);
  const monthName = value => value ? new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`)) : '—';
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const defaults = () => ({
    version: 1,
    meta: { updatedAt: new Date().toISOString(), theme: 'light' },
    assets: [],
    debts: [],
    debtsConfirmed: false,
    transactions: [],
    funds: [],
    historicalEvents: [],
    snapshots: [],
    business: [],
    monthlyPlan: { incomeTarget: 0, expenseLimit: 0, savingsTarget: 0 },
    forecast: { monthlyContribution: 0, conservativeRate: 0, baseRate: 8, optimisticRate: 14 },
    priorities: ['Підтвердити всі активи й борги', 'Не використовувати emergency fund на планові витрати', 'Дійти до першого платного продажу'],
    goals: [
      { id: uid(), text: 'Провести повну звірку залишків', done: false },
      { id: uid(), text: 'Створити резервну копію JSON', done: false }
    ],
    risks: [
      { id: uid(), text: 'Невідомий актуальний баланс боргів', done: false },
      { id: uid(), text: 'Перевірити стабільність доходу', done: false }
    ],
    checklist: [
      { id: uid(), text: 'Звірити всі рахунки та готівку', done: false },
      { id: uid(), text: 'Оновити кожен актив і позначити підтвердженим', done: false },
      { id: uid(), text: 'Перевірити кредитку й усі борги', done: false },
      { id: uid(), text: 'Внести доходи та витрати місяця', done: false },
      { id: uid(), text: 'Оновити sinking funds', done: false },
      { id: uid(), text: 'Переглянути ризики й три пріоритети', done: false },
      { id: uid(), text: 'Записати показники North & Intent', done: false },
      { id: uid(), text: 'Зберегти контрольну точку місяця', done: false }
    ]
  });

  let state = load();
  const resetPlanningView = localStorage.getItem('shliakh:final-test-cleanup-19') !== 'done';
  if(resetPlanningView){
    if(window.cleanupTestData(state).total)localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    sessionStorage.removeItem('shliakh:update-view');
    localStorage.setItem('shliakh:final-test-cleanup-19','done');
  }
  let editor = null;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      const saved = JSON.parse(raw);
      return { ...defaults(), ...saved, meta: { ...defaults().meta, ...saved.meta } };
    } catch (error) {
      console.warn('Не вдалося прочитати локальні дані', error);
      return defaults();
    }
  }

  function save(message = 'Збережено локально') {
    state.meta.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event('finance-change'));
    $('#saveStatus').textContent = message;
    setTimeout(() => { $('#saveStatus').textContent = 'Збережено локально'; }, 1600);
  }

  function totals() {
    const assets = state.assets.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const debts = state.debts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const assetsConfirmed = state.assets.length > 0 && state.assets.every(item => item.verified);
    const debtsConfirmed = state.debtsConfirmed && state.debts.every(item => item.verified !== false);
    const known = assetsConfirmed && debtsConfirmed;
    return { assets, debts, assetsConfirmed, debtsConfirmed, known, net: assets - debts };
  }

  function monthActuals(month = nowMonth()) {
    return state.transactions.filter(item => item.date?.startsWith(month)).reduce((acc, item) => {
      if (item.type === 'income') acc.income += Number(item.amount || 0);
      if (item.type === 'expense') acc.expense += Number(item.amount || 0);
      return acc;
    }, { income: 0, expense: 0 });
  }

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setView(name) {
    $$('.view').forEach(el => el.classList.toggle('active', el.id === `view-${name}`));
    $$('.main-nav button').forEach(el => el.classList.toggle('active', el.dataset.view === name));
    history.replaceState(null, '', `#${name}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => { if (name === 'dashboard') drawNetChart(); if (name === 'business') drawBusinessChart(); });
  }

  function render() {
    if(window.cleanupTestData(state).total)save();
    if (window.syncPlanningSavings(state)) save();
    document.documentElement.dataset.theme = state.meta.theme || 'light';
    renderDashboard(); renderMoney(); renderFunds(); renderMonthly(); renderBusiness(); renderPlan();
    window.renderPlanning(state, mode => { if (mode === 'draft') { save(); return; } window.syncPlanningSavings(state); save(); render(); });
  }

  function renderDashboard() {
    const t = totals();
    $('#assetTotal').textContent = money(t.assets);
    $('#assetVerify').textContent = t.assetsConfirmed ? 'Усі залишки підтверджені' : 'Є непідтверджені стартові значення';
    $('#debtTotal').textContent = t.debtsConfirmed ? money(t.debts) : 'Невідомо';
    $('#debtVerify').textContent = t.debtsConfirmed ? 'Список боргів перевірено' : 'Потрібна повна перевірка';
    $('#netWorth').textContent = t.known ? money(t.net) : 'Не підтверджено';
    $('#netWorthSub').textContent = t.known ? 'Активи мінус усі борги' : 'Потрібна звірка активів та боргів';
    $('#netWorthNote').textContent = t.known
      ? `Підтверджений стан: ${money(t.assets)} активів − ${money(t.debts)} боргів.`
      : `Відомо про активи на ${money(t.assets)}, але чистий капітал і прогрес з’являться лише після підтвердження кожного активу та повного списку боргів.`;
    const progress = t.known ? clamp(t.net / TARGET * 100, 0, 100) : 0;
    $('#progressPct').textContent = t.known ? `${progress.toFixed(1).replace('.', ',')}%` : 'Очікує звірки';
    $('#progressAmount').textContent = t.known ? `Залишилось ${money(Math.max(0, TARGET - t.net))}` : 'Ціль: 1 000 000 ₴';
    $('#progressBar').style.width = `${progress}%`;
    const currentLevel = [...FIN_LEVELS].reverse().find(level => t.known && t.net >= level.value) || FIN_LEVELS[0];
    $('#currentLevel').textContent = t.known ? `${currentLevel.label} · ${currentLevel.name}` : 'L0 · очікує перевірки';
    $('#levelMarkers').innerHTML = FIN_LEVELS.slice(1).map(level => `<div class="level-marker ${t.known && t.net >= level.value ? 'reached' : ''}"><strong>${level.label}</strong><span>${level.name}</span></div>`).join('');
    $('#bucketCards').innerHTML = Object.entries(BUCKETS).map(([key, bucket]) => {
      const value = state.assets.filter(item => item.bucket === key).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return `<div class="bucket"><i class="bucket-dot" style="background:${bucket.color}"></i><div><b>${bucket.label}</b><span>${bucket.hint}</span></div><strong>${money(value)}</strong></div>`;
    }).join('');
    renderPlanFact($('#planFact'));
    const attention = [];
    if (!t.assetsConfirmed) attention.push('Підтвердіть актуальні залишки всіх активів.');
    if (!t.debtsConfirmed) attention.push('Перевірте всі борги й позначте список повним.');
    if (!state.snapshots.length) attention.push('Після звірки збережіть перший контроль місяця.');
    state.funds.forEach(fund => { if (fund.due && new Date(fund.due) < new Date() && Number(fund.current) < Number(fund.target)) attention.push(`Термін фонду «${fund.name}» минув — оновіть план.`); });
    $('#attentionList').innerHTML = attention.map(item => `<li>${esc(item)}</li>`).join('');
    drawNetChart();
  }

  function renderPlanFact(container) {
    const actual = monthActuals();
    const plan = state.monthlyPlan;
    const rows = [
      ['Доходи', actual.income, plan.incomeTarget, false],
      ['Витрати', actual.expense, plan.expenseLimit, true],
      ['Заощадження', actual.income - actual.expense, plan.savingsTarget, false]
    ];
    container.innerHTML = rows.map(([label, fact, target, inverse]) => {
      const pct = target > 0 ? clamp(fact / target * 100, 0, 100) : 0;
      const warn = inverse && fact > target;
      return `<div class="bar-row"><div class="bar-label"><span>${label}</span><strong>${money(fact)} / ${money(target)}</strong></div><div class="bar ${warn ? 'warn' : ''}"><div style="width:${pct}%"></div></div></div>`;
    }).join('');
  }

  function renderMoney() {
    $('#debtsConfirmed').checked = state.debtsConfirmed;
    $('#assetsTable').innerHTML = table(
      ['Назва', 'Кошик', 'Сума', 'Статус', ''],
      state.assets.map(item => [esc(item.name), esc(BUCKETS[item.bucket]?.label || item.bucket), money(item.amount), item.verified ? '✓ підтверджено' : '⚠ не підтверджено', actions('asset', item.id)])
    );
    const generated = state.assets.filter(item => window.planningAssetRoutes.some(route => route.id === item.id));
    if (generated.length) $('#assetsTable').innerHTML += '<p class="fine-print">Активи з планування — суми фактичних внесків. Не включайте ті самі гроші в інший актив повторно. Перевірте поточний залишок перед підтвердженням.</p>' + generated.map(item => `<button class="secondary small" data-verify-planning="${item.id}">Підтвердити: ${esc(item.name)}</button>`).join(' ');
    $('#debtsTable').innerHTML = state.debts.length ? table(
      ['Назва', 'Сума', 'Статус', ''],
      state.debts.map(item => [esc(item.name), money(item.amount), item.verified ? '✓ підтверджено' : '⚠ не підтверджено', actions('debt', item.id)])
    ) : '<p class="empty">Боргів у списку немає. Це ще не означає нуль, доки ви не підтвердите повну перевірку.</p>';
    const month = $('#transactionMonth').value || nowMonth();
    $('#transactionMonth').value = month;
    const type = $('#transactionType').value;
    const items = [...state.transactions].filter(item => (!month || item.date?.startsWith(month)) && (!type || item.type === type)).sort((a, b) => b.date.localeCompare(a.date));
    $('#transactionsTable').innerHTML = items.length ? table(
      ['Дата', 'Тип', 'Категорія', 'Кошик', 'Сума', ''],
      items.map(item => [esc(item.date), ({ income: 'Дохід', expense: 'Витрата', transfer: 'Переказ' })[item.type], esc(item.category || '—'), esc(BUCKETS[item.bucket]?.label || '—'), money(item.amount), actions('transaction', item.id)])
    ) : '<p class="empty">Немає транзакцій за вибраними фільтрами.</p>';
  }

  function renderFunds() {
    $('#fundGrid').innerHTML = state.funds.length ? state.funds.map(fund => {
      const pct = fund.target > 0 ? clamp(fund.current / fund.target * 100, 0, 100) : 0;
      return `<article class="card fund-card"><div class="fund-top"><div><p class="eyebrow">${fund.due ? esc(fund.due) : 'Без дати'}</p><h2>${esc(fund.name)}</h2></div><div class="table-actions">${actions('fund', fund.id)}</div></div><p class="amount">${money(fund.current)} <small class="muted">/ ${money(fund.target)}</small></p><div class="progress-track"><div style="width:${pct}%"></div></div><div class="fund-meta"><span>${pct.toFixed(0)}% готово</span><span>ще ${money(Math.max(0, fund.target - fund.current))}</span></div>${fund.note ? `<p class="fine-print">${esc(fund.note)}</p>` : ''}</article>`;
    }).join('') : '<p class="empty">Створіть окремий фонд для кожної передбачуваної великої витрати.</p>';
    $('#historyEvents').innerHTML = state.historicalEvents.map(item => `<div class="timeline-item"><strong>${esc(item.date)} · ${esc(item.title)} · ${money(item.amount)}</strong><p>${esc(item.note)}</p></div>`).join('');
  }

  function renderMonthly() {
    const sorted = [...state.snapshots].sort((a, b) => b.month.localeCompare(a.month));
    const latest = sorted[0], previous = sorted[1];
    const delta = latest && previous && latest.netWorth != null && previous.netWorth != null ? latest.netWorth - previous.netWorth : null;
    $('#monthComparison').innerHTML = [
      ['Остання точка', latest ? monthName(latest.month) : 'Немає', latest?.netWorth != null ? money(latest.netWorth) : '—'],
      ['Зміна до попередньої', delta == null ? 'Потрібні 2 точки' : (delta >= 0 ? 'Зростання' : 'Зниження'), delta == null ? '—' : `${delta >= 0 ? '+' : ''}${money(delta)}`],
      ['Доходи останнього місяця', latest ? monthName(latest.month) : '—', latest ? money(latest.income) : '—'],
      ['Витрати останнього місяця', latest ? monthName(latest.month) : '—', latest ? money(latest.expense) : '—']
    ].map(([label, sub, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></article>`).join('');
    $('#snapshotsTable').innerHTML = sorted.length ? table(
      ['Місяць', 'Активи', 'Борги', 'Чистий капітал', 'Доходи', 'Витрати', ''],
      sorted.map(item => [monthName(item.month), money(item.assets), item.debtsConfirmed ? money(item.debts) : 'не перевірено', item.netWorth == null ? 'не підтверджено' : money(item.netWorth), money(item.income), money(item.expense), actions('snapshot', item.id, false)])
    ) : '<p class="empty">Поки що немає контрольних точок.</p>';
  }

  function renderBusiness() {
    const sorted = [...state.business].sort((a, b) => b.month.localeCompare(a.month));
    const latest = sorted[0] || { products: 0, pinterestImpressions: 0, clicks: 0, payhipVisitors: 0, sales: 0, revenue: 0 };
    let level = BUSINESS_LEVELS[0];
    if (latest.sales > 0) level = BUSINESS_LEVELS[1];
    BUSINESS_LEVELS.slice(2).forEach(item => { if (latest.revenue >= item.value) level = item; });
    $('#businessLevel').textContent = `${level.label} · ${level.name}`;
    $('#businessRevenue').textContent = `${money(latest.revenue)} / міс`;
    $('#businessMarkers').innerHTML = BUSINESS_LEVELS.slice(1).map(item => `<div class="level-marker ${(item.value === 1 ? latest.sales > 0 : latest.revenue >= item.value) ? 'reached' : ''}"><strong>${item.label}</strong><span>${item.name}</span></div>`).join('');
    const metrics = [
      ['Продукти', latest.products], ['Pinterest покази', number(latest.pinterestImpressions)], ['Кліки', number(latest.clicks)],
      ['Payhip відвідувачі', number(latest.payhipVisitors)], ['Продажі', number(latest.sales)], ['Виручка', money(latest.revenue)]
    ];
    $('#businessMetrics').innerHTML = metrics.map(([label, value]) => `<div class="mini-metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
    $('#businessTable').innerHTML = sorted.length ? table(
      ['Місяць', 'Продукти', 'Pinterest', 'Кліки', 'Payhip', 'Продажі', 'Виручка', ''],
      sorted.map(item => [monthName(item.month), number(item.products), number(item.pinterestImpressions), number(item.clicks), number(item.payhipVisitors), number(item.sales), money(item.revenue), actions('business', item.id)])
    ) : '<p class="empty">Додайте перші показники місяця.</p>';
    drawBusinessChart();
  }

  function renderPlan() {
    fillForm($('#monthlyPlanForm'), state.monthlyPlan);
    fillForm($('#forecastForm'), state.forecast);
    $('#priorities').innerHTML = state.priorities.map((item, index) => `<label class="priority-item"><span class="priority-number">${index + 1}</span><input data-priority="${index}" value="${esc(item)}" aria-label="Пріоритет ${index + 1}"></label>`).join('');
    renderList('goals'); renderList('risks');
    $('#checklist').innerHTML = state.checklist.map(item => `<label class="check-item"><input type="checkbox" data-check="${item.id}" ${item.done ? 'checked' : ''}><span>${esc(item.text)}</span></label>`).join('');
    renderForecast();
  }

  function renderList(name) {
    $(`#${name}`).innerHTML = state[name].map(item => `<div class="list-item"><input type="checkbox" data-list-check="${name}" data-id="${item.id}" ${item.done ? 'checked' : ''}><span>${esc(item.text)}</span><button data-list-delete="${name}" data-id="${item.id}" aria-label="Видалити">×</button></div>`).join('') || '<p class="empty">Список порожній.</p>';
  }

  function renderForecast() {
    const t = totals();
    const start = t.known ? Math.max(0, t.net) : 0;
    const rates = [['Обережний', state.forecast.conservativeRate], ['Базовий', state.forecast.baseRate], ['Оптимістичний', state.forecast.optimisticRate]];
    $('#forecastResults').innerHTML = rates.map(([label, rate]) => {
      const months = monthsToTarget(start, Number(state.forecast.monthlyContribution), Number(rate));
      const text = months == null ? 'Не досягається без внеску' : months > 1200 ? 'Понад 100 років' : `${Math.floor(months / 12)} р. ${months % 12} міс.`;
      return `<div class="scenario"><span>${label} · ${rate}%</span><strong>${t.known ? text : `від 0 ₴: ${text}`}</strong></div>`;
    }).join('');
  }

  function monthsToTarget(start, contribution, annualRate) {
    if (start >= TARGET) return 0;
    if (contribution <= 0 && annualRate <= 0) return null;
    let balance = start;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    for (let month = 1; month <= 2400; month++) {
      balance = balance * (1 + monthlyRate) + contribution;
      if (balance >= TARGET) return month;
    }
    return 2401;
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(item => `<th>${item}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function actions(type, id, canEdit = true) {
    return `<span class="table-actions">${canEdit ? `<button data-edit="${type}" data-id="${id}" aria-label="Редагувати">Ред.</button>` : ''}<button data-delete="${type}" data-id="${id}" aria-label="Видалити">×</button></span>`;
  }

  function fillForm(form, values) {
    Object.entries(values).forEach(([key, value]) => { if (form.elements[key] && document.activeElement !== form.elements[key]) form.elements[key].value = value; });
  }

  const schemas = {
    asset: { title: 'Актив', collection: 'assets', fields: [
      ['name', 'Назва', 'text', true], ['amount', 'Актуальна сума, ₴', 'number', true], ['bucket', 'Кошик', 'select', true, BUCKETS], ['verified', 'Залишок перевірено сьогодні', 'checkbox']
    ] },
    debt: { title: 'Борг', collection: 'debts', fields: [
      ['name', 'Назва або кредитор', 'text', true], ['amount', 'Залишок боргу, ₴', 'number', true], ['verified', 'Суму перевірено', 'checkbox']
    ] },
    transaction: { title: 'Транзакція', collection: 'transactions', fields: [
      ['date', 'Дата', 'date', true], ['type', 'Тип', 'select', true, { income: { label: 'Дохід' }, expense: { label: 'Витрата' }, transfer: { label: 'Переказ між кошиками' } }], ['category', 'Категорія', 'text', true], ['bucket', 'Кошик', 'select', true, BUCKETS], ['amount', 'Сума, ₴', 'number', true], ['note', 'Нотатка', 'textarea']
    ] },
    fund: { title: 'Фонд запланованої витрати', collection: 'funds', fields: [
      ['name', 'Назва', 'text', true], ['target', 'Ціль, ₴', 'number', true], ['current', 'Уже накопичено, ₴', 'number', true], ['due', 'Бажана дата', 'date'], ['note', 'Нотатка', 'textarea']
    ] },
    business: { title: 'Показники North & Intent', collection: 'business', fields: [
      ['month', 'Місяць', 'month', true], ['products', 'Активні продукти', 'number', true], ['pinterestImpressions', 'Pinterest покази', 'number', true], ['clicks', 'Pinterest кліки', 'number', true], ['payhipVisitors', 'Payhip відвідувачі', 'number', true], ['sales', 'Оплачені продажі', 'number', true], ['revenue', 'Виручка, ₴', 'number', true]
    ] },
    snapshot: { title: 'Контроль місяця', collection: 'snapshots', fields: [
      ['month', 'Місяць', 'month', true], ['note', 'Короткий висновок', 'textarea']
    ] }
  };

  function openEditor(type, id = null) {
    if (type === 'asset' && window.planningAssetRoutes.some(route => route.id === id)) { toast('Змініть суму внеску у вкладці «Планування». Підтвердити залишок можна кнопкою під списком активів.'); return; }
    const schema = schemas[type];
    if (!schema) return;
    const existing = id ? state[schema.collection].find(item => item.id === id) : null;
    editor = { type, id };
    $('#dialogTitle').textContent = `${existing ? 'Редагувати' : 'Додати'}: ${schema.title}`;
    $('#dialogFields').innerHTML = schema.fields.map(([name, label, kind, required, options]) => {
      const fallback = kind === 'date' ? today() : kind === 'month' ? nowMonth() : kind === 'number' ? 0 : kind === 'checkbox' ? false : '';
      const value = existing?.[name] ?? fallback;
      if (kind === 'select') return `<label>${label}<select name="${name}" ${required ? 'required' : ''}>${Object.entries(options).map(([key, item]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>`;
      if (kind === 'textarea') return `<label>${label}<textarea name="${name}" rows="3" ${required ? 'required' : ''}>${esc(value)}</textarea></label>`;
      if (kind === 'checkbox') return `<label class="confirm-row"><input name="${name}" type="checkbox" ${value ? 'checked' : ''}> ${label}</label>`;
      return `<label>${label}<input name="${name}" type="${kind}" value="${esc(value)}" ${kind === 'number' ? 'min="0" step="1"' : ''} ${required ? 'required' : ''}></label>`;
    }).join('');
    $('#editorDialog').showModal();
  }

  function submitEditor(event) {
    event.preventDefault();
    if (!editor) return;
    const schema = schemas[editor.type];
    const formData = new FormData(event.currentTarget);
    const item = { id: editor.id || uid() };
    schema.fields.forEach(([name, , kind]) => {
      if (kind === 'checkbox') item[name] = event.currentTarget.elements[name].checked;
      else if (kind === 'number') item[name] = Math.max(0, Number(formData.get(name) || 0));
      else item[name] = String(formData.get(name) || '').trim();
    });
    if (editor.type === 'snapshot') {
      const t = totals(); const actual = monthActuals(item.month);
      Object.assign(item, { assets: t.assets, debts: t.debts, debtsConfirmed: t.debtsConfirmed, netWorth: t.known ? t.net : null, income: actual.income, expense: actual.expense, createdAt: new Date().toISOString() });
      if (!t.known) toast('Точку збережено, але чистий капітал лишився непідтвердженим.');
    }
    const index = state[schema.collection].findIndex(row => row.id === item.id);
    if (index >= 0) state[schema.collection][index] = item; else state[schema.collection].push(item);
    save(); $('#editorDialog').close(); editor = null; render();
  }

  function deleteItem(type, id) {
    if (type === 'asset' && window.planningAssetRoutes.some(route => route.id === id)) { toast('Видаліть або змініть відповідні внески у «Плануванні».'); return; }
    const schema = schemas[type]; if (!schema) return;
    if (!confirm('Видалити цей запис?')) return;
    state[schema.collection] = state[schema.collection].filter(item => item.id !== id);
    save(); render(); toast('Запис видалено');
  }

  function drawNetChart() {
    const canvas = $('#netWorthChart'); if (!canvas || !canvas.offsetParent) return;
    const points = [...state.snapshots].filter(item => item.netWorth != null).sort((a, b) => a.month.localeCompare(b.month));
    $('#chartEmpty').textContent = points.length ? '' : 'Графік з’явиться після першої підтвердженої контрольної точки.';
    drawLine(canvas, points.map(item => ({ label: item.month, value: item.netWorth })), getCss('--brand'));
  }

  function drawBusinessChart() {
    const canvas = $('#businessChart'); if (!canvas || !canvas.offsetParent) return;
    const points = [...state.business].sort((a, b) => a.month.localeCompare(b.month)).map(item => ({ label: item.month, value: item.revenue }));
    drawLine(canvas, points, getCss('--accent'));
  }

  function drawLine(canvas, points, color) {
    const ratio = window.devicePixelRatio || 1; const width = canvas.clientWidth || 500; const height = 210;
    canvas.width = width * ratio; canvas.height = height * ratio; const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
    const muted = getCss('--muted'), line = getCss('--line'); ctx.font = '12px system-ui'; ctx.fillStyle = muted;
    if (!points.length) { ctx.fillText('Немає даних', 10, 28); return; }
    const pad = { l: 58, r: 16, t: 18, b: 35 }; const max = Math.max(...points.map(p => p.value), 1); const min = Math.min(0, ...points.map(p => p.value)); const range = max - min || 1;
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const y = pad.t + (height - pad.t - pad.b) * i / 3; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); const v = max - range * i / 3; ctx.fillText(`${Math.round(v / 1000)}k`, 8, y + 4); }
    const x = i => points.length === 1 ? (pad.l + width - pad.r) / 2 : pad.l + (width - pad.l - pad.r) * i / (points.length - 1);
    const y = value => pad.t + (max - value) / range * (height - pad.t - pad.b);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(x(i), y(p.value)) : ctx.moveTo(x(i), y(p.value))); ctx.stroke();
    points.forEach((p, i) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(i), y(p.value), 4, 0, Math.PI * 2); ctx.fill(); if (i === 0 || i === points.length - 1) { ctx.fillStyle = muted; ctx.textAlign = i === 0 ? 'left' : 'right'; ctx.fillText(p.label, x(i), height - 10); } }); ctx.textAlign = 'left';
  }

  function getCss(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `shliakh-do-1m-${today()}.json`; link.click(); URL.revokeObjectURL(link.href); toast('Резервну копію завантажено');
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.assets) || !Array.isArray(parsed.debts)) throw new Error('Невідома структура');
      if (!confirm('Замінити поточні дані імпортованою копією? Якщо увімкнено хмару, зміна також синхронізується.')) return;
      state = { ...defaults(), ...parsed, meta: { ...defaults().meta, ...parsed.meta } }; save('Імпорт завершено'); render(); toast('Дані успішно імпортовано');
    } catch (error) { toast('Не вдалося імпортувати: перевірте JSON-файл'); }
  }

  document.addEventListener('click', event => {
    if (event.target.dataset.verifyPlanning) { const asset = state.assets.find(item => item.id === event.target.dataset.verifyPlanning); if (asset) { asset.verified = true; save(); render(); toast('Залишок підтверджено'); } }
    const open = event.target.closest('[data-open]'); if (open) openEditor(open.dataset.open);
    const view = event.target.closest('[data-view], [data-view-link]'); if (view) setView(view.dataset.view || view.dataset.viewLink);
    const edit = event.target.closest('[data-edit]'); if (edit) openEditor(edit.dataset.edit, edit.dataset.id);
    const del = event.target.closest('[data-delete]'); if (del) deleteItem(del.dataset.delete, del.dataset.id);
    const close = event.target.closest('[data-close]'); if (close) { $('#editorDialog').close(); editor = null; }
    const addList = event.target.closest('[data-add-list]'); if (addList) { const text = prompt(addList.dataset.addList === 'goals' ? 'Нова ціль:' : 'Новий ризик:'); if (text?.trim()) { state[addList.dataset.addList].push({ id: uid(), text: text.trim(), done: false }); save(); renderPlan(); } }
    const deleteList = event.target.closest('[data-list-delete]'); if (deleteList) { state[deleteList.dataset.listDelete] = state[deleteList.dataset.listDelete].filter(item => item.id !== deleteList.dataset.id); save(); renderPlan(); }
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'debtsConfirmed') { state.debtsConfirmed = event.target.checked; save(); render(); }
    if (event.target.matches('#transactionMonth,#transactionType')) renderMoney();
    if (event.target.dataset.listCheck) { const item = state[event.target.dataset.listCheck].find(row => row.id === event.target.dataset.id); if (item) item.done = event.target.checked; save(); }
    if (event.target.dataset.check) { const item = state.checklist.find(row => row.id === event.target.dataset.check); if (item) item.done = event.target.checked; save(); }
  });

  document.addEventListener('input', event => { if (event.target.dataset.priority != null) { state.priorities[Number(event.target.dataset.priority)] = event.target.value; save(); } });
  $('#editorForm').addEventListener('submit', submitEditor);
  $('#monthlyPlanForm').addEventListener('submit', event => { event.preventDefault(); state.monthlyPlan = Object.fromEntries(['incomeTarget','expenseLimit','savingsTarget'].map(key => [key, Math.max(0, Number(event.currentTarget.elements[key].value || 0))])); save(); render(); toast('План місяця оновлено'); });
  $('#forecastForm').addEventListener('submit', event => { event.preventDefault(); state.forecast = Object.fromEntries(['monthlyContribution','conservativeRate','baseRate','optimisticRate'].map(key => [key, Math.max(0, Number(event.currentTarget.elements[key].value || 0))])); save(); renderForecast(); toast('Прогноз оновлено'); });
  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', event => { if (event.target.files[0]) importData(event.target.files[0]); event.target.value = ''; });
  $('#printBtn').addEventListener('click', () => { setView('dashboard'); setTimeout(() => window.print(), 100); });
  $('#resetBtn').addEventListener('click', () => { if (confirm('Скинути дані до початкових? Якщо увімкнено синхронізацію, це також замінить хмарні дані. Спершу збережіть JSON-копію.')) { localStorage.removeItem(STORAGE_KEY); state = defaults(); save(); render(); toast('Повернуто стартові дані'); } });
  $('#themeToggle').addEventListener('click', () => { state.meta.theme = state.meta.theme === 'dark' ? 'light' : 'dark'; save(); render(); });
  window.addEventListener('resize', () => { clearTimeout(window.__chartTimer); window.__chartTimer = setTimeout(() => { drawNetChart(); drawBusinessChart(); }, 150); });

  window.financeApp = {
    read: () => JSON.parse(JSON.stringify(state)),
    checkpoint: () => { const latest=localStorage.getItem(STORAGE_KEY)?load():JSON.parse(JSON.stringify(state));window.capturePlanningDraft(latest);window.cleanupTestData(latest);localStorage.setItem(STORAGE_KEY,JSON.stringify(latest)); },
    apply: (data, {discardDraftKeys=[]}={}) => {
      const drafts=state.planningDrafts || {}, theme=state.meta.theme;
      discardDraftKeys.forEach(key=>delete drafts[key]);
      state={...defaults(),...data,planningDrafts:drafts,meta:{updatedAt:new Date().toISOString(),theme}};
      window.cleanupTestData(state);
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();
    }
  };
  if (location.hash.includes('access_token=')) window.financeAuthHash=location.hash;
  const initialView = window.financeAuthHash ? 'data' : location.hash.slice(1); setView(document.getElementById(`view-${initialView}`) ? initialView : 'planning');
  try {
    const restore=JSON.parse(sessionStorage.getItem('shliakh:update-view')||'null');
    if(restore&&!resetPlanningView){const host=document.getElementById('planningContent');if(restore.month)host.dataset.month=restore.month;if(restore.tab)host.dataset.tab=restore.tab;sessionStorage.removeItem('shliakh:update-view');requestAnimationFrame(()=>window.scrollTo(0,restore.scroll||0));}
  }catch{}
  if(resetPlanningView){document.getElementById('planningContent').dataset.month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Kyiv'}).format(new Date()).slice(0,7);document.getElementById('planningContent').dataset.tab='ЗП';setView('planning');}
  render();
})();

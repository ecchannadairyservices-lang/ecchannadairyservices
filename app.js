// ─── ECCHANNA DAIRY · app.js ──────────────────────────────────────────────
// All UI logic. Requires data.js to be loaded first.
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

let currentRole  = null;
let _editCustId  = null;   // id of customer being edited (null = add-new mode)

// ══════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Splash → login after 1.6 s
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.add('hidden');
      document.getElementById('login-screen').classList.remove('hidden');
    }, 400);
  }, 1600);
});

// ══════════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ══════════════════════════════════════════════════════════════════
function login(role) {
  currentRole = role;
  document.getElementById('login-screen').classList.add('hidden');

  if (role === 'owner') {
    document.getElementById('owner-screen').classList.remove('hidden');
    ownerTab('dashboard');
  } else if (role === 'father') {
    document.getElementById('parent-screen').classList.remove('hidden');
    initParent();
  } else if (role === 'delivery') {
    document.getElementById('delivery-screen').classList.remove('hidden');
    initDelivery();
  }
}

function logout() {
  currentRole = null;
  ['owner-screen', 'parent-screen', 'delivery-screen'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('login-screen').classList.remove('hidden');
}

// ══════════════════════════════════════════════════════════════════
//  OWNER — TAB SWITCHER
// ══════════════════════════════════════════════════════════════════
function ownerTab(name) {
  document.querySelectorAll('.owner-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const tab = document.getElementById('tab-' + name);
  const nav = document.getElementById('nav-' + name);
  if (tab) tab.classList.add('active');
  if (nav) nav.classList.add('active');

  const init = { dashboard: renderDashboard, customers: initCustomers,
                 billing: initBilling, ai: initAI, settings: initSettings };
  if (init[name]) init[name]();
}

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════
function renderDashboard() {
  const custs    = DB.customers;
  const bills    = DB.bills;
  const settings = DB.settings;
  const month    = settings.billMonth;

  const totalCusts   = custs.length;
  const stoppedCusts = custs.filter(c => c.stopped).length;

  let totalPending = 0;
  custs.forEach(c => {
    const bal = DB.customerBalance(c.id);
    if (bal > 0) totalPending += bal;
  });

  const monthBills   = bills.filter(b => b.month === month);
  const monthCollect = monthBills.reduce((s, b) => s + b.amountPaid, 0);

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-val green">${totalCusts}</div><div class="stat-label">Total customers</div></div>
    <div class="stat-card"><div class="stat-val red">${stoppedCusts}</div><div class="stat-label">Stopped today</div></div>
    <div class="stat-card"><div class="stat-val red">₹${fmt(totalPending)}</div><div class="stat-label">Total pending dues</div></div>
    <div class="stat-card"><div class="stat-val green">₹${fmt(monthCollect)}</div><div class="stat-label">Collected (${fmtMonth(month)})</div></div>
  `;

  document.getElementById('dash-month').textContent = fmtMonth(month);

  // Top overdue customers
  const overdue = custs
    .map(c => ({ c, bal: DB.customerBalance(c.id) }))
    .filter(x => x.bal > 0)
    .sort((a, b) => b.bal - a.bal)
    .slice(0, 5);

  document.getElementById('dash-overdue').innerHTML = overdue.length
    ? overdue.map(x => `
        <div class="cust-row">
          <div class="cust-avatar">${initials(x.c.name)}</div>
          <div style="flex:1"><div class="cust-name">${x.c.name}</div>
          <div class="cust-sub">${x.c.area}</div></div>
          <div class="cust-bal"><div class="cust-bal-amt" style="color:var(--red)">₹${fmt(x.bal)}</div></div>
        </div>`).join('')
    : '<div class="empty-state">🎉 No pending dues right now!</div>';

  // Recent payments
  const recent = bills
    .filter(b => b.amountPaid > 0)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  document.getElementById('dash-recent').innerHTML = recent.length
    ? recent.map(b => {
        const c = custs.find(x => x.id === b.custId);
        return `<div class="payment-row">
          <div>
            <div class="payment-name">${c ? c.name : 'Unknown'}</div>
            <div class="payment-meta">${b.method || '—'} · ${fmtDate(b.date)}</div>
          </div>
          <div class="payment-amt">₹${fmt(b.amountPaid)}</div>
        </div>`;
      }).join('')
    : '<div class="empty-state">No payments recorded yet</div>';
}

// ══════════════════════════════════════════════════════════════════
//  CUSTOMERS
// ══════════════════════════════════════════════════════════════════
let _areaFilter = 'All';

function initCustomers() {
  _areaFilter = 'All';
  renderCustomers('');
}

function renderCustomers(search) {
  const custs = DB.customers;
  const q = (search !== undefined ? search : (document.getElementById('cust-search')?.value || '')).toLowerCase();

  // Build area filter pills
  const areas = ['All', ...new Set(custs.map(c => c.area).filter(Boolean).sort())];
  document.getElementById('area-filters').innerHTML = areas.map(a =>
    `<button class="filter-pill ${a === _areaFilter ? 'active' : ''}"
      onclick="setAreaFilter('${escAttr(a)}')">${a}</button>`
  ).join('');

  const filtered = custs.filter(c => {
    if (_areaFilter !== 'All' && c.area !== _areaFilter) return false;
    return !q || (c.name + c.area + c.breed + c.phone).toLowerCase().includes(q);
  });

  if (!filtered.length) {
    document.getElementById('customers-list').innerHTML =
      '<div class="empty-state">No customers found.<br>Tap <b>+ Add</b> to add your first customer.</div>';
    return;
  }

  document.getElementById('customers-list').innerHTML = filtered.map(c => {
    const bal = DB.customerBalance(c.id);
    const balBadge = bal > 0
      ? `<div class="badge badge-red">₹${fmt(bal)} due</div>`
      : bal < 0
        ? `<div class="badge badge-green">₹${fmt(-bal)} adv</div>`
        : `<div class="badge badge-green">Clear</div>`;
    return `
      <div class="cust-row" onclick="openEditCustomer('${c.id}')">
        <div class="cust-avatar">${initials(c.name)}</div>
        <div style="flex:1">
          <div class="cust-name">${c.name}${c.stopped ? ' <span class="badge badge-stop">STOPPED</span>' : ''}</div>
          <div class="cust-sub">${c.area} · ${c.breed} · ${c.ltrs}L/day</div>
        </div>
        <div class="cust-bal">${balBadge}</div>
      </div>`;
  }).join('');
}

function setAreaFilter(area) {
  _areaFilter = area;
  renderCustomers('');
}

/* ── Add / Edit customer form ── */
function showAddCustomer() {
  _editCustId = null;
  ownerTab('settings');
  const card = document.getElementById('add-customer-card');
  card.style.display = 'block';
  card.querySelector('.section-card-title').textContent = '➕ Add new customer';
  // clear form
  ['nc-name','nc-phone','nc-area','nc-ltrs','nc-crate'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('nc-stopped').value = 'no';
  document.getElementById('nc-msg').textContent = '';
  populateBreedSelect('nc-breed');
  card.scrollIntoView({ behavior: 'smooth' });
}

function openEditCustomer(id) {
  const c = DB.customers.find(x => x.id === id);
  if (!c) return;
  _editCustId = id;
  ownerTab('settings');
  const card = document.getElementById('add-customer-card');
  card.style.display = 'block';
  card.querySelector('.section-card-title').textContent = '✏️ Edit customer';
  populateBreedSelect('nc-breed', c.breed);
  document.getElementById('nc-name').value    = c.name;
  document.getElementById('nc-phone').value   = c.phone;
  document.getElementById('nc-area').value    = c.area;
  document.getElementById('nc-ltrs').value    = c.ltrs;
  document.getElementById('nc-crate').value   = c.customRate || '';
  document.getElementById('nc-stopped').value = c.stopped ? 'yes' : 'no';
  document.getElementById('nc-msg').textContent = '';
  card.scrollIntoView({ behavior: 'smooth' });
}

function addCustomer() {
  const name    = document.getElementById('nc-name').value.trim();
  const phone   = document.getElementById('nc-phone').value.trim();
  const area    = document.getElementById('nc-area').value.trim();
  const breed   = document.getElementById('nc-breed').value;
  const ltrs    = parseFloat(document.getElementById('nc-ltrs').value);
  const crate   = document.getElementById('nc-crate').value;
  const stopped = document.getElementById('nc-stopped').value === 'yes';

  if (!name || !phone || !area || !breed || !ltrs) {
    return showMsg('nc-msg', 'Please fill all required (*) fields.', 'err');
  }
  if (!/^91\d{10}$/.test(phone)) {
    return showMsg('nc-msg', 'Phone must start with 91 and be 12 digits total (e.g. 919876543210).', 'err');
  }

  if (_editCustId) {
    // UPDATE existing
    const custs = DB.customers;
    const idx = custs.findIndex(x => x.id === _editCustId);
    if (idx >= 0) {
      custs[idx] = { ...custs[idx], name, phone, area, breed, ltrs,
        customRate: crate ? parseFloat(crate) : null, stopped };
      DB.customers = custs;
      showMsg('nc-msg', `✅ ${name} updated!`, 'ok');
    }
    _editCustId = null;
    document.getElementById('add-customer-card').querySelector('.section-card-title').textContent = '➕ Add new customer';
  } else {
    // ADD new
    const custs = DB.customers;
    custs.push({ id: DB.newId(), name, phone, area, breed, ltrs,
      customRate: crate ? parseFloat(crate) : null, stopped,
      createdAt: new Date().toISOString() });
    DB.customers = custs;
    showMsg('nc-msg', `✅ ${name} added!`, 'ok');
    ['nc-name','nc-phone','nc-area','nc-ltrs','nc-crate'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
}

function deleteCustomer() {
  if (!_editCustId) return;
  const c = DB.customers.find(x => x.id === _editCustId);
  if (!c) return;
  if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
  DB.customers = DB.customers.filter(x => x.id !== _editCustId);
  _editCustId = null;
  document.getElementById('add-customer-card').style.display = 'none';
  showMsg('nc-msg', 'Customer deleted.', 'ok');
  ownerTab('customers');
}

// ══════════════════════════════════════════════════════════════════
//  BILLING
// ══════════════════════════════════════════════════════════════════
function initBilling() {
  const sel   = document.getElementById('bill-cust-sel');
  const custs = DB.customers;
  sel.innerHTML = '<option value="">-- select customer --</option>' +
    custs.map(c => `<option value="${c.id}">${c.name} (${c.area})</option>`).join('');
  document.getElementById('bill-calc-body').style.display = 'none';
  document.getElementById('bc-msg').textContent = '';
}

function loadBillCalc() {
  const id = document.getElementById('bill-cust-sel').value;
  if (!id) { document.getElementById('bill-calc-body').style.display = 'none'; return; }

  const c = DB.customers.find(x => x.id === id);
  if (!c) return;

  document.getElementById('bill-calc-body').style.display = 'block';
  document.getElementById('bill-cust-display').textContent = `${c.name} · ${c.area}`;

  populateBreedSelect('bc-breed', c.breed);

  // Pre-fill from existing bill this month (if any)
  const settings = DB.settings;
  const existing = DB.bills.find(b => b.custId === id && b.month === settings.billMonth);
  document.getElementById('bc-ltrs').value = existing ? existing.ltrs : c.ltrs;
  document.getElementById('bc-abs').value  = existing ? existing.absents : 0;
  document.getElementById('bc-paid').value = existing ? existing.amountPaid : 0;
  if (existing && existing.breed) {
    populateBreedSelect('bc-breed', existing.breed);
  }
  document.getElementById('bc-msg').textContent = '';

  calcBill();
}

function calcBill() {
  const id = document.getElementById('bill-cust-sel').value;
  if (!id) return;
  const c = DB.customers.find(x => x.id === id);
  if (!c) return;

  const settings  = DB.settings;
  const breedName = document.getElementById('bc-breed').value;
  const breed     = DB.breeds.find(b => b.name === breedName);
  const rate      = c.customRate || (breed ? breed.rate : 0);
  const ltrs      = parseFloat(document.getElementById('bc-ltrs').value)  || 0;
  const abs       = parseInt(document.getElementById('bc-abs').value)     || 0;
  const paid      = parseFloat(document.getElementById('bc-paid').value)  || 0;
  const totalDays = parseInt(settings.billDays) || 30;
  const delivDays = Math.max(0, totalDays - abs);

  document.getElementById('bc-abs-note').textContent = abs > 0
    ? `${abs} absent days → delivering ${delivDays} of ${totalDays} days`
    : '';

  const totalBill = ltrs * delivDays * rate;
  const balance   = totalBill - paid;

  document.getElementById('bc-breakdown').innerHTML = `
    <div class="brow"><span>Rate (${breedName})</span><span>₹${rate}/L</span></div>
    <div class="brow"><span>${ltrs}L/day × ${delivDays} days</span><span>= ${ltrs * delivDays}L</span></div>
    <div class="brow total"><span>Total bill</span><span>₹${fmt(totalBill)}</span></div>
  `;

  const balColour = balance > 0 ? 'var(--red)' : 'var(--green)';
  const balLabel  = balance > 0 ? '💸 Balance due' : '✅ Advance paid';
  document.getElementById('bc-balance').innerHTML = `
    <div class="brow balance-row" style="color:${balColour}">
      <span>${balLabel}</span><span>₹${fmt(Math.abs(balance))}</span>
    </div>`;

  window._currentBill = { ltrs, abs, rate, breedName, totalDays, delivDays, totalBill, paid, balance };

  // Wire WhatsApp button
  document.getElementById('bc-wa-btn').onclick = () =>
    sendWhatsAppBill(c, window._currentBill, settings);
}

function saveBillCalc() {
  const id = document.getElementById('bill-cust-sel').value;
  if (!id || !window._currentBill) return;

  const method   = document.querySelector('#tab-billing .method-btn.active')?.dataset.method || 'Cash';
  const bill     = window._currentBill;
  const settings = DB.settings;
  const bills    = DB.bills;
  const existIdx = bills.findIndex(b => b.custId === id && b.month === settings.billMonth);

  const record = {
    id:          existIdx >= 0 ? bills[existIdx].id : DB.newId(),
    custId:      id,
    month:       settings.billMonth,
    totalBill:   bill.totalBill,
    amountPaid:  bill.paid,
    method,
    ltrs:        bill.ltrs,
    absents:     bill.abs,
    breed:       bill.breedName,
    rate:        bill.rate,
    date:        today(),
  };

  if (existIdx >= 0) bills[existIdx] = record;
  else bills.push(record);

  DB.bills = bills;
  showMsg('bc-msg', `✅ Bill saved for ${fmtMonth(settings.billMonth)}!`, 'ok');
}

function sendWhatsAppBill(c, bill, settings) {
  let msg = `🐄 *${settings.bizName}*\n`;
  msg += `Bill for ${fmtMonth(settings.billMonth)}\n\n`;
  msg += `Customer: *${c.name}*\n`;
  msg += `Breed: ${bill.breedName} @ ₹${bill.rate}/L\n`;
  msg += `${bill.ltrs}L/day × ${bill.delivDays} days`;
  if (bill.abs > 0) msg += ` (${bill.abs} days absent)`;
  msg += `\n\n*Total bill: ₹${fmt(bill.totalBill)}*\n`;
  if (bill.paid > 0) msg += `Amount paid: ₹${fmt(bill.paid)}\n`;
  const bal = bill.totalBill - bill.paid;
  if (bal > 0) msg += `*Balance due: ₹${fmt(bal)}*\n`;
  else if (bal < 0) msg += `*Advance: ₹${fmt(-bal)}* (will adjust next month)\n`;
  if (settings.gpay)  msg += `\n📱 GPay: ${settings.gpay}`;
  if (settings.paytm) msg += `\n💙 Paytm: ${settings.paytm}`;
  msg += '\n\nThank you! 🙏';

  window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ══════════════════════════════════════════════════════════════════
//  AI MESSAGE READER
// ══════════════════════════════════════════════════════════════════
function initAI() {
  const sel   = document.getElementById('ai-cust-sel');
  const custs = DB.customers;
  sel.innerHTML = '<option value="">-- optional --</option>' +
    custs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('ai-result-box').innerHTML = '';
  renderAIHistory();
}

function runAIRead() {
  const msg    = document.getElementById('ai-msg-inp').value.trim();
  if (!msg) return showMsg('ai-result-box', 'Paste a message first.', 'err');

  const custId = document.getElementById('ai-cust-sel').value;
  const cust   = custId ? DB.customers.find(x => x.id === custId) : null;
  const result = detectFromMessage(msg);

  let html = `<div class="ai-result-card">
    <div class="ai-result-title">🤖 Detected from message</div>
    <div class="ai-row">Amount: <span>${result.amount > 0 ? '₹' + fmt(result.amount) : 'Not detected'}</span></div>
    <div class="ai-row">Payment method: <span>${result.method}</span></div>
    <div class="ai-row">Absent days: <span>${result.absentDays > 0 ? result.absentDays + ' days' : 'None detected'}</span></div>
    <div class="ai-row">Notes: <span>${result.note || '—'}</span></div>
  </div>`;

  if (result.amount > 0 && custId) {
    html += `<button class="submit-btn" style="margin-top:10px"
      onclick="applyAIPayment('${custId}', ${result.amount}, '${result.method}')">
      ✅ Apply ₹${fmt(result.amount)} to ${cust ? cust.name : 'customer'}</button>`;
  } else if (result.amount > 0) {
    html += `<p style="font-size:0.8rem;color:var(--amber);margin-top:8px">
      Select a customer above to apply this payment.</p>`;
  }

  document.getElementById('ai-result-box').innerHTML = html;

  // Save to history
  const history = DB.aiHistory;
  history.unshift({ id: DB.newId(), custId, custName: cust ? cust.name : 'Unknown',
    msg, result, date: today() });
  DB.aiHistory = history.slice(0, 20);
  renderAIHistory();
}

function detectFromMessage(msg) {
  let amount = 0, method = 'Cash', absentDays = 0, note = '';

  // ── Amount detection ──────────────────────────────────────────
  // Patterns: "paid 1200", "₹800", "1500 bheja", "done 900"
  const amtRules = [
    /(?:paid?|payment|bheja|send|sent|transfer(?:red)?|diya|done|₹|rs\.?)\s*(\d{3,6})/gi,
    /(\d{3,6})\s*(?:rupees?|rs\.?|₹|bucks?|bheja|send|kr)/gi,
  ];
  for (const pat of amtRules) {
    const matches = [...msg.matchAll(pat)];
    const nums    = matches.map(m => parseInt(m[1])).filter(n => n >= 50 && n <= 99999);
    if (nums.length) { amount = nums[0]; break; }
  }
  // Fallback: any standalone 3-5 digit number
  if (!amount) {
    const fallback = [...msg.matchAll(/\b(\d{3,5})\b/g)]
      .map(m => parseInt(m[1])).filter(n => n >= 100 && n <= 99999);
    if (fallback.length) amount = fallback[0];
  }

  // ── Method detection ──────────────────────────────────────────
  if (/gpay|google\s?pay/i.test(msg))              method = 'GPay';
  else if (/paytm/i.test(msg))                      method = 'Paytm';
  else if (/phonepe|phone\s?pe/i.test(msg))         method = 'Other UPI';
  else if (/upi|neft|imps|online/i.test(msg))       method = 'Other UPI';
  else if (/cash|naqad|naqdh|haath/i.test(msg))     method = 'Cash';

  // ── Absent days ───────────────────────────────────────────────
  const absRules = [
    /(\d+)\s*(?:din|days?)\s*(?:milk|dudh|doodh|nahi|nahin|absent|skip|band|nai)/i,
    /(?:absent|skip|band|nahi|nahin|nai)\s*(?:for|tha|kiya|raha)?\s*(\d+)\s*(?:din|days?)/i,
    /(\d+)\s*din\s+(?:nahi|nahin|nai)\s+(?:aaya|aai|aya)/i,
  ];
  for (const pat of absRules) {
    const m = msg.match(pat);
    if (m) { absentDays = parseInt(m[1] || m[2]); break; }
  }

  // ── Notes ─────────────────────────────────────────────────────
  if (/complaint|problem|issue|kharab/i.test(msg))        note = 'Has a complaint';
  else if (/breed|change|badal|naya|buffalo|cow/i.test(msg)) note = 'Possible breed change';
  else if (/stop|band|roko|pause|cancel/i.test(msg))       note = 'Wants to stop/pause delivery';
  else if (/increase|zyada|jyada|2\s?L|3\s?L/i.test(msg)) note = 'May want more milk';

  return { amount, method, absentDays, note };
}

function applyAIPayment(custId, amount, method) {
  const bills    = DB.bills;
  const settings = DB.settings;
  const existIdx = bills.findIndex(b => b.custId === custId && b.month === settings.billMonth);

  if (existIdx >= 0) {
    bills[existIdx].amountPaid += amount;
    bills[existIdx].method      = method;
    DB.bills = bills;
    document.getElementById('ai-result-box').innerHTML +=
      `<div class="msg-ok">✅ ₹${fmt(amount)} added to ${fmtMonth(settings.billMonth)} bill!</div>`;
  } else {
    // No bill yet — record as advance payment
    bills.push({ id: DB.newId(), custId, month: settings.billMonth,
      totalBill: 0, amountPaid: amount, method,
      ltrs: 0, absents: 0, breed: '', rate: 0, date: today() });
    DB.bills = bills;
    document.getElementById('ai-result-box').innerHTML +=
      `<div class="msg-ok">✅ Recorded as advance. Generate the full bill in Billing tab.</div>`;
  }
}

function renderAIHistory() {
  const history = DB.aiHistory;
  if (!history.length) {
    document.getElementById('ai-history-list').innerHTML =
      '<div class="empty-state">No reads yet. Paste a customer message above.</div>';
    return;
  }
  document.getElementById('ai-history-list').innerHTML = history.slice(0, 5).map(h => `
    <div class="payment-row">
      <div>
        <div class="payment-name">${h.custName}</div>
        <div class="payment-meta">${h.date} · "${h.msg.slice(0, 42)}${h.msg.length > 42 ? '…' : ''}"</div>
      </div>
      <div class="payment-amt">${h.result.amount > 0 ? '₹' + fmt(h.result.amount) : '—'}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════
function initSettings() {
  const s = DB.settings;
  document.getElementById('gpay-num').value      = s.gpay;
  document.getElementById('paytm-num').value     = s.paytm;
  document.getElementById('biz-name-inp').value  = s.bizName;
  document.getElementById('bill-month-inp').value = s.billMonth;
  document.getElementById('bill-days-inp').value  = s.billDays;
  renderBreedSettings();
  populateBreedSelect('nc-breed');
}

function renderBreedSettings() {
  const breeds = DB.breeds;
  document.getElementById('breed-settings-list').innerHTML = breeds.map((b, i) => `
    <div class="breed-row">
      <div class="breed-emoji">${b.emoji}</div>
      <div class="breed-info"><div class="breed-name">${b.name}</div></div>
      <input class="breed-rate-inp" type="number" value="${b.rate}" min="1"
        onchange="updateBreedRate(${i}, this.value)">
      <span style="font-size:0.72rem;color:var(--text-muted)">₹/L</span>
      <button class="breed-del" onclick="deleteBreed(${i})" title="Delete breed">🗑</button>
    </div>`).join('');
}

function updateBreedRate(idx, val) {
  const breeds = DB.breeds;
  breeds[idx].rate = parseFloat(val) || breeds[idx].rate;
  DB.breeds = breeds;
  showMsg('breed-msg', '✅ Rate saved!', 'ok');
}

function deleteBreed(idx) {
  const breeds = DB.breeds;
  if (breeds.length <= 1) return alert('You need at least one breed.');
  if (!confirm(`Delete "${breeds[idx].name}"?`)) return;
  breeds.splice(idx, 1);
  DB.breeds = breeds;
  renderBreedSettings();
}

function addBreed() {
  const name  = document.getElementById('new-breed-name').value.trim();
  const rate  = parseFloat(document.getElementById('new-breed-rate').value);
  const emoji = document.getElementById('new-breed-emoji').value.trim() || '🐄';

  if (!name || !rate) return showMsg('breed-msg', 'Enter breed name and rate.', 'err');

  const breeds = DB.breeds;
  if (breeds.find(b => b.name.toLowerCase() === name.toLowerCase()))
    return showMsg('breed-msg', 'Breed already exists.', 'err');

  breeds.push({ name, rate, emoji });
  DB.breeds = breeds;
  renderBreedSettings();
  ['new-breed-name','new-breed-rate','new-breed-emoji'].forEach(id =>
    document.getElementById(id).value = '');
  showMsg('breed-msg', `✅ ${name} added!`, 'ok');
}

function savePaymentSettings() {
  const s    = DB.settings;
  s.gpay     = document.getElementById('gpay-num').value.trim();
  s.paytm    = document.getElementById('paytm-num').value.trim();
  s.bizName  = document.getElementById('biz-name-inp').value.trim() || 'Ecchanna Dairy Services';
  DB.settings = s;
  showMsg('pay-set-msg', '✅ Payment settings saved!', 'ok');
}

function saveMonthSettings() {
  const s      = DB.settings;
  s.billMonth  = document.getElementById('bill-month-inp').value;
  s.billDays   = parseInt(document.getElementById('bill-days-inp').value) || 30;
  DB.settings  = s;
  showMsg('pay-set-msg', '✅ Month settings saved!', 'ok');
}

function bulkImport() {
  const csv = document.getElementById('bulk-csv').value.trim();
  if (!csv) return showMsg('import-msg', 'Paste CSV data above.', 'err');

  const custs  = DB.customers;
  const breeds = DB.breeds;
  let added = 0, errors = 0;

  csv.split('\n').forEach(line => {
    const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    const [name, phone, area, breed, ltrsStr] = parts;
    if (!name || !phone || !area || !breed || !ltrsStr) { errors++; return; }
    const ltrs = parseFloat(ltrsStr);
    if (!ltrs) { errors++; return; }

    // Auto-add unknown breed with default rate
    if (!breeds.find(b => b.name.toLowerCase() === breed.toLowerCase()))
      breeds.push({ name: breed, rate: 70, emoji: '🐄' });

    custs.push({ id: DB.newId(), name, phone, area, breed, ltrs,
      customRate: null, stopped: false, createdAt: new Date().toISOString() });
    added++;
  });

  DB.customers = custs;
  DB.breeds    = breeds;
  showMsg('import-msg',
    `✅ Imported ${added} customer${added !== 1 ? 's' : ''}` +
    (errors ? ` (${errors} row${errors !== 1 ? 's' : ''} skipped — check format)` : '') + '.',
    'ok');
  renderBreedSettings();
}

function exportCSV() {
  const custs = DB.customers;
  const header = 'Name,Phone,Area,Breed,Litres/day,Status,Balance (₹)\n';
  const rows = custs.map(c => {
    const bal = DB.customerBalance(c.id);
    return `"${c.name}","${c.phone}","${c.area}","${c.breed}",${c.ltrs},"${c.stopped ? 'Stopped' : 'Active'}",${bal}`;
  }).join('\n');
  downloadFile('dairy_customers.csv', header + rows, 'text/csv');
}

function exportJSON() {
  const data = {
    customers:  DB.customers,
    bills:      DB.bills,
    breeds:     DB.breeds,
    settings:   DB.settings,
    aiHistory:  DB.aiHistory,
    exportedAt: new Date().toISOString(),
  };
  downloadFile('dairy_backup.json', JSON.stringify(data, null, 2), 'application/json');
}

function restoreJSON() {
  try {
    const raw  = document.getElementById('restore-inp').value.trim();
    const data = JSON.parse(raw);
    if (!data.customers) throw new Error('Missing customers');
    if (data.customers)  DB.customers  = data.customers;
    if (data.bills)      DB.bills      = data.bills;
    if (data.breeds)     DB.breeds     = data.breeds;
    if (data.settings)   DB.settings   = data.settings;
    if (data.aiHistory)  DB.aiHistory  = data.aiHistory;
    showMsg('restore-msg', '✅ Data restored! Refresh to see all changes.', 'ok');
  } catch (e) {
    showMsg('restore-msg', '❌ Invalid backup file. Make sure you pasted the whole JSON.', 'err');
  }
}

// ══════════════════════════════════════════════════════════════════
//  PARENT VIEW
// ══════════════════════════════════════════════════════════════════
function initParent() {
  renderParentSummary();
  renderParentPending();
  renderParentRemind();

  // Populate payment customer dropdown
  const sel   = document.getElementById('pr-cust');
  sel.innerHTML = '<option value="">-- select --</option>' +
    DB.customers.map(c => `<option value="${c.id}">${c.name} (${c.area})</option>`).join('');
}

function renderParentSummary() {
  const custs    = DB.customers;
  const settings = DB.settings;
  const month    = settings.billMonth;

  let totalPending = 0, countPending = 0;
  custs.forEach(c => {
    const bal = DB.customerBalance(c.id);
    if (bal > 0) { totalPending += bal; countPending++; }
  });

  const monthBills  = DB.bills.filter(b => b.month === month);
  const collected   = monthBills.reduce((s, b) => s + b.amountPaid, 0);
  const active      = custs.filter(c => !c.stopped).length;

  document.getElementById('parent-summary').innerHTML = `
    <div class="parent-summary">
      <div class="summary-stat"><div class="summary-val red">${countPending}</div><div class="summary-label">Pending customers</div></div>
      <div class="summary-stat"><div class="summary-val red">₹${fmt(totalPending)}</div><div class="summary-label">Total overdue</div></div>
      <div class="summary-stat"><div class="summary-val green">${active}</div><div class="summary-label">Active customers</div></div>
      <div class="summary-stat"><div class="summary-val green">₹${fmt(collected)}</div><div class="summary-label">Collected this month</div></div>
    </div>`;
}

function renderParentPending() {
  const pending = DB.customers
    .map(c => ({ c, bal: DB.customerBalance(c.id) }))
    .filter(x => x.bal > 0)
    .sort((a, b) => b.bal - a.bal);

  document.getElementById('parent-pending-list').innerHTML = pending.length
    ? pending.map(x => `
        <div class="pending-row">
          <div class="pending-info">
            <div class="pending-name">${x.c.name}</div>
            <div class="pending-sub">${x.c.area} · ${x.c.phone}</div>
          </div>
          <div class="pending-amt">₹${fmt(x.bal)}</div>
        </div>`).join('')
    : '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:3rem">🎉</div><div style="font-weight:600;color:var(--green)">All dues are clear!</div></div>';
}

function renderParentRemind() {
  const withBal = DB.customers
    .map(c => ({ c, bal: DB.customerBalance(c.id) }))
    .filter(x => x.bal > 0);

  document.getElementById('parent-remind-list').innerHTML = withBal.length
    ? withBal.map(x => `
        <div class="remind-row">
          <div style="flex:1">
            <div class="pending-name">${x.c.name}</div>
            <div class="pending-sub">₹${fmt(x.bal)} due</div>
          </div>
          <button class="wa-small" onclick="sendReminder('${x.c.id}', ${x.bal})">📲 Send</button>
        </div>`).join('')
    : '<div class="empty-state">No pending dues — nothing to remind!</div>';
}

function fillParentBal() {
  const id  = document.getElementById('pr-cust').value;
  const el  = document.getElementById('pr-bal');
  if (!id) { el.textContent = 'Select a customer'; return; }

  const bal = DB.customerBalance(id);
  if (bal > 0) {
    el.textContent    = `₹${fmt(bal)} due`;
    el.style.background = '';
    el.style.color    = '';
  } else {
    el.textContent    = bal < 0 ? `₹${fmt(-bal)} advance` : 'No dues outstanding';
    el.style.background = 'var(--green-pale)';
    el.style.color    = 'var(--green)';
  }
}

function parentRecordPayment() {
  const id     = document.getElementById('pr-cust').value;
  const amount = parseFloat(document.getElementById('pr-amt').value);
  const method = document.querySelector('#parent-record .method-btn.active')?.dataset.method || 'Cash';

  if (!id)            return showMsg('pr-msg', 'Please select a customer.', 'err');
  if (!amount || amount <= 0) return showMsg('pr-msg', 'Enter a valid amount.', 'err');

  const bills    = DB.bills;
  const settings = DB.settings;
  const existIdx = bills.findIndex(b => b.custId === id && b.month === settings.billMonth);
  const custName = DB.customers.find(x => x.id === id)?.name || 'Customer';

  if (existIdx >= 0) {
    bills[existIdx].amountPaid += amount;
    bills[existIdx].method      = method;
  } else {
    bills.push({ id: DB.newId(), custId: id, month: settings.billMonth,
      totalBill: 0, amountPaid: amount, method,
      ltrs: 0, absents: 0, breed: '', rate: 0, date: today() });
  }
  DB.bills = bills;

  document.getElementById('pr-amt').value = '';
  showMsg('pr-msg', `✅ ₹${fmt(amount)} recorded for ${custName}!`, 'ok');
  fillParentBal();
  renderParentSummary();
  renderParentPending();
  renderParentRemind();
}

function sendReminder(custId, bal) {
  const c        = DB.customers.find(x => x.id === custId);
  const settings = DB.settings;
  if (!c) return;

  let msg = `🙏 Namaste *${c.name}* ji,\n\nYour milk bill of *₹${fmt(bal)}* is pending with *${settings.bizName}*.\n\nKindly pay at your earliest convenience. 🐄\n`;
  if (settings.gpay)  msg += `\n📱 GPay: ${settings.gpay}`;
  if (settings.paytm) msg += `\n💙 Paytm: ${settings.paytm}`;
  msg += '\n\nThank you! 🙏';

  window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function showSection(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function hideSection(id)  { document.getElementById(id)?.classList.add('hidden'); }

// ══════════════════════════════════════════════════════════════════
//  DELIVERY VIEW
// ══════════════════════════════════════════════════════════════════
function initDelivery() {
  const stopped = DB.customers.filter(c => c.stopped);

  if (!stopped.length) {
    document.getElementById('delivery-ok').classList.remove('hidden');
    document.getElementById('stop-list-container').innerHTML = '';
  } else {
    document.getElementById('delivery-ok').classList.add('hidden');
    document.getElementById('stop-list-container').innerHTML = stopped.map(c => `
      <div class="stop-card">
        <div class="stop-name">${c.name}</div>
        <div class="stop-area">📍 ${c.area} &nbsp;·&nbsp; ${c.ltrs}L/day</div>
        <div class="stop-reason">🚫 Delivery stopped</div>
      </div>`).join('');
  }
}

// ══════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ══════════════════════════════════════════════════════════════════

/** Populate a <select> with breed options */
function populateBreedSelect(selId, selected) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = DB.breeds.map(b =>
    `<option value="${escAttr(b.name)}" ${b.name === selected ? 'selected' : ''}>
      ${b.emoji} ${b.name} (₹${b.rate}/L)
    </option>`).join('');
}

/** Toggle payment method button highlight */
function selectMethod(btn) {
  btn.closest('.pay-method-row')
     .querySelectorAll('.method-btn')
     .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/** Show a timed status message in an element */
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = type === 'ok' ? 'msg-ok' : 'msg-err';
  el.textContent = text;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

function fmt(n) {
  return (Math.round(n) || 0).toLocaleString('en-IN');
}

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return d; }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function escAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href  = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

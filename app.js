// ============================================================
//  APP.JS — FinanceHub · Lógica principal
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, onSnapshot, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Estado global ───────────────────────────────────────────
let currentUser = null;
let receitas    = [];
let gastos      = [];
let reservas    = [];
let cartoes     = [];
let charts      = {};
let confirmCallback = null;

// ─── Utilitários ─────────────────────────────────────────────
const fmt = (val) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const fmtPct = (val) => `${(val || 0).toFixed(3)}%`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const monthKey = (date) => {
  const d = new Date(date + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};

const isBusinessDay = (date) => {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); // 0=Dom, 6=Sab
  return day >= 1 && day <= 5;
};

const daysBetween = (d1, d2) => {
  const t1 = new Date(d1 + "T00:00:00").getTime();
  const t2 = new Date(d2 + "T00:00:00").getTime();
  return Math.floor((t2 - t1) / 86400000);
};

// Conta dias úteis entre duas datas
const businessDaysBetween = (start, end) => {
  let count = 0;
  const d = new Date(start + "T00:00:00");
  const endD = new Date(end + "T00:00:00");
  while (d <= endD) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
};

// Último dia do mês
const lastDayOfMonth = (year, month) =>
  new Date(year, month, 0).getDate();

window.showToast = (msg, type = "success") => {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = { success: "check-circle", error: "circle-xmark", warning: "triangle-exclamation", info: "circle-info" }[type] || "check-circle";
  toast.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 4000);
};

// ─── Referências Firestore ────────────────────────────────────
const userRef     = () => doc(db, "users", currentUser.uid);
const receitasRef = () => collection(db, "users", currentUser.uid, "receitas");
const gastosRef   = () => collection(db, "users", currentUser.uid, "gastos");
const reservasRef = () => collection(db, "users", currentUser.uid, "reservas");
const cartoesRef  = () => collection(db, "users", currentUser.uid, "cartoes");

// ─── Inicialização ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  window.FinanceAuth.onAuthChange(async (user) => {
    if (user) {
      currentUser = user;
      showApp(user);
      await loadAll();
      setupYieldUpdater();
    } else {
      currentUser = null;
      showLogin();
    }
  });

  bindUIEvents();
  populateMonthSelects();
  updateCurrentDate();
});

function showApp(user) {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("user-name").textContent = user.displayName || user.email;
  document.getElementById("user-photo").src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "U") + "&background=6366f1&color=fff";
}

function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function updateCurrentDate() {
  const el = document.getElementById("current-date");
  const now = new Date();
  el.textContent = now.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ─── Carregamento de Dados ────────────────────────────────────
async function loadAll() {
  await Promise.all([loadReceitas(), loadGastos(), loadReservas(), loadCartoes()]);
  renderAll();
}

async function loadReceitas() {
  const snap = await getDocs(query(receitasRef(), orderBy("data", "desc")));
  receitas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadGastos() {
  const snap = await getDocs(query(gastosRef(), orderBy("data", "desc")));
  gastos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadReservas() {
  const snap = await getDocs(reservasRef());
  reservas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadCartoes() {
  const snap = await getDocs(cartoesRef());
  cartoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Render Geral ─────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderReceitas();
  renderGastos();
  renderReservas();
  renderCartoes();
  renderRelatorios();
  updateBadges();
  updateNotifications();
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard() {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;
  const mKey   = `${year}-${String(month).padStart(2,"0")}`;
  const todayStr = today();

  // Saldo total (receitas com rendimento calculado até hoje)
  let saldoTotal = 0;
  let totalRendimentos = 0;

  for (const r of receitas) {
    const valorAtual = calcRendimento(r, todayStr);
    const rendimento = valorAtual - r.valor;
    saldoTotal += valorAtual;
    totalRendimentos += rendimento;
  }

  // Gastos do mês atual
  const gastosMes = gastos.filter(g => monthKey(g.data) === mKey);
  const totalGastosMes = gastosMes.reduce((s, g) => s + g.valor, 0);

  // Gastos previstos até fim do mês (parcelas de cartão a vencer no mês)
  let gastosPrevistosAteFinsMes = totalGastosMes;
  const lastDay = lastDayOfMonth(year, month);
  const endOfMonth = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;

  // Soma cartão parcelas futuras no mês
  for (const g of gastos) {
    if (g.pagamento === "cartao" && g.parcelas > 1) {
      for (let p = 1; p < g.parcelas; p++) {
        const parcData = addMonths(g.data, p);
        if (monthKey(parcData) === mKey && parcData > todayStr) {
          gastosPrevistosAteFinsMes += g.valor / g.parcelas;
        }
      }
    }
  }

  const saldoLivre = saldoTotal - gastosPrevistosAteFinsMes;

  // Cartão pendente (vence este mês)
  let pendente = 0;
  for (const c of cartoes) {
    const venc = cartaoVencimentoMes(c, year, month);
    const fatura = calcFaturaCartao(c.id, mKey);
    pendente += fatura;
  }

  // Update UI
  document.getElementById("dash-saldo").textContent     = fmt(saldoTotal);
  document.getElementById("dash-saldo-rendimento").textContent = `+${fmt(totalRendimentos)} em rendimentos`;
  document.getElementById("dash-gastos").textContent    = fmt(gastosPrevistosAteFinsMes);
  document.getElementById("dash-livre").textContent     = fmt(saldoLivre);
  document.getElementById("dash-pendente").textContent  = fmt(pendente);
  document.getElementById("dash-month").textContent     = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Barra de orçamento
  const pct = saldoTotal > 0 ? Math.min((gastosPrevistosAteFinsMes / saldoTotal) * 100, 100) : 0;
  document.getElementById("budget-spent").textContent     = fmt(gastosPrevistosAteFinsMes);
  document.getElementById("budget-available").textContent = fmt(saldoTotal);
  document.getElementById("budget-percent").textContent   = `${pct.toFixed(1)}% utilizado`;
  const bar = document.getElementById("budget-bar-fill");
  bar.style.width = pct + "%";
  bar.className = "budget-bar-fill" + (pct > 80 ? " danger" : pct > 60 ? " warning" : "");

  // Vencimentos próximos (7 dias)
  renderUpcoming();

  // Últimas transações
  renderRecent();

  // Charts
  renderChartReceitaGasto(year);
  renderChartCategorias(mKey);
}

function calcRendimento(receita, upToDate) {
  if (!receita.rendimento || receita.rendimento <= 0) return receita.valor;
  const start = receita.data;
  if (start >= upToDate) return receita.valor;
  const bd = businessDaysBetween(start, upToDate);
  // Rendimento composto diário
  return receita.valor * Math.pow(1 + receita.rendimento / 100, bd);
}

function calcFaturaCartao(cartaoId, mKey) {
  return gastos
    .filter(g => g.pagamento === "cartao" && g.cartaoId === cartaoId)
    .reduce((sum, g) => {
      const parcelas = g.parcelas || 1;
      for (let p = 0; p < parcelas; p++) {
        const parcData = addMonths(g.data, p);
        if (monthKey(parcData) === mKey) {
          sum += g.valor / parcelas;
        }
      }
      return sum;
    }, 0);
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function cartaoVencimentoMes(cartao, year, month) {
  const dia = Math.min(cartao.vencimento, lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
}

function renderUpcoming() {
  const container = document.getElementById("upcoming-list");
  const now = new Date();
  const plus7 = new Date(now.getTime() + 7 * 86400000);
  const items = [];

  for (const c of cartoes) {
    const dia = c.vencimento;
    const venc = new Date(now.getFullYear(), now.getMonth(), dia);
    if (venc < now) venc.setMonth(venc.getMonth() + 1);
    if (venc <= plus7) {
      const mKey = `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,"0")}`;
      const fatura = calcFaturaCartao(c.id, mKey);
      if (fatura > 0) {
        const daysLeft = Math.ceil((venc - now) / 86400000);
        items.push({ nome: `Fatura ${c.nome}`, valor: fatura, data: venc, daysLeft, tipo: "cartao", color: c.color });
      }
    }
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-check-circle"></i><p>Nenhum vencimento nos próximos 7 dias</p></div>`;
    return;
  }

  items.sort((a,b) => a.data - b.data);
  container.innerHTML = items.map(item => `
    <div class="upcoming-item">
      <div class="upcoming-icon" style="background:${item.color}22; color:${item.color}">
        <i class="fa-solid fa-credit-card"></i>
      </div>
      <div class="upcoming-info">
        <span class="upcoming-name">${item.nome}</span>
        <span class="upcoming-date">${item.data.toLocaleDateString("pt-BR")}</span>
      </div>
      <div class="upcoming-right">
        <span class="upcoming-value">${fmt(item.valor)}</span>
        <span class="upcoming-days ${item.daysLeft <= 2 ? "urgent" : ""}">${item.daysLeft === 0 ? "Hoje!" : item.daysLeft + "d"}</span>
      </div>
    </div>
  `).join("");
}

function renderRecent() {
  const container = document.getElementById("recent-transactions");
  const all = [
    ...receitas.map(r => ({ ...r, tipo: "receita" })),
    ...gastos.map(g => ({ ...g, tipo: "gasto" }))
  ].sort((a,b) => b.data.localeCompare(a.data)).slice(0, 8);

  if (all.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>Nenhuma movimentação ainda</p></div>`;
    return;
  }
  container.innerHTML = all.map(item => buildTransactionRow(item)).join("");
}

function buildTransactionRow(item) {
  const isReceita = item.tipo === "receita";
  const icon = isReceita
    ? `<i class="fa-solid fa-arrow-down" style="color:#10b981"></i>`
    : getCategoryIcon(item.categoria);
  const badge = isReceita
    ? `<span class="tx-badge income">Receita</span>`
    : `<span class="tx-badge expense">${payIcon(item.pagamento)} ${capitalize(item.pagamento || "")}</span>`;
  const valorClass = isReceita ? "tx-value income" : "tx-value expense";
  const sinal = isReceita ? "+" : "-";

  return `
    <div class="tx-row" data-id="${item.id}" data-tipo="${item.tipo}">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info">
        <span class="tx-name">${item.descricao}</span>
        <span class="tx-meta">${formatDateBR(item.data)} ${badge}</span>
        ${item.credor ? `<span class="tx-credor"><i class="fa-solid fa-user"></i> ${item.credor}</span>` : ""}
      </div>
      <div class="tx-right">
        <span class="${valorClass}">${sinal}${fmt(item.valor)}</span>
        <div class="tx-actions">
          <button class="icon-btn edit" onclick="editItem('${item.tipo}','${item.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn del" onclick="deleteItem('${item.tipo}','${item.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  `;
}

function getCategoryIcon(cat) {
  const icons = {
    alimentacao: `<i class="fa-solid fa-utensils" style="color:#f59e0b"></i>`,
    transporte:  `<i class="fa-solid fa-car" style="color:#0ea5e9"></i>`,
    moradia:     `<i class="fa-solid fa-house" style="color:#8b5cf6"></i>`,
    saude:       `<i class="fa-solid fa-heart-pulse" style="color:#ef4444"></i>`,
    lazer:       `<i class="fa-solid fa-gamepad" style="color:#ec4899"></i>`,
    educacao:    `<i class="fa-solid fa-graduation-cap" style="color:#6366f1"></i>`,
    roupas:      `<i class="fa-solid fa-shirt" style="color:#14b8a6"></i>`,
    tecnologia:  `<i class="fa-solid fa-laptop" style="color:#0ea5e9"></i>`,
    outro:       `<i class="fa-solid fa-ellipsis" style="color:#94a3b8"></i>`
  };
  return icons[cat] || icons.outro;
}

function payIcon(pay) {
  return pay === "cartao" ? '<i class="fa-solid fa-credit-card"></i>'
       : pay === "pix"    ? '<i class="fa-brands fa-pix"></i>'
       : '<i class="fa-solid fa-money-bill-wave"></i>';
}

const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

function formatDateBR(str) {
  if (!str) return "";
  const [y,m,d] = str.split("-");
  return `${d}/${m}/${y}`;
}

// ─── CHARTS ──────────────────────────────────────────────────
function renderChartReceitaGasto(year) {
  const ctx = document.getElementById("chart-receita-gasto").getContext("2d");
  if (charts.receitaGasto) charts.receitaGasto.destroy();

  const labels = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const recData = Array(12).fill(0);
  const gasData = Array(12).fill(0);

  for (const r of receitas) {
    const d = new Date(r.data + "T00:00:00");
    if (d.getFullYear() === year) recData[d.getMonth()] += r.valor;
  }
  for (const g of gastos) {
    const d = new Date(g.data + "T00:00:00");
    if (d.getFullYear() === year) gasData[d.getMonth()] += g.valor;
  }

  charts.receitaGasto = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Receitas", data: recData, backgroundColor: "rgba(16,185,129,0.8)", borderRadius: 8 },
        { label: "Gastos",   data: gasData, backgroundColor: "rgba(239,68,68,0.8)",  borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { y: { ticks: { callback: v => "R$" + (v/1000).toFixed(0) + "k" } } }
    }
  });
}

function renderChartCategorias(mKey) {
  const ctx = document.getElementById("chart-categorias").getContext("2d");
  if (charts.categorias) charts.categorias.destroy();

  const gastosMes = gastos.filter(g => monthKey(g.data) === mKey);
  const catMap = {};
  for (const g of gastosMes) {
    catMap[g.categoria || "outro"] = (catMap[g.categoria || "outro"] || 0) + g.valor;
  }

  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const catLabels = { alimentacao:"Alimentação", transporte:"Transporte", moradia:"Moradia",
    saude:"Saúde", lazer:"Lazer", educacao:"Educação", roupas:"Roupas", tecnologia:"Tecnologia", outro:"Outro" };
  const colors = ["#6366f1","#10b981","#f59e0b","#ef4444","#0ea5e9","#8b5cf6","#ec4899","#14b8a6","#94a3b8"];

  if (sorted.length === 0) {
    charts.categorias = new Chart(ctx, { type: "doughnut", data: { labels: ["Sem gastos"], datasets: [{ data: [1], backgroundColor: ["#e2e8f0"] }] }, options: { plugins: { legend: { position: "bottom" } } } });
    return;
  }

  charts.categorias = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(([k]) => catLabels[k] || k),
      datasets: [{ data: sorted.map(([,v]) => v), backgroundColor: colors.slice(0, sorted.length), borderWidth: 2, borderColor: "#ffffff" }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      }
    }
  });
}

// ─── RECEITAS ────────────────────────────────────────────────
function renderReceitas() {
  const totalRec   = receitas.reduce((s,r) => s + calcRendimento(r, today()), 0);
  const totalRend  = receitas.reduce((s,r) => s + (calcRendimento(r, today()) - r.valor), 0);
  const totalReser = receitas.filter(r => r.reserva).reduce((s,r) => s + calcRendimento(r, today()), 0);

  document.getElementById("rec-total").textContent      = fmt(totalRec);
  document.getElementById("rec-rendimentos").textContent = fmt(totalRend);
  document.getElementById("rec-reservas").textContent   = fmt(totalReser);

  const sel = document.getElementById("filter-receita-mes");
  const mFilter = sel.value || monthKey(today());
  const list = document.getElementById("receitas-list");

  const filtered = receitas.filter(r => !mFilter || monthKey(r.data) === mFilter);
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-arrow-trend-up"></i><p>Nenhuma receita neste mês</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(r => {
    const valorAtual = calcRendimento(r, today());
    const rendimento = valorAtual - r.valor;
    return `
    <div class="tx-row">
      <div class="tx-icon"><i class="fa-solid fa-arrow-down" style="color:#10b981"></i></div>
      <div class="tx-info">
        <span class="tx-name">${r.descricao}</span>
        <span class="tx-meta">${formatDateBR(r.data)}
          ${r.rendimento ? `<span class="tx-badge yield"><i class="fa-solid fa-seedling"></i> ${fmtPct(r.rendimento)}/dia</span>` : ""}
          ${r.reserva ? `<span class="tx-badge reserve"><i class="fa-solid fa-vault"></i> ${r.reservaNome || "Reserva"}</span>` : ""}
        </span>
        ${r.rendimento ? `<span class="tx-yield">Rendimento acumulado: +${fmt(rendimento)}</span>` : ""}
        ${r.obs ? `<span class="tx-obs">${r.obs}</span>` : ""}
      </div>
      <div class="tx-right">
        <span class="tx-value income">${fmt(valorAtual)}</span>
        <span class="tx-original">Original: ${fmt(r.valor)}</span>
        <div class="tx-actions">
          <button class="icon-btn edit" onclick="editItem('receita','${r.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn del" onclick="deleteItem('receita','${r.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ─── GASTOS ──────────────────────────────────────────────────
function renderGastos() {
  const totalG   = gastos.reduce((s,g) => s + g.valor, 0);
  const cartaoG  = gastos.filter(g => g.pagamento === "cartao").reduce((s,g) => s + g.valor, 0);
  const outrosG  = gastos.filter(g => g.pagamento !== "cartao").reduce((s,g) => s + g.valor, 0);

  document.getElementById("gasto-total").textContent  = fmt(totalG);
  document.getElementById("gasto-cartao").textContent = fmt(cartaoG);
  document.getElementById("gasto-outros").textContent = fmt(outrosG);

  const sel     = document.getElementById("filter-gasto-mes");
  const selTipo = document.getElementById("filter-gasto-tipo");
  const mFilter = sel.value || "";
  const tFilter = selTipo.value || "";

  let filtered = gastos;
  if (mFilter) filtered = filtered.filter(g => monthKey(g.data) === mFilter);
  if (tFilter) filtered = filtered.filter(g => g.pagamento === tFilter);

  const list = document.getElementById("gastos-list");
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i><p>Nenhum gasto encontrado</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(g => buildGastoRow(g)).join("");
}

function buildGastoRow(g) {
  const cartao = cartoes.find(c => c.id === g.cartaoId);
  const parcInfo = g.parcelas > 1 ? `<span class="tx-badge info">${g.parcelas}x ${fmt(g.valor/g.parcelas)}</span>` : "";
  const cartaoInfo = cartao ? `<span class="tx-badge" style="background:${cartao.color}22;color:${cartao.color}"><i class="fa-solid fa-credit-card"></i> ${cartao.nome}</span>` : "";
  return `
  <div class="tx-row">
    <div class="tx-icon">${getCategoryIcon(g.categoria)}</div>
    <div class="tx-info">
      <span class="tx-name">${g.descricao}</span>
      <span class="tx-meta">${formatDateBR(g.data)}
        <span class="tx-badge expense">${payIcon(g.pagamento)} ${capitalize(g.pagamento)}</span>
        ${cartaoInfo} ${parcInfo}
        ${g.credor ? `<span class="tx-badge creditor"><i class="fa-solid fa-user"></i> ${g.credor}</span>` : ""}
      </span>
      ${g.obs ? `<span class="tx-obs">${g.obs}</span>` : ""}
    </div>
    <div class="tx-right">
      <span class="tx-value expense">-${fmt(g.valor)}</span>
      <div class="tx-actions">
        <button class="icon-btn edit" onclick="editItem('gasto','${g.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn del" onclick="deleteItem('gasto','${g.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

// ─── RESERVAS ────────────────────────────────────────────────
function renderReservas() {
  const grid = document.getElementById("reservas-grid");
  if (reservas.length === 0) {
    grid.innerHTML = `<div class="empty-state full"><i class="fa-solid fa-piggy-bank"></i><p>Nenhuma reserva criada ainda</p></div>`;
    return;
  }
  const iconMap = { "piggy-bank":"🐷","plane":"✈️","house":"🏠","car":"🚗","graduation-cap":"🎓","heart":"❤️","gem":"💎","shield-halved":"🛡️" };
  grid.innerHTML = reservas.map(res => {
    // Soma receitas vinculadas a esta reserva
    const saldoRes = receitas
      .filter(r => r.reserva && r.reservaNome === res.nome)
      .reduce((s,r) => s + calcRendimento(r, today()), 0);
    const pct = res.meta > 0 ? Math.min((saldoRes / res.meta) * 100, 100) : 0;
    return `
    <div class="reserva-card" style="border-top:4px solid ${res.cor || "#10b981"}">
      <div class="reserva-header">
        <span class="reserva-icon">${iconMap[res.icone] || "💰"}</span>
        <div class="reserva-title">
          <h3>${res.nome}</h3>
          ${res.meta ? `<span class="reserva-meta">Meta: ${fmt(res.meta)}</span>` : ""}
        </div>
        <div class="reserva-actions">
          <button class="icon-btn edit" onclick="editReserva('${res.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn del"  onclick="deleteItem('reserva','${res.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="reserva-saldo">${fmt(saldoRes)}</div>
      ${res.meta ? `
      <div class="reserva-progress">
        <div class="budget-bar-bg small">
          <div class="budget-bar-fill" style="width:${pct}%; background:${res.cor || "#10b981"}"></div>
        </div>
        <span>${pct.toFixed(1)}% da meta</span>
      </div>` : ""}
    </div>`;
  }).join("");
}

// ─── CARTÕES ─────────────────────────────────────────────────
function renderCartoes() {
  const grid = document.getElementById("cartoes-grid");
  const now  = new Date();
  if (cartoes.length === 0) {
    grid.innerHTML = `<div class="empty-state full"><i class="fa-solid fa-credit-card"></i><p>Nenhum cartão cadastrado ainda</p></div>`;
    return;
  }
  grid.innerHTML = cartoes.map(c => {
    const mKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const fatura = calcFaturaCartao(c.id, mKey);
    const pct = c.limite > 0 ? Math.min((fatura / c.limite) * 100, 100) : 0;
    const dia = c.vencimento;
    const venc = new Date(now.getFullYear(), now.getMonth(), dia);
    if (venc < now) venc.setMonth(venc.getMonth() + 1);
    const daysLeft = Math.ceil((venc - now) / 86400000);
    // Transações do cartão neste mês
    const txCartao = gastos.filter(g => g.pagamento === "cartao" && g.cartaoId === c.id && monthKey(g.data) === mKey);

    return `
    <div class="cartao-card">
      <div class="cartao-visual" style="background: linear-gradient(135deg, ${c.color}, ${adjustColor(c.color, -40)})">
        <div class="cartao-top">
          <span class="cartao-name">${c.nome}</span>
          <i class="fa-solid fa-credit-card cartao-chip"></i>
        </div>
        <div class="cartao-fatura">
          <span class="cartao-fatura-label">Fatura atual</span>
          <span class="cartao-fatura-val">${fmt(fatura)}</span>
        </div>
        <div class="cartao-bottom">
          <span>Vence em ${daysLeft}d · Dia ${c.vencimento}</span>
          ${c.limite ? `<span>${fmt(c.limite - fatura)} disponível</span>` : ""}
        </div>
      </div>
      ${c.limite ? `
      <div class="cartao-progress">
        <div class="budget-bar-bg small">
          <div class="budget-bar-fill ${pct > 80 ? "danger" : pct > 60 ? "warning" : ""}" style="width:${pct}%"></div>
        </div>
        <span class="budget-percent">${pct.toFixed(1)}% do limite (${fmt(c.limite)})</span>
      </div>` : ""}
      <div class="cartao-tx-list">
        <h4>Lançamentos do mês</h4>
        ${txCartao.length === 0
          ? `<div class="empty-state small"><p>Nenhum lançamento</p></div>`
          : txCartao.map(g => `
            <div class="cartao-tx">
              <span>${g.descricao}</span>
              ${g.parcelas > 1 ? `<span class="tx-badge info">${g.parcelas}x</span>` : ""}
              <span class="tx-value expense">-${fmt(g.valor)}</span>
            </div>`).join("")
        }
      </div>
      <div class="cartao-card-actions">
        <button class="icon-btn edit" onclick="editCartao('${c.id}')"><i class="fa-solid fa-pen"></i> Editar</button>
        <button class="icon-btn del"  onclick="deleteItem('cartao','${c.id}')"><i class="fa-solid fa-trash"></i> Excluir</button>
      </div>
    </div>`;
  }).join("");
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ─── RELATÓRIOS ──────────────────────────────────────────────
function renderRelatorios() {
  renderChartEvolucao();
  renderChartTopCategorias();
  renderChartPagamento();
}

function renderChartEvolucao() {
  const ctx = document.getElementById("chart-evolucao").getContext("2d");
  if (charts.evolucao) charts.evolucao.destroy();

  const now = new Date();
  const labels = [];
  const data   = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    labels.push(d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }));
    const rec = receitas.filter(r => monthKey(r.data) <= mKey).reduce((s,r) => s + r.valor, 0);
    const gas = gastos.filter(g => monthKey(g.data) <= mKey).reduce((s,g) => s + g.valor, 0);
    data.push(rec - gas);
  }

  charts.evolucao = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Saldo Acumulado",
        data,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.12)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#6366f1",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { y: { ticks: { callback: v => fmt(v) } } }
    }
  });
}

function renderChartTopCategorias() {
  const ctx = document.getElementById("chart-top-categorias").getContext("2d");
  if (charts.topCat) charts.topCat.destroy();

  const catMap = {};
  const catLabels = { alimentacao:"Alimentação", transporte:"Transporte", moradia:"Moradia",
    saude:"Saúde", lazer:"Lazer", educacao:"Educação", roupas:"Roupas", tecnologia:"Tecnologia", outro:"Outro" };
  for (const g of gastos) catMap[g.categoria || "outro"] = (catMap[g.categoria || "outro"] || 0) + g.valor;
  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 8);

  charts.topCat = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(([k]) => catLabels[k] || k),
      datasets: [{ label: "Total", data: sorted.map(([,v]) => v), backgroundColor: ["#6366f1","#10b981","#f59e0b","#ef4444","#0ea5e9","#8b5cf6","#ec4899","#14b8a6"], borderRadius: 6 }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => fmt(ctx.raw) } } },
      scales: { x: { ticks: { callback: v => fmt(v) } } }
    }
  });
}

function renderChartPagamento() {
  const ctx = document.getElementById("chart-pagamento").getContext("2d");
  if (charts.pagamento) charts.pagamento.destroy();

  const map = { cartao: 0, pix: 0, dinheiro: 0 };
  for (const g of gastos) map[g.pagamento] = (map[g.pagamento] || 0) + g.valor;

  charts.pagamento = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Cartão", "Pix", "Dinheiro"],
      datasets: [{ data: [map.cartao, map.pix, map.dinheiro], backgroundColor: ["#6366f1","#10b981","#f59e0b"], borderWidth: 2, borderColor: "#fff" }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } }
    }
  });
}

// ─── BADGES & NOTIFICAÇÕES ───────────────────────────────────
function updateBadges() {
  document.getElementById("badge-receitas").textContent = receitas.length;
  document.getElementById("badge-gastos").textContent   = gastos.length;
}

function updateNotifications() {
  const notifs = [];
  const now = new Date();

  for (const c of cartoes) {
    const venc = new Date(now.getFullYear(), now.getMonth(), c.vencimento);
    if (venc < now) venc.setMonth(venc.getMonth() + 1);
    const daysLeft = Math.ceil((venc - now) / 86400000);
    if (daysLeft <= 5) {
      const mKey = `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,"0")}`;
      const fatura = calcFaturaCartao(c.id, mKey);
      if (fatura > 0)
        notifs.push({ msg: `Fatura ${c.nome} vence em ${daysLeft} dia(s): ${fmt(fatura)}`, tipo: daysLeft <= 2 ? "error" : "warning" });
    }
  }

  const dot = document.getElementById("notif-dot");
  dot.style.display = notifs.length > 0 ? "block" : "none";

  const list = document.getElementById("notif-list");
  list.innerHTML = notifs.length === 0
    ? `<div class="empty-state"><p>Nenhuma notificação</p></div>`
    : notifs.map(n => `<div class="notif-item ${n.tipo}"><i class="fa-solid fa-bell"></i><span>${n.msg}</span></div>`).join("");
}

// ─── RENDIMENTO DIÁRIO ────────────────────────────────────────
async function setupYieldUpdater() {
  const todayStr = today();
  if (!isBusinessDay(todayStr)) return;

  const userDocRef = userRef();
  const snap = await getDoc(userDocRef);
  const lastUpdate = snap.exists() ? snap.data().lastYieldUpdate : null;
  if (lastUpdate === todayStr) return; // Já atualizou hoje

  let updated = false;
  for (const r of receitas) {
    if (!r.rendimento || r.rendimento <= 0) continue;
    // Não atualiza o valor original, apenas registra que o rendimento foi aplicado
    // O valor atual é sempre calculado em runtime com calcRendimento()
    // Mas aqui marcamos a última atualização
    updated = true;
  }

  if (updated) {
    await setDoc(userDocRef, { lastYieldUpdate: todayStr }, { merge: true });
    showToast("Rendimentos atualizados para hoje (dia útil)", "info");
  }
}

// ─── MODALS ───────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

function populateMonthSelects() {
  const now = new Date();
  const opts = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const lab = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    opts.push(`<option value="${val}" ${i === 0 ? "selected" : ""}>${lab}</option>`);
  }
  ["filter-receita-mes","filter-gasto-mes","dash-month-select"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts.join("");
  });
}

// ─── SALVAR RECEITA ──────────────────────────────────────────
async function saveReceita() {
  const id     = document.getElementById("rec-edit-id").value;
  const data   = {
    descricao:   document.getElementById("rec-descricao").value.trim(),
    valor:       parseFloat(document.getElementById("rec-valor").value),
    data:        document.getElementById("rec-data").value,
    rendimento:  parseFloat(document.getElementById("rec-rendimento").value) || 0,
    reserva:     document.getElementById("rec-reserva").checked,
    reservaNome: document.getElementById("rec-reserva-nome").value || "",
    obs:         document.getElementById("rec-obs").value.trim(),
    updatedAt:   new Date().toISOString()
  };

  if (!data.descricao || !data.valor || !data.data) { showToast("Preencha todos os campos obrigatórios", "error"); return; }

  try {
    if (id) {
      await updateDoc(doc(receitasRef(), id), data);
      showToast("Receita atualizada!", "success");
    } else {
      data.criadoEm = new Date().toISOString();
      await addDoc(receitasRef(), data);
      showToast("Receita cadastrada!", "success");
    }
    closeModal("modal-receita");
    await loadReceitas();
    renderAll();
  } catch (e) { showToast("Erro ao salvar: " + e.message, "error"); }
}

// ─── SALVAR GASTO ────────────────────────────────────────────
async function saveGasto() {
  const id     = document.getElementById("gas-edit-id").value;
  const temCredor = document.getElementById("gas-tem-credor").checked;
  const data   = {
    descricao:  document.getElementById("gas-descricao").value.trim(),
    valor:      parseFloat(document.getElementById("gas-valor").value),
    data:       document.getElementById("gas-data").value,
    categoria:  document.getElementById("gas-categoria").value,
    pagamento:  document.getElementById("gas-pagamento").value,
    cartaoId:   document.getElementById("gas-cartao-id").value || null,
    parcelas:   parseInt(document.getElementById("gas-parcelas").value) || 1,
    credor:     temCredor ? document.getElementById("gas-credor").value.trim() : "",
    credorContato: temCredor ? document.getElementById("gas-credor-contato").value.trim() : "",
    obs:        document.getElementById("gas-obs").value.trim(),
    updatedAt:  new Date().toISOString()
  };

  if (!data.descricao || !data.valor || !data.data) { showToast("Preencha todos os campos obrigatórios", "error"); return; }

  try {
    if (id) {
      await updateDoc(doc(gastosRef(), id), data);
      showToast("Gasto atualizado!", "success");
    } else {
      data.criadoEm = new Date().toISOString();
      await addDoc(gastosRef(), data);
      showToast("Gasto cadastrado!", "success");
    }
    closeModal("modal-gasto");
    await loadGastos();
    renderAll();
  } catch (e) { showToast("Erro ao salvar: " + e.message, "error"); }
}

// ─── SALVAR CARTÃO ───────────────────────────────────────────
async function saveCartao() {
  const id  = document.getElementById("cart-edit-id").value;
  const data = {
    nome:       document.getElementById("cart-nome").value.trim(),
    limite:     parseFloat(document.getElementById("cart-limite").value) || 0,
    vencimento: parseInt(document.getElementById("cart-vencimento").value),
    color:      document.getElementById("cart-color").value
  };
  if (!data.nome || !data.vencimento) { showToast("Preencha nome e dia de vencimento", "error"); return; }

  try {
    if (id) {
      await updateDoc(doc(cartoesRef(), id), data);
      showToast("Cartão atualizado!", "success");
    } else {
      await addDoc(cartoesRef(), data);
      showToast("Cartão cadastrado!", "success");
    }
    closeModal("modal-cartao");
    await loadCartoes();
    renderAll();
  } catch (e) { showToast("Erro ao salvar: " + e.message, "error"); }
}

// ─── SALVAR RESERVA ──────────────────────────────────────────
async function saveReserva() {
  const id  = document.getElementById("res-edit-id").value;
  const data = {
    nome:   document.getElementById("res-nome").value.trim(),
    meta:   parseFloat(document.getElementById("res-meta").value) || 0,
    icone:  document.getElementById("res-icone").value,
    cor:    document.getElementById("res-color").value
  };
  if (!data.nome) { showToast("Informe o nome da reserva", "error"); return; }

  try {
    if (id) {
      await updateDoc(doc(reservasRef(), id), data);
      showToast("Reserva atualizada!", "success");
    } else {
      await addDoc(reservasRef(), data);
      showToast("Reserva criada!", "success");
    }
    closeModal("modal-reserva");
    await loadReservas();
    renderAll();
  } catch (e) { showToast("Erro ao salvar: " + e.message, "error"); }
}

// ─── EDITAR ──────────────────────────────────────────────────
window.editItem = async (tipo, id) => {
  if (tipo === "receita") editReceita(id);
  else if (tipo === "gasto") editGasto(id);
};

window.editCartao = (id) => {
  const c = cartoes.find(x => x.id === id);
  if (!c) return;
  document.getElementById("cart-edit-id").value = id;
  document.getElementById("cart-nome").value       = c.nome;
  document.getElementById("cart-limite").value     = c.limite || "";
  document.getElementById("cart-vencimento").value = c.vencimento;
  document.getElementById("cart-color").value      = c.color || "#6366f1";
  document.querySelectorAll("#cart-color-picker .color-opt").forEach(el => {
    el.classList.toggle("active", el.dataset.color === c.color);
  });
  openModal("modal-cartao");
};

window.editReserva = (id) => {
  const r = reservas.find(x => x.id === id);
  if (!r) return;
  document.getElementById("res-edit-id").value = id;
  document.getElementById("res-nome").value    = r.nome;
  document.getElementById("res-meta").value    = r.meta || "";
  document.getElementById("res-icone").value   = r.icone;
  document.getElementById("res-color").value   = r.cor || "#10b981";
  document.querySelectorAll("#res-color-picker .color-opt").forEach(el => {
    el.classList.toggle("active", el.dataset.color === r.cor);
  });
  openModal("modal-reserva");
};

function editReceita(id) {
  const r = receitas.find(x => x.id === id);
  if (!r) return;
  document.getElementById("rec-edit-id").value    = id;
  document.getElementById("rec-descricao").value  = r.descricao;
  document.getElementById("rec-valor").value      = r.valor;
  document.getElementById("rec-data").value       = r.data;
  document.getElementById("rec-rendimento").value = r.rendimento || "";
  document.getElementById("rec-reserva").checked  = r.reserva || false;
  document.getElementById("rec-obs").value        = r.obs || "";
  if (r.reserva) {
    document.getElementById("reserva-select-wrapper").classList.remove("hidden");
    populateReservaSelect();
    document.getElementById("rec-reserva-nome").value = r.reservaNome || "";
  }
  document.getElementById("modal-receita-title").innerHTML = '<i class="fa-solid fa-pen"></i> Editar Receita';
  openModal("modal-receita");
}

function editGasto(id) {
  const g = gastos.find(x => x.id === id);
  if (!g) return;
  document.getElementById("gas-edit-id").value      = id;
  document.getElementById("gas-descricao").value    = g.descricao;
  document.getElementById("gas-valor").value        = g.valor;
  document.getElementById("gas-data").value         = g.data;
  document.getElementById("gas-categoria").value    = g.categoria || "alimentacao";
  document.getElementById("gas-pagamento").value    = g.pagamento || "cartao";
  document.getElementById("gas-obs").value          = g.obs || "";
  document.getElementById("gas-parcelas").value     = g.parcelas || 1;

  // Update category buttons
  document.querySelectorAll(".cat-btn").forEach(el => el.classList.toggle("active", el.dataset.cat === g.categoria));
  document.querySelectorAll(".pay-tab").forEach(el => el.classList.toggle("active", el.dataset.pay === g.pagamento));

  if (g.pagamento === "cartao") {
    document.getElementById("cartao-fields").style.display = "block";
    populateCartaoSelect();
    document.getElementById("gas-cartao-id").value = g.cartaoId || "";
  } else {
    document.getElementById("cartao-fields").style.display = "none";
  }

  if (g.credor) {
    document.getElementById("gas-tem-credor").checked = true;
    document.getElementById("credor-wrapper").classList.remove("hidden");
    document.getElementById("gas-credor").value         = g.credor;
    document.getElementById("gas-credor-contato").value = g.credorContato || "";
  }

  document.getElementById("modal-gasto-title").innerHTML = '<i class="fa-solid fa-pen"></i> Editar Gasto';
  openModal("modal-gasto");
}

// ─── EXCLUIR ─────────────────────────────────────────────────
window.deleteItem = (tipo, id) => {
  confirmCallback = async () => {
    try {
      const refs = { receita: receitasRef(), gasto: gastosRef(), reserva: reservasRef(), cartao: cartoesRef() };
      await deleteDoc(doc(refs[tipo], id));
      showToast("Excluído com sucesso!", "success");
      await loadAll();
    } catch (e) { showToast("Erro ao excluir: " + e.message, "error"); }
    closeModal("modal-confirm");
  };
  openModal("modal-confirm");
};

// ─── NAVEGAÇÃO ───────────────────────────────────────────────
function navigateTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.remove("hidden");
  if (navEl) navEl.classList.add("active");

  const titles = { dashboard:"Dashboard", receitas:"Receitas", gastos:"Gastos", reservas:"Reservas", cartoes:"Cartões", relatorios:"Relatórios" };
  document.getElementById("page-title").textContent = titles[page] || page;

  if (page === "relatorios") renderRelatorios();
  closeSidebarMobile();
}

function closeSidebarMobile() {
  if (window.innerWidth < 768) {
    document.getElementById("sidebar").classList.remove("open");
  }
}

// ─── HELPERS DE MODAL ────────────────────────────────────────
function resetModalReceita() {
  document.getElementById("form-receita").reset();
  document.getElementById("rec-edit-id").value = "";
  document.getElementById("reserva-select-wrapper").classList.add("hidden");
  document.getElementById("modal-receita-title").innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> Nova Receita';
  populateReservaSelect();
}

function resetModalGasto() {
  document.getElementById("form-gasto").reset();
  document.getElementById("gas-edit-id").value = "";
  document.getElementById("gas-categoria").value  = "alimentacao";
  document.getElementById("gas-pagamento").value  = "cartao";
  document.querySelectorAll(".cat-btn").forEach((el,i) => el.classList.toggle("active", i===0));
  document.querySelectorAll(".pay-tab").forEach((el,i) => el.classList.toggle("active", i===0));
  document.getElementById("cartao-fields").style.display = "block";
  document.getElementById("credor-wrapper").classList.add("hidden");
  document.getElementById("gas-tem-credor").checked = false;
  document.getElementById("modal-gasto-title").innerHTML = '<i class="fa-solid fa-arrow-trend-down"></i> Novo Gasto';
  populateCartaoSelect();
}

function populateReservaSelect() {
  const sel = document.getElementById("rec-reserva-nome");
  sel.innerHTML = `<option value="">Selecione uma reserva</option>` +
    reservas.map(r => `<option value="${r.nome}">${r.nome}</option>`).join("");
}

function populateCartaoSelect() {
  const sel = document.getElementById("gas-cartao-id");
  sel.innerHTML = cartoes.length === 0
    ? `<option value="">Nenhum cartão cadastrado</option>`
    : cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
}

// ─── BIND UI EVENTS ──────────────────────────────────────────
function bindUIEvents() {
  // Login
  document.getElementById("google-login-btn").addEventListener("click", () => window.FinanceAuth.loginGoogle());

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await window.FinanceAuth.logout();
    showToast("Até logo!", "info");
  });

  // Navegação
  document.querySelectorAll(".nav-item[data-page]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); navigateTo(el.dataset.page); });
  });
  document.querySelectorAll("[data-page]").forEach(el => {
    if (!el.classList.contains("nav-item"))
      el.addEventListener("click", e => { e.preventDefault(); navigateTo(el.dataset.page); });
  });

  // Sidebar toggle
  document.getElementById("mobile-menu-btn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Fechar modals
  document.querySelectorAll(".modal-close, [data-modal]").forEach(el => {
    el.addEventListener("click", () => closeModal(el.dataset.modal || el.closest(".modal-overlay")?.id));
  });
  document.querySelectorAll(".modal-overlay").forEach(el => {
    el.addEventListener("click", e => { if (e.target === el) closeModal(el.id); });
  });

  // Confirm
  document.getElementById("btn-confirm-ok").addEventListener("click", () => { if (confirmCallback) confirmCallback(); });

  // Nova receita
  document.getElementById("btn-add-receita").addEventListener("click", () => { resetModalReceita(); openModal("modal-receita"); });
  document.getElementById("btn-save-receita").addEventListener("click", saveReceita);

  // Nova gasto
  document.getElementById("btn-add-gasto").addEventListener("click", () => { resetModalGasto(); openModal("modal-gasto"); });
  document.getElementById("btn-save-gasto").addEventListener("click", saveGasto);

  // Novo cartão
  document.getElementById("btn-add-cartao").addEventListener("click", () => {
    document.getElementById("form-cartao").reset();
    document.getElementById("cart-edit-id").value = "";
    openModal("modal-cartao");
  });
  document.getElementById("btn-save-cartao").addEventListener("click", saveCartao);

  // Nova reserva
  document.getElementById("btn-add-reserva").addEventListener("click", () => {
    document.getElementById("form-reserva").reset();
    document.getElementById("res-edit-id").value = "";
    openModal("modal-reserva");
  });
  document.getElementById("btn-save-reserva").addEventListener("click", saveReserva);

  // Toggle reserva no modal receita
  document.getElementById("rec-reserva").addEventListener("change", e => {
    document.getElementById("reserva-select-wrapper").classList.toggle("hidden", !e.target.checked);
    if (e.target.checked) populateReservaSelect();
  });

  // Toggle credor no modal gasto
  document.getElementById("gas-tem-credor").addEventListener("change", e => {
    document.getElementById("credor-wrapper").classList.toggle("hidden", !e.target.checked);
  });

  // Categoria buttons
  document.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("gas-categoria").value = btn.dataset.cat;
    });
  });

  // Pagamento tabs
  document.querySelectorAll(".pay-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".pay-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("gas-pagamento").value = tab.dataset.pay;
      document.getElementById("cartao-fields").style.display = tab.dataset.pay === "cartao" ? "block" : "none";
    });
  });

  // Color pickers
  document.querySelectorAll(".color-picker").forEach(picker => {
    picker.querySelectorAll(".color-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        picker.querySelectorAll(".color-opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        const hiddenInput = picker.nextElementSibling;
        if (hiddenInput && hiddenInput.type === "hidden") hiddenInput.value = opt.dataset.color;
      });
    });
  });

  // Filters
  document.getElementById("filter-receita-mes").addEventListener("change", renderReceitas);
  document.getElementById("filter-gasto-mes").addEventListener("change",   renderGastos);
  document.getElementById("filter-gasto-tipo").addEventListener("change",  renderGastos);
  document.getElementById("dash-month-select").addEventListener("change", () => {
    renderDashboard();
  });

  // Notificações
  document.getElementById("notif-btn").addEventListener("click", () => {
    document.getElementById("notif-panel").classList.toggle("hidden");
  });
  document.getElementById("close-notif").addEventListener("click", () => {
    document.getElementById("notif-panel").classList.add("hidden");
  });

  // Form submits com Enter
  document.querySelectorAll("form").forEach(f => f.addEventListener("submit", e => e.preventDefault()));
}

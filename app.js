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
let pagamentosAntecipados = [];
let salarioConfig     = null;
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
const pagAntecRef  = () => collection(db, "users", currentUser.uid, "pagamentosAntecipados");
const salarioRef   = () => doc(db, "users", currentUser.uid, "config", "salarioMensal");

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
  document.getElementById("user-photo").src = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "U") + "&background=3b82f6&color=fff";
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
  await Promise.all([loadReceitas(), loadGastos(), loadReservas(), loadCartoes(), loadPagamentosAntecipados(), loadSalarioConfig()]);
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

async function loadPagamentosAntecipados() {
  const snap = await getDocs(pagAntecRef());
  pagamentosAntecipados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadSalarioConfig() {
  try {
    const snap = await getDoc(salarioRef());
    salarioConfig = snap.exists() ? snap.data() : null;
  } catch { salarioConfig = null; }
}

// Retorna o último dia útil (Seg–Sex) de um mês
function lastBusinessDayOfMonth(year, month) {
  // month: 1-based
  let d = new Date(year, month, 0); // último dia do mês
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d; // objeto Date
}

// Retorna o valor do salário que deve ser contabilizado em um dado mês (YYYY-MM)
function getSalaryForMonth(mKey) {
  if (!salarioConfig || !salarioConfig.ativo || !salarioConfig.valor) return 0;
  const [y, m] = mKey.split("-").map(Number);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const payDate = lastBusinessDayOfMonth(y, m);
  payDate.setHours(0, 0, 0, 0);
  // Só contabiliza se o dia de pagamento já chegou ou passou
  return now >= payDate ? salarioConfig.valor : 0;
}

// ─── Render Geral ─────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderReceitas();
  renderSalarioConfig();
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

  // Salário mensal: somar apenas se o dia de recebimento já passou neste mês
  const salarioMes = getSalaryForMonth(mKey);
  saldoTotal += salarioMes;

  // Gastos do mês: parcelas com vencimento neste mês (respeitando data de vencimento do cartão) + pix/dinheiro do mês
  const totalGastosMes = calcGastosMes(mKey);
  const gastosPrevistosAteFinsMes = totalGastosMes;

  const saldoLivre = saldoTotal - gastosPrevistosAteFinsMes;

  // Cartão pendente: faturas do mês cujo vencimento ainda não passou
  let pendente = 0;
  for (const c of cartoes) {
    const fatura = calcFaturaCartao(c.id, mKey);
    if (!isFaturaVencida(c, mKey)) pendente += fatura;
  }

  // Update UI
  document.getElementById("dash-saldo").textContent     = fmt(saldoTotal);
  document.getElementById("dash-saldo-rendimento").textContent =
    totalRendimentos > 0
      ? `+${fmt(totalRendimentos)} em rendimentos`
      : receitas.length > 0 ? `${receitas.length} ${receitas.length === 1 ? "entrada" : "entradas"} registradas` : "Nenhuma receita ainda";

  document.getElementById("dash-gastos").textContent    = fmt(gastosPrevistosAteFinsMes);
  const gastosSub = document.getElementById("dash-gastos-previstos");
  if (gastosSub) {
    const nGastosMes = gastos.filter(g => {
      const parcelas = g.parcelas || 1;
      if (g.pagamento !== "cartao") return parcelas === 1 && monthKey(g.data) === mKey;
      const cartao = cartoes.find(c => c.id === g.cartaoId);
      for (let i = 0; i < parcelas; i++) if (getInstallmentBudgetMonth(g, cartao, i) === mKey) return true;
      return false;
    }).length;
    gastosSub.textContent = nGastosMes > 0
      ? `${nGastosMes} ${nGastosMes === 1 ? "lançamento" : "lançamentos"} no mês`
      : "Nenhum gasto neste mês";
  }

  document.getElementById("dash-livre").textContent     = fmt(saldoLivre);
  const livreSub = document.getElementById("dash-livre-sub");
  if (livreSub) {
    const pctLivre = saldoTotal > 0 ? ((saldoLivre / saldoTotal) * 100) : 0;
    livreSub.textContent = saldoLivre >= 0
      ? `${pctLivre.toFixed(0)}% do saldo disponível`
      : "Gastos acima do saldo";
    livreSub.style.color = saldoLivre < 0 ? "var(--danger)" : "";
  }

  document.getElementById("dash-pendente").textContent  = fmt(pendente);
  const pendenteSub = document.getElementById("dash-pendente-sub");
  if (pendenteSub) {
    const nCartoesPendentes = cartoes.filter(c => !isFaturaVencida(c, mKey) && calcFaturaCartao(c.id, mKey) > 0).length;
    pendenteSub.textContent = nCartoesPendentes > 0
      ? `${nCartoesPendentes} ${nCartoesPendentes === 1 ? "cartão" : "cartões"} com fatura em aberto`
      : pendente > 0 ? "Fatura a vencer este mês" : "Nenhuma fatura pendente";
  }

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
  // Taxa: própria da receita (legado) OU da caixinha vinculada
  let taxa = receita.rendimento || 0;
  if (!taxa && receita.reserva && receita.reservaNome) {
    const res = reservas.find(r => r.nome === receita.reservaNome);
    if (res) taxa = res.rendimento || 0;
  }
  if (!taxa || taxa <= 0) return receita.valor;
  const start = receita.data;
  if (start >= upToDate) return receita.valor;
  const bd = businessDaysBetween(start, upToDate);
  // Rendimento composto diário
  return receita.valor * Math.pow(1 + taxa / 100, bd);
}

function calcFaturaCartao(cartaoId, mKey) {
  const cartao = cartoes.find(c => c.id === cartaoId);
  return gastos
    .filter(g => g.pagamento === "cartao" && g.cartaoId === cartaoId)
    .reduce((sum, g) => {
      const parcelas = g.parcelas || 1;
      for (let i = 0; i < parcelas; i++) {
        if (getInstallmentDueMonth(g, cartao, i) === mKey) {
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

// Retorna o mês de vencimento (YYYY-MM) de uma parcela (índice 0-base)
// Se gasto.parcelaInicio (YYYY-MM) estiver definido, usa-o como mês base da 1ª parcela
// Caso contrário: regra padrão por data de compra vs dia de vencimento do cartão
function getInstallmentDueMonth(gasto, cartao, index) {
  if (gasto.parcelaInicio) {
    // parcelaInicio = "YYYY-MM" → 1ª parcela nesse mês, demais seguem em sequência
    const [y, m] = gasto.parcelaInicio.split("-").map(Number);
    const d = new Date(y, m - 1 + index, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  const purchaseDate = new Date(gasto.data + "T00:00:00");
  const purchaseDay  = purchaseDate.getDate();
  const dueDay       = cartao ? cartao.vencimento : 1;
  let baseYear  = purchaseDate.getFullYear();
  let baseMonth = purchaseDate.getMonth(); // 0-indexed
  if (purchaseDay > dueDay) {
    baseMonth++;
    if (baseMonth > 11) { baseMonth = 0; baseYear++; }
  }
  const d = new Date(baseYear, baseMonth + index, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

// Retorna o mês de COMPETÊNCIA orçamentária de uma parcela.
// Quando parcelaInicio está definido e é posterior ao mês da compra, a parcela
// vence no mês seguinte ao que o usuário precisa reservar o dinheiro.
// Ex.: compra em fev, parcelaInicio=mar → competência da parcela 1 = fev, 2 = mar, etc.
// Sem parcelaInicio: competência = vencimento (sem deslocamento).
function getInstallmentBudgetMonth(gasto, cartao, index) {
  const dueKey = getInstallmentDueMonth(gasto, cartao, index);
  if (!gasto.parcelaInicio) return dueKey;
  // Verifica se parcelaInicio é posterior ao mês da compra
  const buyKey = monthKey(gasto.data);
  if (gasto.parcelaInicio > buyKey) {
    // Desloca 1 mês para trás: parcela que vence em março conta em fevereiro
    const [y, m] = dueKey.split("-").map(Number);
    const d = new Date(y, m - 2, 1); // -2 porque m é 1-indexed
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  }
  return dueKey;
}

// Verifica se a fatura de um cartão para um mês específico já venceu
function isFaturaVencida(cartao, mKey) {
  const [y, m] = mKey.split("-").map(Number);
  const dueDate = new Date(y, m - 1, cartao.vencimento || 1);
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  return agora > dueDate;
}

// Total de gastos efetivos num mês (competência): ALL gastos pelo mês de competência orçam.
// Gastos de cartão parcelados: usa getInstallmentBudgetMonth.
// Gastos pix/dinheiro parcelados com parcelaInicio: também usa deslocamento.
// Gastos pix/dinheiro sem parcelas: data da compra.
function calcGastosMes(mKey) {
  let total = 0;
  for (const g of gastos) {
    const parcelas = g.parcelas || 1;
    if (g.pagamento !== "cartao") {
      if (parcelas === 1) {
        // sem parcelas: data de compra é a competência
        if (monthKey(g.data) === mKey) total += g.valor;
      } else {
        // parcelado pix/dinheiro: distribui pelas parcelas usando mesma lógica
        const valorParc = g.valor / parcelas;
        for (let i = 0; i < parcelas; i++) {
          const budgetKey = getInstallmentBudgetMonth(g, null, i);
          if (budgetKey === mKey) total += valorParc;
        }
      }
    } else {
      const cartao = cartoes.find(c => c.id === g.cartaoId);
      const valorParc = g.valor / parcelas;
      for (let i = 0; i < parcelas; i++) {
        if (getInstallmentBudgetMonth(g, cartao, i) === mKey) {
          total += valorParc;
        }
      }
    }
  }
  return total;
}

function isInstallmentAdvancePaid(gastoId, parcelaIndex) {
  return pagamentosAntecipados.some(p => p.gastoId === gastoId && p.parcelaIndex === parcelaIndex);
}

function getAdvancePayment(gastoId, parcelaIndex) {
  return pagamentosAntecipados.find(p => p.gastoId === gastoId && p.parcelaIndex === parcelaIndex);
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
    educacao:    `<i class="fa-solid fa-graduation-cap" style="color:#3b82f6"></i>`,
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

  // Receitas: valor original (sem rendimento) por mês de recebimento
  for (const r of receitas) {
    const d = new Date(r.data + "T00:00:00");
    if (d.getFullYear() === year) recData[d.getMonth()] += r.valor;
  }

  // Salário: adicionar em cada mês do ano apenas se o dia de pagamento já ocorreu
  if (salarioConfig && salarioConfig.ativo && salarioConfig.valor) {
    const now = new Date();
    now.setHours(0,0,0,0);
    for (let mo = 1; mo <= 12; mo++) {
      const payDate = lastBusinessDayOfMonth(year, mo);
      payDate.setHours(0,0,0,0);
      const mKey = `${year}-${String(mo).padStart(2,"0")}`;
      // Inclui meses passados e o atual se pagamento já ocorreu; exclui futuros
      if (now >= payDate) recData[mo - 1] += salarioConfig.valor;
    }
  }

  // Gastos: distribuir ALL gastos pelo mês de competência orçam.
  for (const g of gastos) {
    const parcelas = g.parcelas || 1;
    const valorParc = g.valor / parcelas;
    if (g.pagamento !== "cartao") {
      if (parcelas === 1) {
        const d = new Date(g.data + "T00:00:00");
        if (d.getFullYear() === year) gasData[d.getMonth()] += g.valor;
      } else {
        for (let i = 0; i < parcelas; i++) {
          const budgetKey = getInstallmentBudgetMonth(g, null, i);
          const [dy] = budgetKey.split("-").map(Number);
          if (dy === year) gasData[parseInt(budgetKey.split("-")[1]) - 1] += valorParc;
        }
      }
    } else {
      const cartao = cartoes.find(c => c.id === g.cartaoId);
      for (let i = 0; i < parcelas; i++) {
        const budgetKey = getInstallmentBudgetMonth(g, cartao, i); // mês de competência
        const [dy] = budgetKey.split("-").map(Number);
        if (dy === year) {
          const mo = parseInt(budgetKey.split("-")[1]) - 1; // 0-indexed
          gasData[mo] += valorParc;
        }
      }
    }
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

  // Monta catMap considerando TODOS os gastos pelo mês de competência
  const catMap = {};
  for (const g of gastos) {
    const cat = g.categoria || "outro";
    const parcelas = g.parcelas || 1;
    const valorParc = g.valor / parcelas;
    if (g.pagamento !== "cartao") {
      if (parcelas === 1) {
        if (monthKey(g.data) === mKey) catMap[cat] = (catMap[cat] || 0) + g.valor;
      } else {
        for (let i = 0; i < parcelas; i++) {
          if (getInstallmentBudgetMonth(g, null, i) === mKey)
            catMap[cat] = (catMap[cat] || 0) + valorParc;
        }
      }
    } else {
      const cartao = cartoes.find(c => c.id === g.cartaoId);
      for (let i = 0; i < parcelas; i++) {
        if (getInstallmentBudgetMonth(g, cartao, i) === mKey) {
          catMap[cat] = (catMap[cat] || 0) + valorParc;
        }
      }
    }
  }

  const sorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const catLabels = { alimentacao:"Alimentação", transporte:"Transporte", moradia:"Moradia",
    saude:"Saúde", lazer:"Lazer", educacao:"Educação", roupas:"Roupas", tecnologia:"Tecnologia", outro:"Outro" };
  const colors = ["#3b82f6","#059669","#d97706","#dc2626","#0284c7","#7c3aed","#db2777","#0d9488","#64748b"];

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
  const todayS     = today();
  const totalRec   = receitas.reduce((s,r) => s + calcRendimento(r, todayS), 0);
  const totalRend  = receitas.reduce((s,r) => s + (calcRendimento(r, todayS) - r.valor), 0);
  const totalReser = receitas.filter(r => r.reserva).reduce((s,r) => s + calcRendimento(r, todayS), 0);

  document.getElementById("rec-total").textContent      = fmt(totalRec);
  document.getElementById("rec-rendimentos").textContent = fmt(totalRend);
  document.getElementById("rec-reservas").textContent   = fmt(totalReser);

  // Subtextos dinâmicos
  const recTotalSub = document.getElementById("rec-total-sub");
  if (recTotalSub) {
    recTotalSub.textContent = receitas.length > 0
      ? `${receitas.length} ${receitas.length === 1 ? "entrada registrada" : "entradas registradas"}`
      : "Nenhuma receita ainda";
  }
  const recRendSub = document.getElementById("rec-rendimentos-sub");
  if (recRendSub) {
    const comRendimento = receitas.filter(r => r.reserva && (r.rendimento || (reservas.find(x => x.nome === r.reservaNome) || {}).rendimento)).length;
    recRendSub.textContent = comRendimento > 0
      ? `${comRendimento} ${comRendimento === 1 ? "entrada" : "entradas"} rendendo`
      : "Sem rendimentos ativos";
  }
  const recResSub = document.getElementById("rec-reservas-sub");
  if (recResSub) {
    const nReservadas = receitas.filter(r => r.reserva).length;
    recResSub.textContent = nReservadas > 0
      ? `em ${reservas.length} ${reservas.length === 1 ? "caixinha" : "caixinhas"}`
      : "Nenhum valor separado";
  }

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
    // Taxa efetiva: própria da receita ou do cofrinho vinculado
    let taxaEfetiva = r.rendimento || 0;
    if (!taxaEfetiva && r.reserva && r.reservaNome) {
      const res = reservas.find(x => x.nome === r.reservaNome);
      if (res) taxaEfetiva = res.rendimento || 0;
    }
    return `
    <div class="tx-row">
      <div class="tx-icon"><i class="fa-solid fa-arrow-down" style="color:#10b981"></i></div>
      <div class="tx-info">
        <span class="tx-name">${r.descricao}</span>
        <span class="tx-meta">${formatDateBR(r.data)}
          ${taxaEfetiva ? `<span class="tx-badge yield"><i class="fa-solid fa-seedling"></i> ${fmtPct(taxaEfetiva)}/dia</span>` : ""}
          ${r.reserva ? `<span class="tx-badge reserve"><i class="fa-solid fa-vault"></i> ${r.reservaNome || "Reserva"}</span>` : ""}
        </span>
        ${taxaEfetiva ? `<span class="tx-yield">Rendimento acumulado: +${fmt(rendimento)}</span>` : ""}
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

function renderSalarioConfig() {
  const el = document.getElementById("salario-config-info");
  const btnDel = document.getElementById("btn-delete-salario");
  if (!el) return;
  // Esconder o botão header de excluir — os controles agora ficam dentro do card
  if (btnDel) btnDel.style.display = "none";
  if (!salarioConfig || !salarioConfig.valor) {
    el.innerHTML = `<div class="empty-state"><p>Nenhum salário mensal configurado ainda</p></div>`;
    return;
  }
  const now = new Date();
  now.setHours(0,0,0,0);
  const pagEstesMes = lastBusinessDayOfMonth(now.getFullYear(), now.getMonth() + 1);
  pagEstesMes.setHours(0,0,0,0);
  const recebidoEsteMes = now >= pagEstesMes;
  const proximoPag = recebidoEsteMes
    ? lastBusinessDayOfMonth(now.getFullYear(), now.getMonth() + 2)
    : pagEstesMes;
  el.innerHTML = `
    <div class="sal-banner">
      <div class="sal-banner-icon">
        <i class="fa-solid fa-briefcase"></i>
      </div>
      <div class="sal-banner-body">
        <div class="sal-banner-top">
          <span class="sal-banner-valor">${fmt(salarioConfig.valor)}<small style="font-size:.7em;font-weight:500;color:var(--text2)">/mês</small></span>
          <span class="sal-badge ${salarioConfig.ativo ? "active" : "inactive"}">
            <i class="fa-solid fa-${salarioConfig.ativo ? "circle-check" : "circle-xmark"}"></i>
            ${salarioConfig.ativo ? "Ativo" : "Inativo"}
          </span>
        </div>
        <div class="sal-banner-meta">
          <span class="sal-meta-item"><i class="fa-solid fa-calendar-check"></i>
            ${recebidoEsteMes
              ? `<span style="color:var(--success)">Recebido este mês</span>`
              : `Próximo: <b>${pagEstesMes.toLocaleDateString("pt-BR")}</b>`}
          </span>
          <span class="sal-meta-item"><i class="fa-solid fa-calendar-days"></i> Último dia útil do mês</span>
          ${salarioConfig.obs ? `<span class="sal-meta-item"><i class="fa-solid fa-building"></i> ${salarioConfig.obs}</span>` : ""}
        </div>
      </div>
      <div class="sal-banner-actions">
        <button class="icon-btn edit" title="Editar" onclick="document.getElementById('btn-config-salario').click()">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="icon-btn del" title="Remover" onclick="window._confirmDeleteSalario()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`;
}

window._confirmDeleteSalario = () => {
  confirmCallback = deleteSalarioConfig;
  document.getElementById("confirm-msg").textContent = "Remover o salário mensal configurado?";
  openModal("modal-confirm");
};

async function saveSalarioConfig() {
  const ativo = document.getElementById("sal-ativo").checked;
  const valor = parseFloat(document.getElementById("sal-valor").value);
  const obs   = document.getElementById("sal-obs").value.trim();
  if (!valor || valor <= 0) { showToast("Informe um valor válido", "error"); return; }
  try {
    await setDoc(salarioRef(), { valor, obs, ativo, atualizadoEm: new Date().toISOString() });
    salarioConfig = { valor, obs, ativo };
    showToast("Salário mensal configurado!", "success");
    closeModal("modal-salario");
    renderSalarioConfig();
    renderDashboard();
    renderRelatorios();
  } catch(e) { showToast("Erro ao salvar: " + e.message, "error"); }
}

async function deleteSalarioConfig() {
  try {
    await deleteDoc(salarioRef());
    salarioConfig = null;
    showToast("Salário removido!", "success");
    renderSalarioConfig();
    renderDashboard();
    renderRelatorios();
  } catch(e) { showToast("Erro ao remover: " + e.message, "error"); }
}

// ─── GASTOS ──────────────────────────────────────────────────
function renderGastos() {
  const totalG   = gastos.reduce((s,g) => s + g.valor, 0);
  const gastosCartao = gastos.filter(g => g.pagamento === "cartao");
  const cartaoG  = gastosCartao.reduce((s,g) => s + g.valor, 0);
  const outrosG  = gastos.filter(g => g.pagamento !== "cartao").reduce((s,g) => s + g.valor, 0);

  document.getElementById("gasto-total").textContent  = fmt(totalG);
  document.getElementById("gasto-cartao").textContent = fmt(cartaoG);
  document.getElementById("gasto-outros").textContent = fmt(outrosG);

  // Subtextos dinâmicos
  const gastoTotalSub = document.getElementById("gasto-total-sub");
  if (gastoTotalSub) {
    gastoTotalSub.textContent = gastos.length > 0
      ? `${gastos.length} ${gastos.length === 1 ? "lançamento" : "lançamentos"} no total`
      : "Nenhum gasto ainda";
  }
  const gastoCartaoSub = document.getElementById("gasto-cartao-sub");
  if (gastoCartaoSub) {
    const parcelados = gastosCartao.filter(g => (g.parcelas || 1) > 1).length;
    gastoCartaoSub.textContent = gastosCartao.length > 0
      ? parcelados > 0 ? `${parcelados} ${parcelados === 1 ? "compra" : "compras"} parcelada${parcelados === 1 ? "" : "s"}` : `${gastosCartao.length} ${gastosCartao.length === 1 ? "compra" : "compras"} no cartão`
      : "Sem compras no cartão";
  }
  const gastoOutrosSub = document.getElementById("gasto-outros-sub");
  if (gastoOutrosSub) {
    const nPix = gastos.filter(g => g.pagamento === "pix").length;
    const nDin = gastos.filter(g => g.pagamento === "dinheiro").length;
    if (nPix > 0 && nDin > 0) {
      gastoOutrosSub.textContent = `${nPix} via Pix · ${nDin} em dinheiro`;
    } else if (nPix > 0) {
      gastoOutrosSub.textContent = `${nPix} ${nPix === 1 ? "transação" : "transações"} via Pix`;
    } else if (nDin > 0) {
      gastoOutrosSub.textContent = `${nDin} ${nDin === 1 ? "pagamento" : "pagamentos"} em dinheiro`;
    } else {
      gastoOutrosSub.textContent = "Sem pagamentos diretos";
    }
  }

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
  const cartao   = cartoes.find(c => c.id === g.cartaoId);
  const parcelas = g.parcelas || 1;
  const cartaoInfo = cartao ? `<span class="tx-badge" style="background:${cartao.color}22;color:${cartao.color}"><i class="fa-solid fa-credit-card"></i> ${cartao.nome}</span>` : "";

  let parcInfo = "";
  let parcManageBtn = "";

  if (g.pagamento === "cartao" && parcelas > 1) {
    let pagas = 0;
    for (let i = 0; i < parcelas; i++) {
      const dueMonth = getInstallmentDueMonth(g, cartao, i);
      const autoPaid = isFaturaVencida(cartao || { vencimento: 1 }, dueMonth);
      if (autoPaid || isInstallmentAdvancePaid(g.id, i)) pagas++;
    }
    const pendentes = parcelas - pagas;
    const valorParc = g.valor / parcelas;
    parcInfo = `
      <span class="tx-badge info">${parcelas}x ${fmt(valorParc)}</span>
      <span class="tx-badge ${pagas === parcelas ? "income" : "creditor"}">${pagas}/${parcelas} pagas</span>
      ${pendentes > 0 ? `<span class="tx-badge expense" style="font-weight:700">${fmt(pendentes * valorParc)} restante</span>` : ""}`;
    if (pendentes > 0) {
      parcManageBtn = `<button class="icon-btn" title="Gerenciar Parcelas" onclick="openGerenciarParcelas('${g.id}')" style="color:var(--primary);background:var(--primary-bg)"><i class="fa-solid fa-list-check"></i></button>`;
    }
  } else if (g.pagamento === "cartao" && parcelas === 1) {
    const dueMonth = getInstallmentDueMonth(g, cartao, 0);
    const autoPaid = isFaturaVencida(cartao || { vencimento: 1 }, dueMonth);
    const advPaid  = isInstallmentAdvancePaid(g.id, 0);
    parcInfo = autoPaid || advPaid
      ? `<span class="tx-badge income"><i class="fa-solid fa-check"></i> Pago</span>`
      : `<span class="tx-badge expense"><i class="fa-solid fa-clock"></i> Pendente</span>`;
  }

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
        ${parcManageBtn}
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
          ${res.rendimento ? `<span class="tx-badge yield"><i class="fa-solid fa-seedling"></i> ${fmtPct(res.rendimento)}/dia</span>` : ""}
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

    // Vencimento: só calcular dias restantes se configurado
    let vencInfo = "";
    if (c.vencimento) {
      const venc = new Date(now.getFullYear(), now.getMonth(), c.vencimento);
      if (venc < now) venc.setMonth(venc.getMonth() + 1);
      const daysLeft = Math.ceil((venc - now) / 86400000);
      vencInfo = `Vence em ${daysLeft}d · Dia ${c.vencimento}`;
    } else {
      vencInfo = `<span style="opacity:.7">Sem vencimento definido</span>`;
    }

    const txCartao = gastos.filter(g => g.pagamento === "cartao" && g.cartaoId === c.id && monthKey(g.data) === mKey);

    return `
    <div class="cartao-card">
      <div class="cartao-visual" style="background: linear-gradient(135deg, ${c.color}, ${adjustColor(c.color, -40)})">
        <div class="cartao-top">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="cartao-name">${c.nome}</span>
            ${c.titular ? `<span class="cartao-titular"><i class="fa-solid fa-user" style="font-size:.7em"></i> ${c.titular}</span>` : ""}
          </div>
          <i class="fa-solid fa-credit-card cartao-chip"></i>
        </div>
        <div class="cartao-fatura">
          <span class="cartao-fatura-label">Fatura atual</span>
          <span class="cartao-fatura-val">${fmt(fatura)}</span>
        </div>
        <div class="cartao-bottom">
          <span>${vencInfo}</span>
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
  const yearSel = document.getElementById("anual-year-select");
  const year = yearSel ? (parseInt(yearSel.value) || new Date().getFullYear()) : new Date().getFullYear();
  renderAnualReport(year);
  renderChartEvolucao();
  renderChartTopCategorias();
  renderChartPagamento();
}

function renderAnualReport(year) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const now = new Date();
  let totalRec = 0, totalGas = 0, acumulado = 0, rows = "";

  for (let m = 0; m < 12; m++) {
    const mKey = `${year}-${String(m+1).padStart(2,"0")}`;
    const isFuture = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
    const rec = receitas.filter(r => monthKey(r.data) === mKey).reduce((s,r) => s + r.valor, 0)
              + getSalaryForMonth(mKey);
    const gas = calcGastosMes(mKey);
    const saldo = rec - gas;
    acumulado += saldo;
    totalRec += rec; totalGas += gas;
    rows += `<tr class="${isFuture ? "future-row" : saldo < 0 ? "neg-row" : "pos-row"}">
      <td><span class="month-name">${months[m]}</span>${isFuture ? ` <span class="future-badge">Previsto</span>` : ""}</td>
      <td class="text-right income-cell">${rec > 0 ? fmt(rec) : "—"}</td>
      <td class="text-right expense-cell">${gas > 0 ? fmt(gas) : "—"}</td>
      <td class="text-right ${saldo < 0 ? "expense-cell" : saldo > 0 ? "income-cell" : ""}"> ${saldo !== 0 ? fmt(saldo) : "—"}</td>
      <td class="text-right ${acumulado < 0 ? "expense-cell" : "income-cell"}">${fmt(acumulado)}</td>
    </tr>`;
  }

  const totalSaldo = totalRec - totalGas;
  rows += `<tr class="total-row">
    <td><b>TOTAL ${year}</b></td>
    <td class="text-right income-cell"><b>${fmt(totalRec)}</b></td>
    <td class="text-right expense-cell"><b>${fmt(totalGas)}</b></td>
    <td class="text-right ${totalSaldo < 0 ? "expense-cell" : "income-cell"}"><b>${fmt(totalSaldo)}</b></td>
    <td></td>
  </tr>`;

  const tbody = document.getElementById("anual-table-body");
  if (tbody) tbody.innerHTML = rows;

  const summaryEl = document.getElementById("anual-summary-cards");
  if (summaryEl) {
    const taxa = totalRec > 0 ? ((totalSaldo / totalRec) * 100).toFixed(1) + "%" : "—";
    const taxaNum = totalRec > 0 ? (totalSaldo / totalRec) * 100 : 0;
    const nRecAno = receitas.filter(r => new Date(r.data+"T00:00:00").getFullYear() === year).length;
    const nGasAno = gastos.filter(g => {
      const d = new Date(g.data+"T00:00:00");
      if (d.getFullYear() === year) return true;
      const parc = g.parcelas || 1;
      if (parc > 1) { const c = cartoes.find(x => x.id === g.cartaoId); for (let i=0;i<parc;i++) if (getInstallmentBudgetMonth(g,c,i).startsWith(String(year))) return true; }
      return false;
    }).length;
    const poupancaLabel = taxaNum >= 20 ? "Acima de 20% — ótimo resultado"
      : taxaNum >= 10 ? "Entre 10% e 20% — bom ritmo"
      : taxaNum >= 0  ? "Abaixo de 10% — dá pra melhorar"
      : "Gastos maiores que as receitas";
    summaryEl.innerHTML = `
    <div class="anual-summary-row">
      <div class="anual-stat income">
        <div class="anual-stat-icon"><i class="fa-solid fa-arrow-down"></i></div>
        <div>
          <span class="anual-stat-label">Receitas ${year}</span>
          <span class="anual-stat-value">${fmt(totalRec)}</span>
          <span class="anual-stat-sub">${nRecAno} ${nRecAno === 1 ? "entrada" : "entradas"} no ano</span>
        </div>
      </div>
      <div class="anual-stat expense">
        <div class="anual-stat-icon"><i class="fa-solid fa-arrow-up"></i></div>
        <div>
          <span class="anual-stat-label">Gastos ${year}</span>
          <span class="anual-stat-value">${fmt(totalGas)}</span>
          <span class="anual-stat-sub">${nGasAno} ${nGasAno === 1 ? "lançamento" : "lançamentos"} no ano</span>
        </div>
      </div>
      <div class="anual-stat ${totalSaldo >= 0 ? "balance-pos" : "balance-neg"}">
        <div class="anual-stat-icon"><i class="fa-solid fa-scale-balanced"></i></div>
        <div>
          <span class="anual-stat-label">Saldo do Ano</span>
          <span class="anual-stat-value">${fmt(totalSaldo)}</span>
          <span class="anual-stat-sub">${totalSaldo >= 0 ? "Resultado positivo" : "Resultado negativo"}</span>
        </div>
      </div>
      <div class="anual-stat savings">
        <div class="anual-stat-icon"><i class="fa-solid fa-piggy-bank"></i></div>
        <div>
          <span class="anual-stat-label">Taxa de Poupança</span>
          <span class="anual-stat-value">${taxa}</span>
          <span class="anual-stat-sub">${poupancaLabel}</span>
        </div>
      </div>
    </div>`;
  }
}

function exportPDF(year) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const catLabels = { alimentacao:"Alimentação", transporte:"Transporte", moradia:"Moradia", saude:"Saúde", lazer:"Lazer", educacao:"Educação", roupas:"Roupas", tecnologia:"Tecnologia", outro:"Outro" };
  const payLabel  = { cartao:"Cartão", pix:"Pix", dinheiro:"Dinheiro", debito:"Débito", credito:"Crédito" };
  const userName  = currentUser?.displayName || "Usuário";
  const now       = new Date();
  const todayStr  = today();
  // Para caixinhas: rendimento projetado até 31/dez do ano do relatório
  const endOfYear = `${year}-12-31`;
  const yieldDate = year < now.getFullYear() ? endOfYear
                  : year > now.getFullYear() ? endOfYear
                  : todayStr; // ano atual: até hoje

  // ── Extrato mensal ──────────────────────────────────────────
  let tableRows = "", totalRec = 0, totalGas = 0, totalSal = 0, acumulado = 0;
  for (let m = 0; m < 12; m++) {
    const mKey = `${year}-${String(m+1).padStart(2,"0")}`;
    const recPura = receitas.filter(r => monthKey(r.data) === mKey).reduce((s,r) => s + r.valor, 0);
    const sal  = getSalaryForMonth(mKey);
    const rec  = recPura + sal;
    const gas  = calcGastosMes(mKey);
    const saldo = rec - gas;
    acumulado += saldo; totalRec += rec; totalGas += gas; totalSal += sal;
    const isFut = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
    const rowBg = isFut ? "#f8fafc" : saldo < 0 ? "#fff5f5" : m%2===0 ? "#f8fafc" : "#fff";
    tableRows += `<tr style="background:${rowBg}${isFut?";opacity:.65":""}">
      <td>${months[m]}${isFut?" <em style='color:#94a3b8;font-size:9px'>(previsto)</em>":""}</td>
      <td style="text-align:right;color:#10b981">${recPura > 0 ? fmt(recPura) : "—"}</td>
      <td style="text-align:right;color:#3b82f6">${sal > 0 ? fmt(sal) : "—"}</td>
      <td style="text-align:right;color:#ef4444">${gas > 0 ? fmt(gas) : "—"}</td>
      <td style="text-align:right;font-weight:600;color:${saldo<0?"#ef4444":"#059669"}">${fmt(saldo)}</td>
      <td style="text-align:right;color:${acumulado<0?"#ef4444":"#1e293b"}">${fmt(acumulado)}</td>
    </tr>`;
  }
  const totalSaldo = totalRec - totalGas;
  const taxa = totalRec > 0 ? ((totalSaldo / totalRec) * 100).toFixed(1) + "%" : "—";
  const poupancaNum = totalRec > 0 ? (totalSaldo / totalRec) * 100 : 0;

  // ── Gastos por categoria (competência correta) ──────────────
  const catMap = {};
  for (const g of gastos) {
    const parcelas = g.parcelas || 1;
    const cartao   = cartoes.find(c => c.id === g.cartaoId);
    if (parcelas === 1 && g.pagamento !== "cartao") {
      const d = new Date(g.data + "T00:00:00");
      if (d.getFullYear() === year) catMap[g.categoria||"outro"] = (catMap[g.categoria||"outro"]||0) + g.valor;
    } else {
      for (let i = 0; i < parcelas; i++) {
        const bk = getInstallmentBudgetMonth(g, cartao, i);
        if (bk.startsWith(String(year)))
          catMap[g.categoria||"outro"] = (catMap[g.categoria||"outro"]||0) + g.valor / parcelas;
      }
    }
  }
  const catSorted = Object.entries(catMap).sort((a,b) => b[1]-a[1]);
  const catColors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#0ea5e9","#ec4899","#14b8a6","#64748b"];
  const catRows = catSorted.map(([k,v], idx) => {
    const pct = totalGas > 0 ? (v/totalGas)*100 : 0;
    return `<tr>
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${catColors[idx%catColors.length]};margin-right:6px;vertical-align:middle"></span>${catLabels[k]||k}</td>
      <td style="text-align:right;color:#ef4444;font-weight:600">${fmt(v)}</td>
      <td style="text-align:right">
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
          <div style="width:60px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden">
            <div style="width:${pct.toFixed(1)}%;height:100%;background:${catColors[idx%catColors.length]};border-radius:3px"></div>
          </div>
          <span style="color:#64748b;min-width:34px">${pct.toFixed(1)}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");

  // ── Todos os gastos do ano (por competência) ────────────────
  const gastosAno = gastos.filter(g => {
    const d = new Date(g.data + "T00:00:00");
    if (d.getFullYear() === year) return true;
    const parcelas = g.parcelas || 1;
    if (parcelas > 1) {
      const cartao = cartoes.find(c => c.id === g.cartaoId);
      for (let i = 0; i < parcelas; i++)
        if (getInstallmentBudgetMonth(g, cartao, i).startsWith(String(year))) return true;
    }
    return false;
  }).sort((a,b) => a.data.localeCompare(b.data));

  const gastosRows = gastosAno.map((g, idx) => {
    const cartao  = cartoes.find(c => c.id === g.cartaoId);
    const parcelas = g.parcelas || 1;
    const parcStr = parcelas > 1 ? `${parcelas}x ${fmt(g.valor/parcelas)}` : fmt(g.valor);
    return `<tr style="background:${idx%2===0?"#fff":"#f8fafc"}">
      <td>${formatDateBR(g.data)}</td>
      <td>${g.descricao}</td>
      <td>${catLabels[g.categoria]||g.categoria||"Outro"}</td>
      <td>${payLabel[g.pagamento]||g.pagamento}${cartao?` · ${cartao.nome}`:""}</td>
      <td style="text-align:right">${parcStr}</td>
      <td style="text-align:right;color:#ef4444;font-weight:600">${fmt(g.valor)}</td>
    </tr>`;
  }).join("");

  // ── Receitas do ano ─────────────────────────────────────────
  const receitasAno = receitas
    .filter(r => new Date(r.data+"T00:00:00").getFullYear() === year)
    .sort((a,b) => a.data.localeCompare(b.data));
  const receitasRows = receitasAno.map((r, idx) => {
    const valorAtual = calcRendimento(r, todayStr);
    const rend = valorAtual - r.valor;
    return `<tr style="background:${idx%2===0?"#fff":"#f8fafc"}">
      <td>${formatDateBR(r.data)}</td>
      <td>${r.descricao}</td>
      <td>${r.reservaNome || (r.reserva ? "Caixinha" : "Conta Corrente")}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${fmt(r.valor)}</td>
      <td style="text-align:right;color:#059669">${rend > 0 ? "+"+fmt(rend) : "—"}</td>
    </tr>`;
  }).join("");

  // Salário recebido no ano
  let totalSalAno = 0;
  const salRows = months.map((mn, mi) => {
    const mKey = `${year}-${String(mi+1).padStart(2,"0")}`;
    const val  = getSalaryForMonth(mKey);
    if (val > 0) totalSalAno += val;
    return val > 0
      ? `<tr style="background:${mi%2===0?"#fff":"#f8fafc"}">
           <td>${mn}</td>
           <td style="text-align:right;color:#3b82f6;font-weight:600">${fmt(val)}</td>
         </tr>`
      : "";
  }).join("");

  // ── Reservas / Caixinhas — rendimento projetado até fim do ano ──
  const reservasRows = reservas.map((r, idx) => {
    const rxs  = receitas.filter(x => x.reservaNome === r.nome || x.reserva === r.id);
    const dep  = rxs.reduce((s,x) => s + x.valor, 0);
    // Calcular rendimento até yieldDate (fim do ano para relatórios passados/futuros, hoje para o atual)
    const atual = rxs.reduce((s,x) => s + calcRendimento(x, yieldDate), 0);
    const rendTotal = atual - dep;
    const rendAnual = rxs.reduce((s,x) => {
      // Rendimento gerado especificamente dentro do ano do relatório
      const startOfYear = `${year}-01-01`;
      const refInicio = x.data > startOfYear ? x.data : startOfYear;
      const valInicio = calcRendimento(x, refInicio);
      return s + (calcRendimento(x, yieldDate) - valInicio);
    }, 0);
    return `<tr style="background:${idx%2===0?"#fff":"#f8fafc"}">
      <td><strong>${r.nome}</strong></td>
      <td style="text-align:right">${r.rendimento ? fmtPct(r.rendimento)+"/dia útil" : "—"}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${fmt(dep)}</td>
      <td style="text-align:right;color:#059669;font-weight:600">${rendAnual > 0 ? "+"+fmt(rendAnual) : "—"}</td>
      <td style="text-align:right;color:#059669">${rendTotal > 0 ? "+"+fmt(rendTotal) : "—"}</td>
      <td style="text-align:right;font-weight:700;font-size:13px">${fmt(atual)}</td>
    </tr>`;
  }).join("");

  // ── Cartões ─────────────────────────────────────────────────
  const cartoesRows = cartoes.map((c, idx) => {
    let fat = 0;
    for (let m = 0; m < 12; m++) {
      const mKey = `${year}-${String(m+1).padStart(2,"0")}`;
      fat += calcFaturaCartao(c.id, mKey);
    }
    return `<tr style="background:${idx%2===0?"#fff":"#f8fafc"}">
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.color};margin-right:6px;vertical-align:middle"></span>${c.nome}</td>
      <td>${c.titular || "—"}</td>
      <td style="text-align:right">${c.vencimento ? "Dia "+c.vencimento : "—"}</td>
      <td style="text-align:right">${c.limite ? fmt(c.limite) : "—"}</td>
      <td style="text-align:right;color:#ef4444;font-weight:600">${fmt(fat)}</td>
    </tr>`;
  }).join("");

  // ── Ícones SVG para os cards de resumo ──────────────────────
  const svgRec  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
  const svgGas  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;
  const svgSald = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
  const svgPoup = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório ${year} — Controle de Gastos</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    @page{size:A4;margin:15mm 12mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;color:#1e293b;background:#fff;font-size:11px;line-height:1.5}
    /* ── Header ── */
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #3b82f6}
    .logo{font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-.5px}
    .logo span{color:#3b82f6}
    .logo-sub{color:#64748b;font-size:10.5px;margin-top:2px}
    .header-right{text-align:right;color:#64748b;font-size:10.5px;line-height:1.8}
    /* ── KPI Cards ── */
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
    .kpi{border-radius:12px;padding:14px 14px 12px;position:relative;overflow:hidden;color:#fff}
    .kpi.kpi-rec {background:linear-gradient(135deg,#059669,#10b981)}
    .kpi.kpi-gas {background:linear-gradient(135deg,#dc2626,#ef4444)}
    .kpi.kpi-sal {background:linear-gradient(135deg,#1d4ed8,#3b82f6)}
    .kpi.kpi-poup{background:linear-gradient(135deg,${poupancaNum>=0?"#b45309,#f59e0b":"#7f1d1d,#dc2626"})}
    .kpi-icon{width:28px;height:28px;background:rgba(255,255,255,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
    .kpi-icon svg{width:15px;height:15px;color:#fff;stroke:#fff}
    .kpi-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.85;margin-bottom:3px}
    .kpi-value{font-size:17px;font-weight:900;letter-spacing:-.3px;line-height:1}
    .kpi-sub{font-size:9px;opacity:.75;margin-top:4px}
    .kpi-bg{position:absolute;right:-12px;bottom:-12px;width:60px;height:60px;background:rgba(255,255,255,.1);border-radius:50%}
    .kpi-bg2{position:absolute;right:8px;bottom:8px;width:30px;height:30px;background:rgba(255,255,255,.08);border-radius:50%}
    /* ── Sections ── */
    h2{font-size:11.5px;font-weight:700;margin:18px 0 8px;color:#0f172a;display:flex;align-items:center;gap:5px;border-bottom:1.5px solid #e2e8f0;padding-bottom:5px}
    h2 .pill{background:#3b82f6;color:#fff;font-size:9px;padding:1px 7px;border-radius:20px;font-weight:600;letter-spacing:.03em}
    h2.red .pill{background:#ef4444}
    h2.green .pill{background:#10b981}
    h2.amber .pill{background:#f59e0b}
    /* ── Tables ── */
    table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:10.5px}
    th{background:#0f172a;color:#f8fafc;padding:6px 9px;text-align:left;font-size:9.5px;font-weight:700;letter-spacing:.05em}
    th:not(:first-child){text-align:right}
    td{padding:6px 9px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .trow td{background:#eff6ff;font-weight:700;border-top:2px solid #3b82f6;font-size:11px}
    /* ── Misc ── */
    .section{margin-bottom:18px}
    .badge{display:inline-block;padding:1px 6px;border-radius:20px;font-size:9px;font-weight:600}
    .footer{margin-top:24px;text-align:center;font-size:9.5px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
    .pb{page-break-before:always;padding-top:4mm}
    @media print{
      body{font-size:10.5px}
      .kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      th{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#0f172a!important;color:#f8fafc!important}
      .pb{page-break-before:always}
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="logo">Controle <span>de Gastos</span></div>
      <div class="logo-sub">Relatório Financeiro Completo · Ano ${year}</div>
    </div>
    <div class="header-right">
      <strong>${userName}</strong><br/>
      Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
    </div>
  </div>

  <!-- KPI CARDS -->
  <div class="kpi-grid">
    <div class="kpi kpi-rec">
      <div class="kpi-icon">${svgRec}</div>
      <div class="kpi-label">Total Recebido</div>
      <div class="kpi-value">${fmt(totalRec)}</div>
      <div class="kpi-sub">${totalSal>0?"incl. "+fmt(totalSal)+" em salário":receitas.filter(r=>new Date(r.data+"T00:00:00").getFullYear()===year).length+" entradas"}</div>
      <div class="kpi-bg"></div><div class="kpi-bg2"></div>
    </div>
    <div class="kpi kpi-gas">
      <div class="kpi-icon">${svgGas}</div>
      <div class="kpi-label">Total Gasto</div>
      <div class="kpi-value">${fmt(totalGas)}</div>
      <div class="kpi-sub">${gastosAno.length} lançamentos no ano</div>
      <div class="kpi-bg"></div><div class="kpi-bg2"></div>
    </div>
    <div class="kpi kpi-sal">
      <div class="kpi-icon">${svgSald}</div>
      <div class="kpi-label">Saldo do Ano</div>
      <div class="kpi-value">${fmt(totalSaldo)}</div>
      <div class="kpi-sub">${totalSaldo>=0?"✓ Resultado positivo":"⚠ Resultado negativo"}</div>
      <div class="kpi-bg"></div><div class="kpi-bg2"></div>
    </div>
    <div class="kpi kpi-poup">
      <div class="kpi-icon">${svgPoup}</div>
      <div class="kpi-label">Taxa de Poupança</div>
      <div class="kpi-value">${taxa}</div>
      <div class="kpi-sub">${poupancaNum>=20?"🏆 Excelente":poupancaNum>=10?"👍 Boa":poupancaNum>=0?"📈 Regular":"📉 Negativa"}</div>
      <div class="kpi-bg"></div><div class="kpi-bg2"></div>
    </div>
  </div>

  <!-- EXTRATO MENSAL -->
  <div class="section">
    <h2>📅 Extrato Mensal <span class="pill">${year}</span></h2>
    <table>
      <thead><tr><th>Mês</th><th>Outras Receitas</th><th>Salário</th><th>Gastos</th><th>Saldo do Mês</th><th>Acumulado</th></tr></thead>
      <tbody>
        ${tableRows}
        <tr class="trow">
          <td>TOTAL ${year}</td>
          <td style="text-align:right;color:#10b981">${fmt(totalRec - totalSal)}</td>
          <td style="text-align:right;color:#3b82f6">${totalSal>0?fmt(totalSal):"—"}</td>
          <td style="text-align:right;color:#ef4444">${fmt(totalGas)}</td>
          <td style="text-align:right;color:${totalSaldo<0?"#ef4444":"#059669"}">${fmt(totalSaldo)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${catSorted.length > 0 ? `
  <div class="section">
    <h2 class="red">🎯 Gastos por Categoria <span class="pill" style="background:#ef4444">${catSorted.length} categorias</span></h2>
    <table style="width:70%">
      <thead><tr><th>Categoria</th><th>Total</th><th style="text-align:right">Participação</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>` : ""}

  ${salarioConfig?.ativo && salRows ? `
  <div class="section">
    <h2 class="green">💰 Salário Recebido em ${year} <span class="pill" style="background:#3b82f6">Total: ${fmt(totalSalAno)}</span></h2>
    <table style="width:40%">
      <thead><tr><th>Mês</th><th>Valor Recebido</th></tr></thead>
      <tbody>${salRows}</tbody>
    </table>
  </div>` : ""}

  ${reservas.length > 0 ? `
  <div class="section">
    <h2 class="green">🏦 Caixinhas / Reservas <span class="pill" style="background:#059669">Rendimento em ${year}</span></h2>
    <table>
      <thead><tr><th>Nome</th><th>Taxa/dia útil</th><th>Total Depositado</th><th>Rendeu em ${year}</th><th>Rendimento Total</th><th>Saldo${year<=now.getFullYear()?" Atual":" Projetado"}</th></tr></thead>
      <tbody>${reservasRows}</tbody>
    </table>
  </div>` : ""}

  ${cartoes.length > 0 ? `
  <div class="section">
    <h2>💳 Cartões de Crédito — Faturado em ${year}</h2>
    <table>
      <thead><tr><th>Cartão</th><th>Titular</th><th>Vencimento</th><th>Limite</th><th>Total Faturado</th></tr></thead>
      <tbody>${cartoesRows}</tbody>
    </table>
  </div>` : ""}

  <!-- PÁGINA 2: DETALHAMENTO -->
  <div class="section pb">
    <h2 class="green">📥 Receitas Registradas em ${year} <span class="pill" style="background:#10b981">${receitasAno.length} entradas</span></h2>
    ${receitasAno.length > 0 ? `
    <table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Destino</th><th>Valor</th><th>Rendimento</th></tr></thead>
      <tbody>${receitasRows}</tbody>
    </table>` : "<p style='color:#64748b;font-style:italic;padding:8px 0;font-size:10.5px'>Nenhuma receita registrada neste período.</p>"}
  </div>

  <div class="section">
    <h2 class="red">📤 Todos os Gastos de ${year} <span class="pill" style="background:#ef4444">${gastosAno.length} lançamentos</span></h2>
    ${gastosAno.length > 0 ? `
    <table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Parcelas</th><th>Total</th></tr></thead>
      <tbody>${gastosRows}</tbody>
    </table>` : "<p style='color:#64748b;font-style:italic;padding:8px 0;font-size:10.5px'>Nenhum gasto registrado neste período.</p>"}
  </div>

  <div class="footer">
    Controle de Gastos · Relatório gerado automaticamente em ${now.toLocaleDateString("pt-BR")} · Dados protegidos pelo Firebase
  </div>
</body></html>`;

  const win = window.open("", "_blank", "width=1050,height=850");
  if (!win) { showToast("Permita popups nesta página para exportar o relatório", "warning"); return; }
  win.document.write(html);
  win.document.close();
  win.addEventListener("load", () => setTimeout(() => win.print(), 400));
}

window.openGerenciarParcelas = (gastoId) => {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;
  const cartao = cartoes.find(c => c.id === g.cartaoId);
  const parcelas = g.parcelas || 1;
  const valorParcela = g.valor / parcelas;

  document.getElementById("parcelas-gasto-info").innerHTML = `
    <div class="parcela-header-card">
      <div class="phc-row">
        <div class="phc-left">${getCategoryIcon(g.categoria)}<div><b>${g.descricao}</b><span class="phc-meta">${cartao ? cartao.nome : "Cartão"} · Vence dia ${cartao ? cartao.vencimento : "—"}</span></div></div>
        <div class="phc-right"><span class="phc-total">${fmt(g.valor)}</span><span class="phc-parc">${parcelas}x de ${fmt(valorParcela)}</span></div>
      </div>
    </div>`;

  let pagas = 0;
  let html = `<div class="parcelas-table-wrap"><table class="parcelas-table"><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>`;

  for (let i = 0; i < parcelas; i++) {
    const dueMonth = getInstallmentDueMonth(g, cartao, i);
    const [y, m_] = dueMonth.split("-").map(Number);
    const dueDay = cartao ? cartao.vencimento : 1;
    const dueDateStr = new Date(y, m_ - 1, dueDay).toLocaleDateString("pt-BR");
    const autoPaid = isFaturaVencida(cartao || { vencimento: 1 }, dueMonth);
    const advPay   = getAdvancePayment(g.id, i);
    pagas += (autoPaid || advPay) ? 1 : 0;

    let statusHtml, acaoHtml;
    if (advPay) {
      statusHtml = `<span class="tx-badge income"><i class="fa-solid fa-check"></i> Antecipado${advPay.desconto > 0 ? " (c/ desc.)" : ""}</span>`;
      acaoHtml   = `<span style="color:var(--success);font-size:.82rem;font-weight:700">${fmt(advPay.valorPago)}</span>`;
    } else if (autoPaid) {
      statusHtml = `<span class="tx-badge income"><i class="fa-solid fa-check-double"></i> Debitado</span>`;
      acaoHtml   = `<span style="color:var(--text3);font-size:.78rem">${fmt(valorParcela)}</span>`;
    } else {
      statusHtml = `<span class="tx-badge expense"><i class="fa-solid fa-clock"></i> Pendente</span>`;
      acaoHtml   = `<button class="btn-primary" style="padding:5px 12px;font-size:.78rem" onclick="openPagamentoAntecipado('${g.id}',${i},${valorParcela})"><i class="fa-solid fa-money-bill-wave"></i> Antecipar</button>`;
    }

    html += `<tr class="${autoPaid || advPay ? "parcela-paid" : ""}">
      <td class="parc-num">${i+1}/${parcelas}</td><td>${dueDateStr}</td><td>${fmt(valorParcela)}</td><td>${statusHtml}</td><td>${acaoHtml}</td>
    </tr>`;
  }

  html += "</tbody></table></div>";
  const pct = (pagas / parcelas) * 100;
  html += `<div class="parcelas-progress">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.85rem">
      <span>${pagas} de ${parcelas} parcelas ${pagas === parcelas ? "pagas ✓" : "pagas"}</span>
      <span style="font-weight:700;color:${pagas===parcelas?"var(--success)":"var(--danger)"}">${fmt(valorParcela * (parcelas - pagas))} restante</span>
    </div>
    <div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${pct}%;background:${pagas===parcelas?"var(--success)":"var(--primary)"}"></div></div>
  </div>`;

  document.getElementById("parcelas-list").innerHTML = html;
  openModal("modal-parcelas");
};

window.openPagamentoAntecipado = (gastoId, parcelaIndex, valorParcela) => {
  const g = gastos.find(x => x.id === gastoId);
  if (!g) return;
  const cartao = cartoes.find(c => c.id === g.cartaoId);
  const dueMonth = getInstallmentDueMonth(g, cartao, parcelaIndex);
  const [y, m_] = dueMonth.split("-").map(Number);
  const dueDateStr = new Date(y, m_ - 1, cartao ? cartao.vencimento : 1).toLocaleDateString("pt-BR");

  document.getElementById("pag-parcela-info").innerHTML = `
    <div class="parcela-header-card small">
      <div style="font-weight:600">${g.descricao} · Parcela ${parcelaIndex + 1}/${g.parcelas || 1}</div>
      <div class="phc-meta">Vencimento original: ${dueDateStr} · Valor: ${fmt(valorParcela)}</div>
    </div>`;

  document.getElementById("pag-data").value              = today();
  document.getElementById("pag-valor-original").value    = fmt(valorParcela);
  document.getElementById("pag-gasto-id").value          = gastoId;
  document.getElementById("pag-parcela-index").value     = parcelaIndex;
  document.getElementById("pag-valor-parcela").value     = valorParcela;
  document.getElementById("pag-tem-desconto").checked    = false;
  document.getElementById("desconto-wrapper").classList.add("hidden");
  document.getElementById("pag-valor-desconto").value    = "";
  document.getElementById("pag-desconto-calculado").value = "";
  openModal("modal-pagamento-antecipado");
};

async function salvarPagamentoAntecipado() {
  const gastoId    = document.getElementById("pag-gasto-id").value;
  const parcelaIdx = parseInt(document.getElementById("pag-parcela-index").value);
  const valorParc  = parseFloat(document.getElementById("pag-valor-parcela").value);
  const temDesc    = document.getElementById("pag-tem-desconto").checked;
  const dataPag    = document.getElementById("pag-data").value;
  let valorPago = valorParc, desconto = 0;

  if (temDesc) {
    const vd = parseFloat(document.getElementById("pag-valor-desconto").value);
    if (vd && vd > 0 && vd < valorParc) { valorPago = vd; desconto = valorParc - vd; }
  }
  if (!dataPag) { showToast("Informe a data do pagamento", "error"); return; }

  try {
    await addDoc(pagAntecRef(), {
      gastoId, parcelaIndex: parcelaIdx,
      valorOriginal: valorParc, valorPago, desconto,
      dataPagamento: dataPag, criadoEm: new Date().toISOString()
    });
    showToast(`Parcela paga!${desconto > 0 ? " Desconto de " + fmt(desconto) + " registrado 🎉" : ""}`, "success");
    closeModal("modal-pagamento-antecipado");
    await Promise.all([loadGastos(), loadPagamentosAntecipados()]);
    renderAll();
    openGerenciarParcelas(gastoId);
  } catch(e) { showToast("Erro: " + e.message, "error"); }
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
        borderColor: "#3b82f6",
        backgroundColor: "rgba(99,102,241,0.12)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#3b82f6",
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
      datasets: [{ label: "Total", data: sorted.map(([,v]) => v), backgroundColor: ["#3b82f6","#059669","#d97706","#dc2626","#0284c7","#7c3aed","#db2777","#0d9488"], borderRadius: 6 }]
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
      datasets: [{ data: [map.cartao, map.pix, map.dinheiro], backgroundColor: ["#3b82f6","#059669","#d97706"], borderWidth: 2, borderColor: "#fff" }]
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
  // Seletor de ano para o relatório anual
  const yearSel = document.getElementById("anual-year-select");
  if (yearSel) {
    const yearOpts = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 4; y--) {
      yearOpts.push(`<option value="${y}" ${y === now.getFullYear() ? "selected" : ""}>${y}</option>`);
    }
    yearSel.innerHTML = yearOpts.join("");
  }
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
  const parcelaInicioVal = document.getElementById("gas-parcela-inicio")?.value || "";
  const data   = {
    descricao:    document.getElementById("gas-descricao").value.trim(),
    valor:        parseFloat(document.getElementById("gas-valor").value),
    data:         document.getElementById("gas-data").value,
    categoria:    document.getElementById("gas-categoria").value,
    pagamento:    document.getElementById("gas-pagamento").value,
    cartaoId:     document.getElementById("gas-cartao-id").value || null,
    parcelas:     parseInt(document.getElementById("gas-parcelas").value) || 1,
    parcelaInicio: parcelaInicioVal || null,
    credor:       temCredor ? document.getElementById("gas-credor").value.trim() : "",
    credorContato: temCredor ? document.getElementById("gas-credor-contato").value.trim() : "",
    obs:          document.getElementById("gas-obs").value.trim(),
    updatedAt:    new Date().toISOString()
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
    titular:    document.getElementById("cart-titular").value.trim(),
    limite:     parseFloat(document.getElementById("cart-limite").value) || 0,
    vencimento: parseInt(document.getElementById("cart-vencimento").value) || 0,
    color:      document.getElementById("cart-color").value
  };
  if (!data.nome) { showToast("Informe o nome do cartão", "error"); return; }

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
    nome:       document.getElementById("res-nome").value.trim(),
    meta:       parseFloat(document.getElementById("res-meta").value) || 0,
    rendimento: parseFloat(document.getElementById("res-rendimento").value) || 0,
    icone:      document.getElementById("res-icone").value,
    cor:        document.getElementById("res-color").value
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
  document.getElementById("cart-edit-id").value    = id;
  document.getElementById("cart-nome").value       = c.nome;
  document.getElementById("cart-titular").value    = c.titular || "";
  document.getElementById("cart-limite").value     = c.limite || "";
  document.getElementById("cart-vencimento").value = c.vencimento || "";
  document.getElementById("cart-color").value      = c.color || "#3b82f6";
  document.querySelectorAll("#cart-color-picker .color-opt").forEach(el => {
    el.classList.toggle("active", el.dataset.color === c.color);
  });
  openModal("modal-cartao");
};

window.editReserva = (id) => {
  const r = reservas.find(x => x.id === id);
  if (!r) return;
  document.getElementById("res-edit-id").value   = id;
  document.getElementById("res-nome").value      = r.nome;
  document.getElementById("res-meta").value      = r.meta || "";
  document.getElementById("res-rendimento").value = r.rendimento || "";
  document.getElementById("res-icone").value     = r.icone;
  document.getElementById("res-color").value     = r.cor || "#10b981";
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
    document.getElementById("transferir-caixinha-wrapper").classList.add("hidden");
  } else {
    document.getElementById("reserva-select-wrapper").classList.add("hidden");
    // Mostrar opção de transferir para caixinha ao editar
    const wrapper = document.getElementById("transferir-caixinha-wrapper");
    wrapper.classList.remove("hidden");
    populateTransferirSelect();
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
    const inicioEl = document.getElementById("gas-parcela-inicio");
    const wrapperEl = document.getElementById("parcela-inicio-wrapper");
    if (inicioEl) inicioEl.value = g.parcelaInicio || "";
    if (wrapperEl) wrapperEl.style.display = (g.parcelas > 1) ? "" : "none";
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
  document.getElementById("transferir-caixinha-wrapper").classList.add("hidden");
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
  const prev = document.getElementById("gas-parcelas-preview");
  if (prev) prev.textContent = "";
  const inicioEl = document.getElementById("gas-parcela-inicio");
  const wrapperEl = document.getElementById("parcela-inicio-wrapper");
  if (inicioEl) inicioEl.value = "";
  if (wrapperEl) wrapperEl.style.display = "none";
  populateCartaoSelect();
}

function populateReservaSelect() {
  const sel = document.getElementById("rec-reserva-nome");
  sel.innerHTML = `<option value="">Selecione uma reserva</option>` +
    reservas.map(r => `<option value="${r.nome}">${r.nome}</option>`).join("");
}

function populateTransferirSelect() {
  const sel = document.getElementById("rec-transferir-reserva");
  if (reservas.length === 0) {
    sel.innerHTML = `<option value="">Nenhuma caixinha criada</option>`;
    return;
  }
  sel.innerHTML = `<option value="">Selecione a caixinha...</option>` +
    reservas.map(r => {
      const taxa = r.rendimento ? ` — ${fmtPct(r.rendimento)}/dia` : "";
      return `<option value="${r.nome}">${r.nome}${taxa}</option>`;
    }).join("");
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

  // Salário mensal
  document.getElementById("btn-config-salario")?.addEventListener("click", () => {
    if (salarioConfig) {
      document.getElementById("sal-ativo").checked = salarioConfig.ativo ?? true;
      document.getElementById("sal-valor").value   = salarioConfig.valor || "";
      document.getElementById("sal-obs").value     = salarioConfig.obs   || "";
    } else {
      document.getElementById("form-salario").reset();
      document.getElementById("sal-ativo").checked = true;
    }
    openModal("modal-salario");
  });
  document.getElementById("btn-save-salario")?.addEventListener("click", saveSalarioConfig);
  document.getElementById("btn-delete-salario")?.addEventListener("click", () => {
    confirmCallback = deleteSalarioConfig;
    document.getElementById("confirm-msg").textContent = "Remover o salário mensal configurado?";
    openModal("modal-confirm");
  });

  // Nova gasto
  document.getElementById("btn-add-gasto").addEventListener("click", () => { resetModalGasto(); openModal("modal-gasto"); });
  document.getElementById("btn-save-gasto").addEventListener("click", saveGasto);

  // Parcelas: prévia do valor por parcela + mostrar campo de início
  const updateParcelasPreview = () => {
    const valor = parseFloat(document.getElementById("gas-valor")?.value) || 0;
    const parc  = parseInt(document.getElementById("gas-parcelas")?.value)  || 1;
    const prev  = document.getElementById("gas-parcelas-preview");
    const wrapperEl = document.getElementById("parcela-inicio-wrapper");
    if (!prev) return;
    if (valor > 0 && parc > 0) {
      prev.textContent = parc === 1
        ? `à vista — ${fmt(valor)}`
        : `${parc}x de ${fmt(valor / parc)} = ${fmt(valor)}`;
    } else { prev.textContent = ""; }
    // Só mostra o campo de início de parcelas quando há mais de 1 parcela e é cartão
    const isCartao = document.getElementById("gas-pagamento")?.value === "cartao";
    if (wrapperEl) wrapperEl.style.display = (parc > 1 && isCartao) ? "" : "none";
  };
  document.getElementById("gas-valor")?.addEventListener("input", updateParcelasPreview);
  document.getElementById("gas-parcelas")?.addEventListener("input", updateParcelasPreview);

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
    document.getElementById("transferir-caixinha-wrapper").classList.toggle("hidden", e.target.checked);
    if (e.target.checked) populateReservaSelect();
  });

  // Botão confirmar transferência para caixinha
  document.getElementById("btn-confirmar-transferir").addEventListener("click", async () => {
    const id       = document.getElementById("rec-edit-id").value;
    const reserva  = document.getElementById("rec-transferir-reserva").value;
    if (!id)     { showToast("Salve a receita primeiro", "warning"); return; }
    if (!reserva){ showToast("Selecione uma caixinha", "warning"); return; }
    try {
      await updateDoc(doc(receitasRef(), id), {
        reserva: true,
        reservaNome: reserva,
        rendimento: 0,          // taxa agora é da caixinha
        updatedAt: new Date().toISOString()
      });
      showToast(`Transferido para "${reserva}" com sucesso!`, "success");
      closeModal("modal-receita");
      await loadReceitas();
      renderAll();
    } catch (e) { showToast("Erro ao transferir: " + e.message, "error"); }
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
      const isCartao = tab.dataset.pay === "cartao";
      document.getElementById("cartao-fields").style.display = isCartao ? "block" : "none";
      // Esconder início de parcelas se não for cartão
      if (!isCartao) {
        const w = document.getElementById("parcela-inicio-wrapper");
        if (w) w.style.display = "none";
      } else {
        updateParcelasPreview();
      }
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

  // Annual report year selector
  document.getElementById("anual-year-select")?.addEventListener("change", () => {
    const year = parseInt(document.getElementById("anual-year-select").value);
    renderAnualReport(year);
  });

  // Export PDF
  document.getElementById("btn-export-pdf")?.addEventListener("click", () => {
    const year = parseInt(document.getElementById("anual-year-select")?.value || new Date().getFullYear());
    exportPDF(year);
  });

  // Advance payment save
  document.getElementById("btn-confirmar-pagamento")?.addEventListener("click", salvarPagamentoAntecipado);

  // Toggle desconto no modal pagamento antecipado
  document.getElementById("pag-tem-desconto")?.addEventListener("change", e => {
    document.getElementById("desconto-wrapper").classList.toggle("hidden", !e.target.checked);
  });

  // Auto-calc desconto
  document.getElementById("pag-valor-desconto")?.addEventListener("input", () => {
    const valorParc = parseFloat(document.getElementById("pag-valor-parcela").value) || 0;
    const valorCom  = parseFloat(document.getElementById("pag-valor-desconto").value) || 0;
    const desconto  = valorParc - valorCom;
    document.getElementById("pag-desconto-calculado").value = desconto > 0 ? fmt(desconto) : "R$ 0,00";
  });

  // Form submits com Enter
  document.querySelectorAll("form").forEach(f => f.addEventListener("submit", e => e.preventDefault()));
}

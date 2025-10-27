const symbolSelect = document.getElementById("symbol-select");
const orderForm = document.getElementById("order-form");
const positionsTableBody = document.getElementById("positions-table");
const totalTradesEl = document.getElementById("total-trades");
const longShortRatioEl = document.getElementById("long-short-ratio");
const positionsPnlEl = document.getElementById("positions-pnl");
const markPriceEl = document.getElementById("mark-price");
const priceChangeEl = document.getElementById("price-change");
const priceVolumeEl = document.getElementById("price-volume");
const asksList = document.getElementById("asks-list");
const bidsList = document.getElementById("bids-list");
const tradesList = document.getElementById("trades-list");
const floatingPnlEl = document.getElementById("floating-pnl");
const floatingRoiEl = document.getElementById("floating-roi");
const pnlEditToggle = document.getElementById("pnl-edit-toggle");
const tickerTape = document.getElementById("ticker-tape");

const REFRESH_INTERVAL = 5000;
const TICKER_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "MATICUSDT"];

const generateId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `pos-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const state = {
  widget: null,
  positions: [],
  markPrice: null,
  markChange: null,
  quoteVolume: null,
  refreshTimer: null,
  tickerTimer: null,
  isEditing: false,
};

function formatCurrency(value) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Math.abs(value) >= 1 ? 2 : 4,
    maximumFractionDigits: 4,
  });
  return formatter.format(value);
}

function formatNumber(value, decimals = 2) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPrice(value) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  let decimals = 2;
  if (abs < 1) decimals = 4;
  if (abs < 0.1) decimals = 5;
  if (abs < 0.01) decimals = 6;
  if (abs < 0.001) decimals = 7;
  return formatNumber(value, decimals);
}

function formatPercent(value, includeSign = true) {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) {
    return "—";
  }
  const sign = includeSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatVolume(value) {
  if (!value) return "—";
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(0);
}

function getBinanceSymbol(tvSymbol) {
  return (tvSymbol || "").split(":").pop();
}

function initTradingView(symbol) {
  if (state.widget) {
    state.widget.onChartReady(() => {
      state.widget.chart().setSymbol(symbol);
    });
    return;
  }

  state.widget = new TradingView.widget({
    width: "100%",
    height: 520,
    symbol,
    interval: "60",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "ru",
    toolbar_bg: "#131722",
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: false,
    container_id: "tv_chart_container",
    withdateranges: true,
    details: true,
    hotlist: true,
    calendar: true,
  });
}

function calculatePositionMetrics(position, markPrice) {
  const entry = Number(position.entryPrice);
  const quantity = Number(position.quantity);
  const leverage = Number(position.leverage);
  const mark = markPrice ?? entry;

  if (!entry || !quantity || !mark) {
    return {
      markPrice: mark,
      pnl: 0,
      roi: 0,
      margin: leverage ? quantity / leverage : quantity,
    };
  }

  const contracts = quantity / entry;
  const directionFactor = position.direction === "Long" ? 1 : -1;
  const pnl = (mark - entry) * contracts * directionFactor;
  const margin = leverage ? quantity / leverage : quantity;
  const roi = margin ? (pnl / margin) * 100 : 0;
  const liq = leverage
    ? position.direction === "Long"
      ? entry * (1 - 1 / leverage)
      : entry * (1 + 1 / leverage)
    : null;

  return {
    markPrice: mark,
    pnl,
    roi,
    margin,
    liquidation: liq,
  };
}

function renderPositions() {
  positionsTableBody.innerHTML = "";
  let totalLong = 0;
  let totalShort = 0;
  let totalPnl = 0;
  let totalMargin = 0;

  state.positions.forEach((position, index) => {
    if (position.direction === "Long") totalLong += 1;
    if (position.direction === "Short") totalShort += 1;

    const metrics = calculatePositionMetrics(position, state.markPrice);
    totalPnl += metrics.pnl;
    totalMargin += metrics.margin || 0;

    const orderTypeLabel = position.orderType ? position.orderType.toUpperCase() : "—";
    const liquidationInfo =
      metrics.liquidation && Number.isFinite(metrics.liquidation)
        ? `Ликвидация: ${formatPrice(metrics.liquidation)}`
        : "Ликвидация: —";

    const row = document.createElement("tr");
    if (position.notes) {
      row.title = position.notes;
    }

    const pnlClass = metrics.pnl > 0 ? "positive" : metrics.pnl < 0 ? "negative" : "";
    const roiClass = metrics.roi > 0 ? "positive" : metrics.roi < 0 ? "negative" : "";

    row.innerHTML = `
      <td>
        <div class="pair-cell">
          <strong>${position.symbolLabel}</strong>
          <span class="muted">${orderTypeLabel}</span>
        </div>
      </td>
      <td><span class="tag ${position.direction.toLowerCase()}">${position.direction}</span></td>
      <td>${formatPrice(position.entryPrice)}</td>
      <td>${formatPrice(metrics.markPrice)}</td>
      <td>${formatNumber(position.quantity)}</td>
      <td>${position.leverage}x</td>
      <td class="${pnlClass}">${formatCurrency(metrics.pnl)}</td>
      <td class="${roiClass}">${formatPercent(metrics.roi)}</td>
      <td title="${liquidationInfo}">${position.stopLoss || "—"} / ${position.takeProfit || "—"}</td>
      <td><button class="remove-btn" data-index="${index}">×</button></td>
    `;

    positionsTableBody.appendChild(row);
  });

  if (state.positions.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "empty-row";
    emptyRow.innerHTML = '<td colspan="10">Нет активных позиций — заполните форму, чтобы добавить сделку.</td>';
    positionsTableBody.appendChild(emptyRow);
  }

  totalTradesEl.textContent = state.positions.length;
  longShortRatioEl.textContent = `${totalLong} / ${totalShort}`;
  positionsPnlEl.textContent = formatCurrency(totalPnl);
  positionsPnlEl.classList.toggle("positive", totalPnl >= 0);
  positionsPnlEl.classList.toggle("negative", totalPnl < 0);

  if (!state.isEditing) {
    updatePortfolioMetrics(totalPnl, totalMargin);
  }
}

function updatePortfolioMetrics(totalPnl, totalMargin) {
  floatingPnlEl.textContent = formatCurrency(totalPnl);
  floatingRoiEl.textContent = totalMargin ? formatPercent((totalPnl / totalMargin) * 100) : "0.00%";

  floatingPnlEl.classList.remove("positive", "negative");
  floatingRoiEl.classList.remove("positive", "negative");

  if (totalPnl > 0) {
    floatingPnlEl.classList.add("positive");
    floatingRoiEl.classList.add("positive");
  } else if (totalPnl < 0) {
    floatingPnlEl.classList.add("negative");
    floatingRoiEl.classList.add("negative");
  }
}

function handleOrderSubmit(event) {
  event.preventDefault();
  const formData = new FormData(orderForm);
  const direction = formData.get("direction") || "Long";
  const leverage = Number(formData.get("leverage")) || 1;
  const entryPrice = parseFloat(formData.get("entryPrice"));
  const stopLoss = formData.get("stopLoss");
  const takeProfit = formData.get("takeProfit");
  const quantity = parseFloat(formData.get("quantity"));
  const notes = formData.get("notes");
  const orderType = formData.get("orderType");
  const symbol = symbolSelect.value;
  const symbolLabel = symbolSelect.options[symbolSelect.selectedIndex].text;

  const position = {
    id: generateId(),
    symbol,
    symbolLabel,
    direction,
    leverage,
    entryPrice,
    stopLoss,
    takeProfit,
    quantity,
    notes,
    orderType,
    createdAt: Date.now(),
  };

  state.positions.unshift(position);
  renderPositions();

  orderForm.reset();
  document.getElementById("long").checked = true;
  document.getElementById("leverage").value = 10;
}

function handlePositionRemoval(event) {
  const button = event.target.closest(".remove-btn");
  if (!button) return;

  const index = Number(button.dataset.index);
  state.positions.splice(index, 1);
  renderPositions();
}

async function updateMarketSnapshot() {
  const symbol = getBinanceSymbol(symbolSelect.value);
  if (!symbol) return;

  try {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    if (!response.ok) throw new Error("Failed to fetch market snapshot");
    const data = await response.json();

    state.markPrice = parseFloat(data.lastPrice);
    state.markChange = parseFloat(data.priceChangePercent);
    state.quoteVolume = parseFloat(data.quoteVolume);

    renderMarketSnapshot();
    renderPositions();
  } catch (error) {
    console.error("Ошибка загрузки данных тикера", error);
  }
}

function renderMarketSnapshot() {
  markPriceEl.textContent = state.markPrice ? formatPrice(state.markPrice) : "—";

  const change = state.markChange ?? null;
  priceChangeEl.textContent = change !== null ? formatPercent(change) : "—";
  priceChangeEl.classList.toggle("positive", change !== null && change > 0);
  priceChangeEl.classList.toggle("negative", change !== null && change < 0);

  priceVolumeEl.textContent = state.quoteVolume ? `${formatVolume(state.quoteVolume)} USDT` : "—";
}

async function updateOrderBook() {
  const symbol = getBinanceSymbol(symbolSelect.value);
  if (!symbol) return;

  try {
    const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=10`);
    if (!response.ok) throw new Error("Failed to fetch order book");
    const data = await response.json();

    renderOrderBookSide(asksList, data.asks.slice(0, 10).reverse());
    renderOrderBookSide(bidsList, data.bids.slice(0, 10));
  } catch (error) {
    console.error("Ошибка загрузки стакана", error);
  }
}

function renderOrderBookSide(container, levels) {
  container.innerHTML = "";
  let cumulative = 0;

  levels.forEach((level) => {
    const price = parseFloat(level[0]);
    const quantity = parseFloat(level[1]);
    cumulative += quantity;

    const row = document.createElement("div");
    row.className = "orderbook-row";
    row.innerHTML = `
      <span>${formatPrice(price)}</span>
      <span>${formatNumber(quantity, 3)}</span>
      <span>${formatNumber(cumulative, 3)}</span>
    `;

    container.appendChild(row);
  });
}

async function updateRecentTrades() {
  const symbol = getBinanceSymbol(symbolSelect.value);
  if (!symbol) return;

  try {
    const response = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=14`);
    if (!response.ok) throw new Error("Failed to fetch trades");
    const data = await response.json();

    tradesList.innerHTML = "";

    data.reverse().forEach((trade) => {
      const row = document.createElement("div");
      const price = parseFloat(trade.p);
      const quantity = parseFloat(trade.q);
      const time = new Date(trade.T).toLocaleTimeString("ru-RU", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      row.className = `trades-row ${trade.m ? "negative" : "positive"}`;
      row.innerHTML = `
        <span>${time}</span>
        <span>${formatPrice(price)}</span>
        <span>${formatNumber(quantity, 3)}</span>
      `;

      tradesList.appendChild(row);
    });
  } catch (error) {
    console.error("Ошибка загрузки ленты", error);
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  updateMarketSnapshot();
  updateOrderBook();
  updateRecentTrades();

  state.refreshTimer = setInterval(() => {
    updateMarketSnapshot();
    updateOrderBook();
    updateRecentTrades();
  }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
}

async function loadTickerTape() {
  try {
    const tickers = await Promise.all(
      TICKER_SYMBOLS.map((symbol) =>
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    );

    const cleaned = tickers
      .filter(Boolean)
      .map((item) => ({
        symbol: item.symbol,
        lastPrice: parseFloat(item.lastPrice),
        change: parseFloat(item.priceChangePercent),
      }));

    renderTickerTape(cleaned);
  } catch (error) {
    console.error("Ошибка загрузки тикера", error);
  }
}

function renderTickerTape(entries) {
  if (!entries.length) return;

  tickerTape.innerHTML = "";

  const createRow = () => {
    const row = document.createElement("div");
    row.className = "ticker-row";
    entries.forEach((item) => {
      const span = document.createElement("span");
      span.className = item.change >= 0 ? "positive" : "negative";
      span.innerHTML = `${item.symbol.replace("USDT", "/USDT")} <strong>${formatPrice(item.lastPrice)}</strong> <strong>${formatPercent(item.change)}</strong>`;
      row.appendChild(span);
    });
    return row;
  };

  const baseRow = createRow();
  const cloneRow = baseRow.cloneNode(true);
  baseRow.style.animationDelay = "0s";
  cloneRow.style.animationDelay = "-12s";

  tickerTape.appendChild(baseRow);
  tickerTape.appendChild(cloneRow);
}

function togglePnlEditing() {
  state.isEditing = !state.isEditing;
  pnlEditToggle.classList.toggle("active", state.isEditing);

  floatingPnlEl.contentEditable = state.isEditing;
  floatingRoiEl.contentEditable = state.isEditing;

  floatingPnlEl.classList.toggle("editable", state.isEditing);
  floatingRoiEl.classList.toggle("editable", state.isEditing);

  if (state.isEditing) {
    floatingPnlEl.focus();
    const selection = window.getSelection?.();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(floatingPnlEl);
      selection.addRange(range);
    }
  } else {
    const selection = window.getSelection?.();
    selection?.removeAllRanges();
    renderPositions();
  }
}

function handleSymbolChange(event) {
  const symbol = event.target.value;
  initTradingView(symbol);
  startAutoRefresh();
}

symbolSelect.addEventListener("change", handleSymbolChange);
orderForm.addEventListener("submit", handleOrderSubmit);
positionsTableBody.addEventListener("click", handlePositionRemoval);
pnlEditToggle.addEventListener("click", togglePnlEditing);

initTradingView(symbolSelect.value);
renderPositions();
startAutoRefresh();
loadTickerTape();

state.tickerTimer = setInterval(loadTickerTape, 60_000);

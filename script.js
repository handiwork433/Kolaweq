const symbolSelect = document.getElementById("symbol-select");
const orderForm = document.getElementById("order-form");
const positionsTable = document.getElementById("positions-table");
const totalTrades = document.getElementById("total-trades");
const longShortRatio = document.getElementById("long-short-ratio");

let widget;
let positions = [];

function initTradingView(symbol) {
  if (widget) {
    widget.onChartReady(() => {
      widget.chart().setSymbol(symbol, () => {});
    });
    return;
  }

  widget = new TradingView.widget({
    width: "100%",
    height: 610,
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

function renderPositions() {
  positionsTable.innerHTML = "";

  positions.forEach((position, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${position.symbolLabel}</td>
      <td><span class="tag ${position.direction.toLowerCase()}">${position.direction}</span></td>
      <td>${position.entryPrice ?? "—"}</td>
      <td>${position.quantity ?? "—"}</td>
      <td>${position.leverage}x</td>
      <td>${position.stopLoss || "—"}</td>
      <td>${position.takeProfit || "—"}</td>
      <td>${position.notes || ""}</td>
      <td><button class="remove-btn" data-index="${index}">×</button></td>
    `;
    positionsTable.appendChild(row);
  });

  totalTrades.textContent = positions.length;
  const longCount = positions.filter((p) => p.direction === "Long").length;
  const shortCount = positions.filter((p) => p.direction === "Short").length;
  longShortRatio.textContent = `${longCount} / ${shortCount}`;
}

function handleOrderSubmit(event) {
  event.preventDefault();

  const formData = new FormData(orderForm);
  const direction = formData.get("direction") || "Long";
  const leverage = Number(formData.get("leverage")) || 1;
  const entryPrice = formData.get("entryPrice");
  const stopLoss = formData.get("stopLoss");
  const takeProfit = formData.get("takeProfit");
  const quantity = formData.get("quantity");
  const notes = formData.get("notes");
  const symbol = symbolSelect.value;
  const symbolLabel = symbolSelect.options[symbolSelect.selectedIndex].text;

  const position = {
    symbol,
    symbolLabel,
    direction,
    leverage,
    entryPrice,
    stopLoss,
    takeProfit,
    quantity,
    notes,
  };

  positions.unshift(position);
  renderPositions();
  orderForm.reset();
  document.getElementById("long").checked = true;
  document.getElementById("leverage").value = 10;
}

function handlePositionRemoval(event) {
  const button = event.target.closest(".remove-btn");
  if (!button) return;

  const index = Number(button.dataset.index);
  positions.splice(index, 1);
  renderPositions();
}

function handleSymbolChange(event) {
  const symbol = event.target.value;
  initTradingView(symbol);
}

symbolSelect.addEventListener("change", handleSymbolChange);
orderForm.addEventListener("submit", handleOrderSubmit);
positionsTable.addEventListener("click", handlePositionRemoval);

initTradingView(symbolSelect.value);

(() => {
  "use strict";

  /*
   * 页面采用“数据 → 情境变换 → 归一化评分 → 解释 → 渲染”的单向流程。
   * 计算与界面尽量分离，是为了让学习者和贡献者能追踪每个结果的来源。
   * 这是透明教学模型，不对应任何真实平台的私有派单代码。
   */

  // 基础候选人：数值刻意制造速度、成本、疲劳与公平之间的冲突。
  const riders = [
    {
      id: "A",
      name: "骑手 A",
      subtitle: "熟练骑手",
      eta: 23.7,
      late: 0,
      cost: 4.9,
      workload: 60,
      fatigue: 92,
      earnings: 82,
      fairness: 100,
      orders: 3,
      color: "#2457f5",
      copy: "距离最近，三笔订单高度顺路；但已经连续工作 4.2 小时。",
    },
    {
      id: "B",
      name: "骑手 B",
      subtitle: "稳定骑手",
      eta: 24.0,
      late: 0,
      cost: 5.4,
      workload: 25,
      fatigue: 32,
      earnings: 38,
      fairness: 42,
      orders: 1,
      color: "#24b47e",
      copy: "距离适中、手头只有一单，是速度与劳动负荷之间的折中选择。",
    },
    {
      id: "C",
      name: "骑手 C",
      subtitle: "新入场骑手",
      eta: 31.5,
      late: 26,
      cost: 7.1,
      workload: 0,
      fatigue: 12,
      earnings: 18,
      fairness: 0,
      orders: 0,
      color: "#eab500",
      copy: "当前最空闲、近期收入最低，但距离餐厅最远，履约成本较高。",
    },
  ];

  // 可调目标。每个 key 必须与 evaluate() 中的指标名一致。
  const controls = [
    { key: "eta", label: "效率", hint: "预计送达", icon: "速", color: "#2457f5" },
    { key: "late", label: "超时", hint: "违约风险", icon: "时", color: "#f04b3e" },
    { key: "cost", label: "成本", hint: "平台支出", icon: "¥", color: "#eab500" },
    { key: "fatigue", label: "疲劳", hint: "身体负担", icon: "劳", color: "#7a48d7" },
    { key: "fairness", label: "公平", hint: "负荷与收入", icon: "衡", color: "#24b47e" },
  ];

  // 预设代表不同的制度选择，而不是“正确/错误”答案。
  const presets = {
    platform: { eta: 50, late: 25, cost: 20, fatigue: 1, fairness: 1 },
    worker: { eta: 25, late: 25, cost: 8, fatigue: 17, fairness: 25 },
  };

  // 情境会改变可观测条件，用于演示预测误差和外部风险如何进入系统。
  const eventEffects = {
    normal: { name: "天气正常", note: "道路与商家状态稳定。" },
    rain: { name: "暴雨突袭", note: "所有路线变慢，远距离骑手承担更多风险。" },
    restaurant: { name: "商家晚出餐", note: "系统预测失准，但晚出的八分钟通常仍计入履约。" },
    elevator: { name: "顾客电梯故障", note: "最后一百米突然增加六分钟，历史平均值失灵。" },
  };

  // 页面级状态：所有派单重算都从这里读取当前政策和交互选择。
  let weights = { ...presets.platform };
  let activePreset = "platform";
  let selectedRider = "A";
  let lastWinner = "A";
  let soundEnabled = true;
  let toastTimer;

  // 轻量 DOM 帮助函数，避免引入框架和构建依赖。
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // 音效只提供反馈；失败或关闭时不能影响任何核心操作。
  function playTone(frequency = 520, duration = 0.055) {
    if (!soundEnabled || !window.AudioContext) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      oscillator.addEventListener("ended", () => context.close());
    } catch (_) {
      // Sound is optional; interaction must not depend on it.
    }
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  // 根据 controls 生成控件，避免 HTML 与算法指标清单出现两份真相。
  function renderSliders() {
    const root = $("#weight-sliders");
    root.innerHTML = controls
      .map(
        (control) => `
          <label class="slider-row" style="--slider-color:${control.color}">
            <span class="slider-icon" aria-hidden="true">${control.icon}</span>
            <span class="slider-main">
              <span class="slider-label"><span>${control.label}</span><small>${control.hint}</small></span>
              <input
                id="weight-${control.key}"
                data-weight="${control.key}"
                type="range"
                min="0"
                max="60"
                step="1"
                value="${weights[control.key]}"
                aria-label="${control.label}权重"
                style="--range-fill:${(weights[control.key] / 60) * 100}%"
              />
            </span>
            <output class="slider-value" id="value-${control.key}">${weights[control.key]}%</output>
          </label>`,
      )
      .join("");

    $$('[data-weight]').forEach((input) => {
      input.addEventListener("input", (event) => {
        const key = event.currentTarget.dataset.weight;
        weights[key] = Number(event.currentTarget.value);
        event.currentTarget.style.setProperty("--range-fill", `${(weights[key] / 60) * 100}%`);
        $(`#value-${key}`).textContent = `${weights[key]}%`;
        setPreset("custom", false);
        refreshDecision(false);
      });
      input.addEventListener("change", () => playTone(440, 0.04));
    });
  }

  function setPreset(name, updateValues = true) {
    activePreset = name;
    $$(".preset").forEach((button) => button.classList.toggle("active", button.dataset.preset === name));
    if (updateValues && presets[name]) {
      weights = { ...presets[name] };
      controls.forEach(({ key }) => {
        const input = $(`#weight-${key}`);
        input.value = weights[key];
        input.style.setProperty("--range-fill", `${(weights[key] / 60) * 100}%`);
        $(`#value-${key}`).textContent = `${weights[key]}%`;
      });
      $("#fatigue-guard").checked = name === "worker";
      refreshDecision(false);
      showToast(name === "worker" ? "已切换：疲劳与分配公平进入核心目标" : "已切换：速度、超时与成本占据主要权重");
      playTone(name === "worker" ? 620 : 480);
    }
  }

  /**
   * 将课堂事件应用到候选人快照，不修改原始数据。
   * @param {Array<object>} source 基础候选人列表。
   * @param {string} eventName 当前事件标识。
   * @returns {Array<object>} 可安全用于本轮评分的新列表。
   */
  function getScenarioRiders(source = riders, eventName = $("#event-select")?.value || "normal") {
    return source.map((original, index) => {
      const rider = { ...original };
      if (eventName === "rain") {
        const penalty = [3.8, 5.2, 8.6][index];
        rider.eta += penalty;
        rider.fatigue = Math.min(100, rider.fatigue + [4, 7, 10][index]);
        rider.cost += 1.2;
      } else if (eventName === "restaurant") {
        rider.eta += 8;
        rider.cost += 0.8;
      } else if (eventName === "elevator") {
        rider.eta += 6;
        rider.fatigue = Math.min(100, rider.fatigue + 2);
      }
      rider.late = Math.max(rider.late, ((rider.eta - 25) / 25) * 100, 0);
      return rider;
    });
  }

  /**
   * 对同一轮候选人的某项指标做 min-max 归一化。
   * 所有人数值相同时返回 0，表示该指标不能区分本轮候选人。
   */
  function normalize(items, key) {
    const values = items.map((item) => item[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return items.map(() => 0);
    return values.map((value) => (value - min) / (max - min));
  }

  /**
   * 执行核心派单评分。
   * 先应用疲劳硬约束，再计算归一化加权成本；score 越低越优先。
   * 平分时用 ETA 作为稳定、可解释的次级排序条件。
   *
   * @returns {{results: Array<object>, winner: object|undefined}}
   */
  function evaluate(weightSet = weights, source = getScenarioRiders(), guard = $("#fatigue-guard")?.checked || false) {
    const keys = ["eta", "late", "cost", "fatigue", "fairness"];
    const normalized = Object.fromEntries(keys.map((key) => [key, normalize(source, key)]));
    const totalWeight = Math.max(1, keys.reduce((sum, key) => sum + weightSet[key], 0));
    const results = source.map((rider, index) => {
      const parts = Object.fromEntries(
        keys.map((key) => [key, (normalized[key][index] * weightSet[key]) / totalWeight]),
      );
      return {
        ...rider,
        parts,
        score: Object.values(parts).reduce((sum, value) => sum + value, 0),
        eligible: !(guard && rider.fatigue > 85),
      };
    });
    const eligible = results.filter((result) => result.eligible);
    const winner = [...eligible].sort((a, b) => a.score - b.score || a.eta - b.eta)[0];
    return { results, winner };
  }

  /**
   * 把计算结果翻译成人能讨论的理由。
   * 提醒：这里的解释必须跟随 winner 的真实指标，不可写成脱离计算的宣传语。
   */
  function winnerExplanation(winner, resultSet) {
    if (!winner) return "没有骑手符合当前硬约束。";
    if (winner.id === "A" && winner.fatigue >= 85) return "速度和顺路优势压过了极高的疲劳风险。";
    if (winner.id === "B") return "系统放弃了极限速度，选择负荷、疲劳与履约之间的折中。";
    if (winner.id === "C") return "收入与负荷均衡获得高权重，平台接受了更长的送达时间。";
    const lowestPart = Object.entries(winner.parts).sort((a, b) => a[1] - b[1])[0][0];
    return `骑手在“${controls.find((control) => control.key === lowestPart)?.label || "综合"}”指标上形成优势。`;
  }

  // 决策透视表直接使用 evaluation，保证排名、状态与主结果来自同一次计算。
  function renderScoreTable(evaluation) {
    const body = $("#score-table-body");
    body.innerHTML = evaluation.results
      .map(
        (rider) => `
          <tr class="${rider.id === evaluation.winner?.id ? "is-winner" : ""}">
            <td><button class="table-rider" data-rider="${rider.id}" type="button"><span class="mini-token ${rider.id}">${rider.id}</span>${rider.name}</button></td>
            <td>${rider.eta.toFixed(1)} 分</td>
            <td>${rider.workload}%</td>
            <td>${Math.round(rider.fatigue)}%</td>
            <td>¥${rider.earnings}</td>
            <td><strong>${rider.score.toFixed(3)}</strong></td>
            <td><span class="status-chip ${rider.eligible ? "" : "blocked"}">${rider.eligible ? (rider.id === evaluation.winner?.id ? "获得订单" : "候选") : "疲劳拦截"}</span></td>
          </tr>`,
      )
      .join("");
    $$('[data-rider]', body).forEach((button) => button.addEventListener("click", () => selectRider(button.dataset.rider)));
  }

  function applyWinner(evaluation, animate = false) {
    const winner = evaluation.winner;
    if (!winner) {
      showToast("当前没有符合硬约束的骑手，请关闭疲劳保护线或调整场景。");
      return;
    }
    lastWinner = winner.id;
    $("#winner-name").textContent = winner.name;
    $("#winner-eta").innerHTML = `${winner.eta.toFixed(1)}<small> 分</small>`;
    $("#winner-fatigue").innerHTML = `${Math.round(winner.fatigue)}<small>%</small>`;
    $("#winner-score").textContent = winner.score.toFixed(3);
    $("#winner-reason").textContent = winnerExplanation(winner, evaluation.results);

    const token = $("#winner-token");
    token.textContent = winner.id;
    token.className = `winner-token token-${winner.id.toLowerCase()}`;
    token.style.background = winner.color;
    token.style.outlineColor = winner.color;
    token.style.color = winner.id === "C" ? "#132238" : "white";
    $("#result-board").style.setProperty("--winner-color", winner.color);

    $$(".rider-token").forEach((riderToken) => riderToken.classList.toggle("winner", riderToken.dataset.rider === winner.id));
    $$(".route").forEach((route) => route.classList.remove("active-route"));
    $(`#route-${winner.id.toLowerCase()}`).classList.add("active-route");
    $(".route-order").classList.add("active-route");

    const highRisk = winner.fatigue > 85 || winner.late > 15;
    $("#risk-message").innerHTML = highRisk
      ? `<span class="risk-icon">!</span><div><strong>高风险派单</strong><p>${winner.fatigue > 85 ? "系统把疲劳视为可交换的小代价。" : "系统接受了较高的超时概率。"} 改变权重，就是重新分配风险。</p></div>`
      : `<span class="risk-icon">✓</span><div><strong>风险受到约束</strong><p>这一方案降低了个体压力，但仍可能付出时间或成本代价。</p></div>`;

    if (animate) {
      const board = $("#result-board");
      board.classList.remove("reveal");
      void board.offsetWidth;
      board.classList.add("reveal");
      playTone(winner.id === "A" ? 520 : winner.id === "B" ? 650 : 740, 0.1);
    }
  }

  // 单一刷新入口：计算一次，再把同一结果分发给各个视图。
  function refreshDecision(animate = false) {
    const evaluation = evaluate();
    renderScoreTable(evaluation);
    applyWinner(evaluation, animate);
    renderComparisons();
    return evaluation;
  }

  function selectRider(id) {
    selectedRider = id;
    const rider = getScenarioRiders().find((item) => item.id === id);
    $("#drawer-name").textContent = `${rider.name} · ${rider.subtitle}`;
    $("#drawer-copy").textContent = rider.copy;
    $("#drawer-load").textContent = rider.orders;
    $("#drawer-income").textContent = `¥${rider.earnings}`;
    const token = $(".drawer-token");
    token.textContent = rider.id;
    token.className = `drawer-token token-${rider.id.toLowerCase()}`;
    token.style.background = rider.color;
    token.style.outlineColor = rider.color;
    token.style.color = rider.id === "C" ? "#132238" : "white";
    $$(".rider-token").forEach((button) => button.setAttribute("aria-pressed", button.dataset.rider === id ? "true" : "false"));
    playTone(420 + ["A", "B", "C"].indexOf(id) * 90, 0.04);
  }

  function updateEvent() {
    const eventName = $("#event-select").value;
    const weather = $("#weather-layer");
    weather.className = `weather-layer ${eventName === "normal" ? "" : eventName}`;
    showToast(`${eventEffects[eventName].name}：${eventEffects[eventName].note}`);
    refreshDecision(false);
    selectRider(selectedRider);
  }

  function renderComparisons() {
    const platform = evaluate(presets.platform, getScenarioRiders(), false);
    const worker = evaluate(presets.worker, getScenarioRiders(), true);
    renderPolicy("platform", platform);
    renderPolicy("worker", worker);

    const p = platform.winner;
    const w = worker.winner;
    const items = [
      { label: "送达时间", p: `${p.eta.toFixed(1)} 分`, w: `${w.eta.toFixed(1)} 分`, risk: p.eta < w.eta ? "A 更快" : "B 更快" },
      { label: "获单骑手疲劳", p: `${Math.round(p.fatigue)}%`, w: `${Math.round(w.fatigue)}%`, risk: `${Math.abs(p.fatigue - w.fatigue).toFixed(0)} 个百分点差距` },
      { label: "平台成本", p: `¥${p.cost.toFixed(1)}`, w: `¥${w.cost.toFixed(1)}`, risk: `相差 ¥${Math.abs(p.cost - w.cost).toFixed(1)}` },
      { label: "核心取舍", p: "时效优先", w: "风险约束", risk: "不存在免费午餐" },
    ];
    $("#tradeoff-strip").innerHTML = items.map((item) => `<div class="tradeoff-item"><span>${item.label}</span><strong>${item.p} ↔ ${item.w}</strong><em>${item.risk}</em></div>`).join("");
  }

  function renderPolicy(prefix, evaluation) {
    const winner = evaluation.winner;
    $(`#compare-${prefix}-winner`).innerHTML = `
      <span class="mini-token ${winner.id}" style="width:44px;height:44px;font-size:20px">${winner.id}</span>
      <div><strong>${winner.name} 获得订单</strong><span>ETA ${winner.eta.toFixed(1)} 分 · 疲劳 ${Math.round(winner.fatigue)}% · 代价 ${winner.score.toFixed(3)}</span></div>`;
    const labels = { eta: "效率", late: "超时", cost: "成本", fatigue: "疲劳", fairness: "公平" };
    $(`#${prefix}-bars`).innerHTML = Object.entries(prefix === "platform" ? presets.platform : presets.worker)
      .map(([key, value]) => `<div class="mini-bar"><span>${labels[key]}</span><div class="mini-bar-track"><i style="width:${(value / 50) * 100}%"></i></div><strong>${value}%</strong></div>`)
      .join("");
  }

  // 连续模拟让一次派单的局部优势累积成疲劳和收入差距。
  const peakEvents = [
    { icon: "☀", title: "写字楼午餐单", copy: "路线顺畅，承诺 26 分钟。", event: "normal", etaShift: 0 },
    { icon: "雨", title: "阵雨提前到来", copy: "远距离路线额外增加 5 分钟。", event: "rain", etaShift: 4 },
    { icon: "店", title: "商家晚出餐", copy: "系统低估了出餐时间 7 分钟。", event: "restaurant", etaShift: 7 },
    { icon: "急", title: "加急订单", copy: "顾客愿意加价，但承诺只有 20 分钟。", event: "normal", etaShift: -2 },
    { icon: "梯", title: "老旧小区电梯故障", copy: "最后一百米增加 6 分钟。", event: "elevator", etaShift: 6 },
    { icon: "峰", title: "需求峰值", copy: "附近运力不足，这是最后一轮。", event: "normal", etaShift: 2 },
  ];

  let peakState;

  // 每次重置都生成新对象，防止上一局的可变状态泄漏到下一局。
  function initialPeakState() {
    return {
      round: 0,
      onTime: 0,
      totalEta: 0,
      history: [],
      riders: riders.map((rider, index) => ({
        ...rider,
        fatigue: [58, 34, 20][index],
        earnings: [31, 24, 18][index],
        workload: [35, 20, 0][index],
        fairness: [75, 40, 0][index],
        orders: [1, 1, 0][index],
      })),
    };
  }

  function renderPeak() {
    $("#round-count").textContent = peakState.round;
    $("#round-track").innerHTML = peakEvents.map((_, index) => `<span class="round-dot ${index < peakState.round ? "done" : ""}"></span>`).join("");
    $("#peak-riders").innerHTML = peakState.riders
      .map((rider) => {
        const picked = peakState.history.at(-1)?.rider === rider.id;
        return `<article class="peak-rider ${picked ? "just-picked" : ""}">
          <div class="peak-rider-head"><span class="mini-token ${rider.id}">${rider.id}</span><div><strong>${rider.name}</strong><span style="display:block;color:#5d6a7a;font-size:11px">${rider.subtitle}</span></div></div>
          <div class="peak-rider-stats"><span>疲劳<b>${Math.round(rider.fatigue)}%</b></span><span>累计收入<b>¥${Math.round(rider.earnings)}</b></span><div class="fatigue-bar"><i class="${rider.fatigue > 85 ? "warn" : ""}" style="width:${Math.min(100, rider.fatigue)}%"></i></div></div>
        </article>`;
      })
      .join("");

    if (peakState.round === 0) {
      $("#peak-event").innerHTML = `<span class="event-die">?</span><div><strong>等待下一笔订单</strong><p>每轮都会出现不同的路况、商家和顾客条件。</p></div>`;
      $("#metric-rate").textContent = "—";
      $("#metric-eta").textContent = "—";
    } else {
      const event = peakEvents[peakState.round - 1];
      const last = peakState.history.at(-1);
      $("#peak-event").innerHTML = `<span class="event-die">${event.icon}</span><div><strong>${event.title} · 派给骑手 ${last.rider}</strong><p>${event.copy} 本轮 ETA ${last.eta.toFixed(1)} 分钟。</p></div>`;
      $("#metric-rate").textContent = `${Math.round((peakState.onTime / peakState.round) * 100)}%`;
      $("#metric-eta").textContent = `${(peakState.totalEta / peakState.round).toFixed(1)} 分`;
    }
    const fatigues = peakState.riders.map((rider) => rider.fatigue);
    const earnings = peakState.riders.map((rider) => rider.earnings);
    $("#metric-fatigue").textContent = `${Math.round(Math.max(...fatigues))}%`;
    $("#metric-gap").textContent = `¥${Math.round(Math.max(...earnings) - Math.min(...earnings))}`;
    const verdict = $("#ledger-verdict");
    if (peakState.round === 6) {
      const maxFatigue = Math.max(...fatigues);
      verdict.innerHTML = maxFatigue > 90
        ? `<span>模拟结论</span><p>履约数字可能很好看，但最高疲劳已达 ${Math.round(maxFatigue)}%。效率收益被集中压在少数人身上。</p>`
        : `<span>模拟结论</span><p>疲劳受到控制，但平台接受了更高成本或更长时效。这是一种制度取舍，不是技术失败。</p>`;
      $("#next-order").disabled = true;
      $("#next-order").textContent = "模拟完成 ✓";
    } else {
      verdict.innerHTML = `<span>实验提示</span><p>${peakState.round ? "继续运行，观察订单是否越来越集中。" : "先选一套权重，再连续运行六轮。算法的副作用往往需要时间显现。"}</p>`;
      $("#next-order").disabled = false;
      $("#next-order").textContent = "送来下一单 ➜";
    }
  }

  /**
   * 推进一轮高峰模拟：生成情境、派单、累计结果并更新骑手状态。
   * 未获单者得到少量休息；获单者的订单、收入、负荷和疲劳都会变化。
   */
  function nextPeakOrder() {
    if (peakState.round >= 6) return;
    const event = peakEvents[peakState.round];
    const source = peakState.riders.map((rider, index) => ({
      ...rider,
      eta: riders[index].eta + event.etaShift + rider.workload * 0.025,
      late: Math.max(0, ((riders[index].eta + event.etaShift - 25) / 25) * 100),
      cost: riders[index].cost + (event.event === "rain" ? 1.2 : 0),
      fairness: Math.max(0, rider.earnings - Math.min(...peakState.riders.map((item) => item.earnings))) + rider.workload,
    }));
    const evaluation = evaluate(weights, source, $("#fatigue-guard").checked);
    const winner = evaluation.winner || evaluation.results.sort((a, b) => a.fatigue - b.fatigue)[0];
    peakState.round += 1;
    peakState.totalEta += winner.eta;
    if (winner.eta <= 25) peakState.onTime += 1;
    peakState.history.push({ rider: winner.id, eta: winner.eta, event: event.title });
    peakState.riders = peakState.riders.map((rider) => {
      if (rider.id === winner.id) {
        return {
          ...rider,
          fatigue: Math.min(100, rider.fatigue + 8 + rider.orders * 1.5 + (event.event === "rain" ? 5 : 0)),
          earnings: rider.earnings + 7 + (event.event === "rain" ? 2 : 0),
          workload: Math.min(100, rider.workload + 16),
          orders: Math.min(4, rider.orders + 1),
        };
      }
      return { ...rider, fatigue: Math.max(0, rider.fatigue - 2), workload: Math.max(0, rider.workload - 6), orders: Math.max(0, rider.orders - 1) };
    });
    renderPeak();
    playTone(560 + peakState.round * 35, 0.08);
  }

  function resetPeak() {
    peakState = initialPeakState();
    renderPeak();
    showToast("午高峰模拟已重置；它将使用你当前设置的权重。");
  }

  // 导航高亮属于渐进增强；不影响页面阅读和算法操作。
  function initNavigation() {
    const links = $$(".nav-link");
    const sections = links.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
      },
      { rootMargin: "-20% 0px -65%", threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
  }

  // 所有一次性事件绑定集中在初始化阶段，避免重复监听。
  function bindEvents() {
    $$(".preset").forEach((button) => button.addEventListener("click", () => setPreset(button.dataset.preset)));
    $$(".rider-token").forEach((button) => button.addEventListener("click", () => selectRider(button.dataset.rider)));
    $("#event-select").addEventListener("change", updateEvent);
    $("#fatigue-guard").addEventListener("change", () => {
      setPreset("custom", false);
      refreshDecision(false);
      showToast($("#fatigue-guard").checked ? "硬约束已开启：安全不能再被其他指标抵消" : "硬约束已关闭：疲劳重新变成可交换的软指标");
    });
    $("#run-dispatch").addEventListener("click", (event) => {
      const button = event.currentTarget;
      button.classList.add("running");
      button.querySelector("span:first-child").textContent = "计算";
      setTimeout(() => {
        button.classList.remove("running");
        button.querySelector("span:first-child").textContent = "运行派单";
        const evaluation = refreshDecision(true);
        selectRider(evaluation.winner?.id || selectedRider);
        showToast(`派单完成：${evaluation.winner?.name || "无人"} 的综合代价最低`);
      }, 430);
    });
    $("#formula-help").addEventListener("click", () => $("#formula-dialog").showModal());
    $("#dialog-close").addEventListener("click", () => $("#formula-dialog").close());
    $("#formula-dialog").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    });
    $("#next-order").addEventListener("click", nextPeakOrder);
    $("#reset-peak").addEventListener("click", resetPeak);
    $("#run-compare").addEventListener("click", () => {
      renderComparisons();
      playTone(680, 0.08);
      showToast("两套制度已在同一订单上重新计算");
    });
    $("#sound-toggle").addEventListener("click", (event) => {
      soundEnabled = !soundEnabled;
      event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
      event.currentTarget.setAttribute("aria-label", soundEnabled ? "关闭音效" : "开启音效");
      event.currentTarget.textContent = soundEnabled ? "♪" : "×";
      if (soundEnabled) playTone(620, 0.06);
    });
  }

  // 初始化顺序确保控件与监听器就绪后，才进行首次计算和渲染。
  function init() {
    renderSliders();
    bindEvents();
    selectRider("A");
    refreshDecision(false);
    peakState = initialPeakState();
    renderPeak();
    initNavigation();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

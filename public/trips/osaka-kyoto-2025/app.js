(function () {
  "use strict";

  const DATA = window.TRIP_DATA;
  if (!DATA) {
    console.error("TRIP_DATA missing");
    return;
  }

  const STORAGE_KEYS = {
    checklist: "fk18-checklist-v1",
    day4: "fk18-day4-v1",
    expense: "fk18-expense-v1",
    notes: "fk18-notes-v1",
  };

  const CURRENCY = {
    JPY: { symbol: "¥", fractionDigits: 0 },
    TWD: { symbol: "NT$", fractionDigits: 0 },
  };

  const todayIso = formatLocalDate(new Date());

  function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseIso(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDisplayDate(iso) {
    const dt = parseIso(iso);
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    return `${m}/${d}`;
  }

  function daysBetween(fromIso, toIso) {
    const a = parseIso(fromIso);
    const b = parseIso(toIso);
    return Math.round((b - a) / 86400000);
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota */
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getActiveDay() {
    const match = DATA.days.find((d) => d.date === todayIso);
    return match || DATA.days[0];
  }

  function renderHero() {
    document.getElementById("trip-title").textContent = DATA.trip.title;
    document.getElementById("trip-subtitle").textContent = DATA.trip.subtitle;

    const meta = document.getElementById("trip-meta");
    meta.innerHTML = `
      <span>${escapeHtml(formatDisplayDate(DATA.trip.startDate))}–${escapeHtml(
        formatDisplayDate(DATA.trip.endDate)
      )}（${escapeHtml(DATA.trip.startDate.slice(0, 4))}）</span>
      <span>${escapeHtml(DATA.trip.region)}</span>
      <span>6 天</span>
    `;

    const statusEl = document.getElementById("trip-status");
    const start = DATA.trip.startDate;
    const end = DATA.trip.endDate;

    if (todayIso < start) {
      const n = daysBetween(todayIso, start);
      statusEl.textContent = n === 0 ? "今天出發！" : `距離出發還有 ${n} 天`;
    } else if (todayIso > end) {
      statusEl.textContent = "旅途已結束 · 回憶存檔中";
    } else {
      const day = DATA.days.find((d) => d.date === todayIso);
      statusEl.textContent = day
        ? `今日是 Day ${day.day} · ${day.title}`
        : "旅途進行中";
    }
  }

  function renderFlights() {
    const root = document.getElementById("flights-root");
    root.innerHTML = DATA.flights
      .map(
        (f) => `
      <article class="card flight-card">
        <div class="flight-top">
          <span class="flight-dir">${escapeHtml(f.direction)}</span>
          <span class="flight-date">${escapeHtml(formatDisplayDate(f.date))}（${escapeHtml(
            f.weekday
          )}）</span>
        </div>
        <div class="flight-route">
          <div class="flight-city">
            <strong>${escapeHtml(f.fromCode)}</strong>
            <span>${escapeHtml(f.fromName)} ${escapeHtml(f.dep)}</span>
          </div>
          <div class="flight-arrow" aria-hidden="true">→</div>
          <div class="flight-city to">
            <strong>${escapeHtml(f.toCode)}</strong>
            <span>${escapeHtml(f.toName)} ${escapeHtml(f.arr)}</span>
          </div>
        </div>
        <p class="flight-note">${escapeHtml(f.note)}</p>
      </article>
    `
      )
      .join("");
  }

  function renderHotels() {
    const root = document.getElementById("hotels-root");
    root.innerHTML = DATA.hotels
      .map(
        (h) => `
      <article class="card hotel-card${h.nights.includes(todayIso) ? " is-today" : ""}">
        <h3>${escapeHtml(h.name)}</h3>
        <p class="hotel-meta">${escapeHtml(h.nightsLabel)} · ${escapeHtml(h.area)}</p>
        <p class="hotel-tip">${escapeHtml(h.tip)}</p>
        <div class="hotel-actions">
          <a class="btn btn-ghost" href="${escapeHtml(h.mapsUrl)}" target="_blank" rel="noopener noreferrer">
            Google Maps
          </a>
        </div>
      </article>
    `
      )
      .join("");
  }

  function renderTransport() {
    const root = document.getElementById("transport-root");
    root.innerHTML = DATA.transportTips
      .map(
        (t) => `
      <article class="card">
        <h3 style="margin:0 0 0.35rem;font-family:var(--font-display);font-size:1.1rem">${escapeHtml(
          t.title
        )}</h3>
        <p style="margin:0;color:var(--ink-soft);font-size:0.95rem">${escapeHtml(t.detail)}</p>
      </article>
    `
      )
      .join("");
  }

  function renderDays() {
    const tabs = document.getElementById("day-tabs");
    const root = document.getElementById("days-root");
    const active = getActiveDay();

    tabs.innerHTML = DATA.days
      .map((d) => {
        const isToday = d.date === todayIso;
        const isActive = d.day === active.day;
        return `
        <button
          type="button"
          class="day-tab${isActive ? " is-active" : ""}${isToday ? " is-today" : ""}"
          role="tab"
          aria-selected="${isActive}"
          data-day="${d.day}"
          onclick="window.__tripSetDay && window.__tripSetDay(${d.day})"
        >
          Day ${d.day}${isToday ? " · 今" : ""}
        </button>
      `;
      })
      .join("");

    root.innerHTML = DATA.days
      .map((d) => {
        const isActive = d.day === active.day;
        const isToday = d.date === todayIso;
        const freeBlock = d.isFreeDay
          ? `
          <div class="free-options">
            <h4 class="free-options-title">自由日選項 A–E</h4>
            <p class="free-options-sub">勾選你想去的方案（紀錄只存在你自己的裝置）</p>
            <div class="option-grid" id="options-root"></div>
            <div class="card dinner-note">
              <h3 style="margin:0;font-family:var(--font-display);font-size:1.1rem">晚上全員集合・居酒屋</h3>
              <p style="margin:0.45rem 0 0;color:var(--ink-soft)">餐廳與集合時間待定——依大家一日遊結束時間再決定。</p>
            </div>
          </div>`
          : "";
        return `
        <div
          class="day-panel${isActive ? " is-active" : ""}${isToday ? " is-today-panel" : ""}"
          data-day-panel="${d.day}"
          role="tabpanel"
        >
          <div class="day-panel-head">
            <h3>Day ${d.day}（${escapeHtml(formatDisplayDate(d.date))} ${escapeHtml(
              d.weekday
            )}）${escapeHtml(d.title)}</h3>
            <p>${escapeHtml(d.summary)}</p>
          </div>
          <ol class="timeline">
            ${d.slots
              .map(
                (s) => `
              <li class="timeline-item">
                <div class="timeline-time">${escapeHtml(s.time)}</div>
                <div class="timeline-body">
                  <span class="type-tag" data-type="${escapeHtml(s.type)}">${escapeHtml(
                    s.type
                  )}</span>
                  <h4>${escapeHtml(s.title)}</h4>
                  <p>${escapeHtml(s.detail)}</p>
                </div>
              </li>
            `
              )
              .join("")}
          </ol>
          ${freeBlock}
        </div>
      `;
      })
      .join("");

    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".day-tab");
      if (!btn) return;
      const day = Number(btn.dataset.day);
      setActiveDay(day);
    });
  }

  function setActiveDay(day) {
    const target = Number(day);
    document.querySelectorAll(".day-tab").forEach((btn) => {
      const on = Number(btn.dataset.day) === target;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll(".day-panel").forEach((panel) => {
      panel.classList.toggle("is-active", Number(panel.dataset.dayPanel) === target);
    });
  }

  // Expose for reliable tab switching (also used by inline handlers)
  window.__tripSetDay = setActiveDay;

  function renderDay4Options() {
    const selected = new Set(loadJson(STORAGE_KEYS.day4, []));
    const root = document.getElementById("options-root");
    if (!root) return;

    root.innerHTML = DATA.day4Options
      .map((opt) => {
        const checked = selected.has(opt.id);
        return `
        <article class="card option-card${checked ? " is-selected" : ""}" data-option="${escapeHtml(
          opt.id
        )}">
          <div class="option-card-top">
            <div>
              <h3><span class="option-id">${escapeHtml(opt.id)}</span>${escapeHtml(
                opt.title
              )}</h3>
              <p>${escapeHtml(opt.detail)}</p>
            </div>
          </div>
          <label>
            <input
              type="checkbox"
              data-day4="${escapeHtml(opt.id)}"
              ${checked ? "checked" : ""}
            />
            <span>我想去</span>
          </label>
        </article>
      `;
      })
      .join("");

    root.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-day4]");
      if (!input) return;
      const id = input.dataset.day4;
      const current = new Set(loadJson(STORAGE_KEYS.day4, []));
      if (input.checked) current.add(id);
      else current.delete(id);
      saveJson(STORAGE_KEYS.day4, [...current]);
      const card = input.closest(".option-card");
      if (card) card.classList.toggle("is-selected", input.checked);
    });
  }

  function formatMoney(amount, currency) {
    const cfg = CURRENCY[currency] || CURRENCY.JPY;
    const safe = Number.isFinite(amount) ? amount : 0;
    return `${cfg.symbol}${safe.toLocaleString("en-US", {
      minimumFractionDigits: cfg.fractionDigits,
      maximumFractionDigits: cfg.fractionDigits,
    })}`;
  }

  function loadExpenses() {
    const list = loadJson(STORAGE_KEYS.expense, []);
    return Array.isArray(list) ? list : [];
  }

  function renderExpense() {
    const form = document.getElementById("expense-form");
    const listEl = document.getElementById("expense-list");
    const totalsEl = document.getElementById("expense-totals");
    const errorEl = document.getElementById("exp-error");
    const dateEl = document.getElementById("exp-date");
    const itemEl = document.getElementById("exp-item");
    const amtEl = document.getElementById("exp-amt");
    const catEl = document.getElementById("exp-cat");
    const curEl = document.getElementById("exp-cur");
    if (!form || !listEl || !totalsEl) return;

    if (dateEl && !dateEl.value) dateEl.value = todayIso;

    function paint() {
      const items = loadExpenses();

      const totals = items.reduce((acc, it) => {
        const cur = CURRENCY[it.currency] ? it.currency : "JPY";
        acc[cur] = (acc[cur] || 0) + (Number.isFinite(it.amount) ? it.amount : 0);
        return acc;
      }, {});

      totalsEl.innerHTML = Object.keys(CURRENCY)
        .filter((cur) => totals[cur])
        .map(
          (cur) => `
          <div class="total-chip">
            <span class="total-label">合計</span>
            <span class="total-value">${formatMoney(totals[cur], cur)}</span>
          </div>`
        )
        .join("") || `<p class="expense-empty">尚未記錄任何花費。</p>`;

      listEl.innerHTML = items
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.ts - a.ts))
        .map(
          (it) => `
          <li class="expense-item">
            <div class="expense-meta">
              <div class="expense-top">
                <span class="expense-item-name">${escapeHtml(it.item)}</span>
                <span class="expense-amount">${formatMoney(it.amount, it.currency)}</span>
              </div>
              <div class="expense-sub">
                <span class="cat-tag" data-cat="${escapeHtml(it.category)}">${escapeHtml(
                  it.category
                )}</span>
                <span class="expense-date">${escapeHtml(it.date)}</span>
              </div>
            </div>
            <button type="button" class="expense-del" data-del="${escapeHtml(
              it.id
            )}" aria-label="刪除">刪除</button>
          </li>`
        )
        .join("");
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const item = (itemEl.value || "").trim();
      const rawAmt = (amtEl.value || "").trim();
      const amount = Number(rawAmt);
      const date = dateEl.value || todayIso;

      if (!item) {
        showError("請輸入品項名稱");
        return;
      }
      if (rawAmt === "" || !Number.isFinite(amount)) {
        showError("金額必須是數字");
        return;
      }
      if (amount <= 0) {
        showError("金額必須大於 0");
        return;
      }

      hideError();
      const items = loadExpenses();
      items.push({
        id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(),
        date,
        item,
        amount: Math.round(amount * 100) / 100,
        currency: CURRENCY[curEl.value] ? curEl.value : "JPY",
        category: catEl.value || "其他",
      });
      saveJson(STORAGE_KEYS.expense, items);

      itemEl.value = "";
      amtEl.value = "";
      itemEl.focus();
      paint();
    });

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".expense-del");
      if (!btn) return;
      const id = btn.dataset.del;
      const items = loadExpenses().filter((it) => it.id !== id);
      saveJson(STORAGE_KEYS.expense, items);
      paint();
    });

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    function hideError() {
      errorEl.hidden = true;
    }

    paint();
  }

  function renderChecklist() {
    const checked = new Set(loadJson(STORAGE_KEYS.checklist, []));
    const root = document.getElementById("checklist-root");
    const groups = {};

    DATA.checklist.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });

    root.innerHTML = Object.entries(groups)
      .map(([group, items]) => {
        return `
        <p class="group-title">${escapeHtml(group)}</p>
        <ul class="check-list">
          ${items
            .map((item) => {
              const on = checked.has(item.id);
              return `
              <li>
                <label class="${on ? "is-done" : ""}">
                  <input type="checkbox" data-check="${escapeHtml(item.id)}" ${
                    on ? "checked" : ""
                  } />
                  <span>${escapeHtml(item.label)}</span>
                </label>
              </li>
            `;
            })
            .join("")}
        </ul>
      `;
      })
      .join("");

    root.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-check]");
      if (!input) return;
      const id = input.dataset.check;
      const current = new Set(loadJson(STORAGE_KEYS.checklist, []));
      if (input.checked) current.add(id);
      else current.delete(id);
      saveJson(STORAGE_KEYS.checklist, [...current]);
      const label = input.closest("label");
      if (label) label.classList.toggle("is-done", input.checked);
    });
  }

  function bindNotes() {
    const area = document.getElementById("notes-area");
    area.value = localStorage.getItem(STORAGE_KEYS.notes) || "";
    let timer = null;
    area.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEYS.notes, area.value);
        } catch {
          /* ignore */
        }
      }, 200);
    });
  }

  function bindJumpToday() {
    document.getElementById("jump-today").addEventListener("click", () => {
      const day = getActiveDay();
      setActiveDay(day.day);
      document.getElementById("itinerary").scrollIntoView({ behavior: "smooth" });
    });
  }

  function bindNavActive() {
    const links = [...document.querySelectorAll(".nav a")];
    const sections = links
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean);

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  function init() {
    renderHero();
    renderFlights();
    renderHotels();
    renderDays();
    renderDay4Options();
    renderTransport();
    renderExpense();
    renderChecklist();
    bindNotes();
    bindJumpToday();
    bindNavActive();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

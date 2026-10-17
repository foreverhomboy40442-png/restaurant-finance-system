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
    places: "fk18-places-v1",
    notes: "fk18-notes-v1",
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
        const freeLink = d.isFreeDay
          ? `<p style="margin:0.5rem 0 0"><a href="#free-day">查看自由日選項 A–E →</a></p>`
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
            ${freeLink}
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

  function renderPlaces() {
    const state = loadJson(STORAGE_KEYS.places, {});
    const root = document.getElementById("places-root");

    root.innerHTML = DATA.places
      .map((p) => {
        const flag = state[p.id] || "";
        const label =
          flag === "done" ? "已去" : flag === "want" ? "想去" : "標記";
        return `
        <li>
          <div class="place-meta">
            <div class="place-name">${escapeHtml(p.name)}</div>
            <div class="place-sub">${escapeHtml(p.kind)} · Day ${p.day}</div>
          </div>
          <button
            type="button"
            class="place-toggle${flag ? " is-on" : ""}"
            data-place="${escapeHtml(p.id)}"
            aria-pressed="${flag ? "true" : "false"}"
          >${label}</button>
        </li>
      `;
      })
      .join("");

    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".place-toggle");
      if (!btn) return;
      const id = btn.dataset.place;
      const current = loadJson(STORAGE_KEYS.places, {});
      const prev = current[id] || "";
      const next = prev === "" ? "want" : prev === "want" ? "done" : "";
      if (next) current[id] = next;
      else delete current[id];
      saveJson(STORAGE_KEYS.places, current);
      btn.classList.toggle("is-on", Boolean(next));
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      btn.textContent = next === "done" ? "已去" : next === "want" ? "想去" : "標記";
    });
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
    renderPlaces();
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

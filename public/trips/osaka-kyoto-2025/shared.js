// Shared-mode layer: when window.TRIP_SHARED is set, connect to the
// trip's own Supabase project for live expenses, message board and
// Day4 votes. No-op in personal mode.
//
// Classic (non-module) script: in shared mode it lazy-loads the Supabase
// UMD bundle so simple static hosts that do not execute ES modules still
// work, and personal mode never pays for the library.
(function () {
  "use strict";

  const CFG = window.TRIP_SHARED;
  if (!CFG) return;

  const TRIP = CFG.trip || "osaka-kyoto-2026";
  const MEMBER_KEY = "fk18-member";
  const CURRENCY = {
    JPY: { symbol: "¥", fractionDigits: 0 },
    TWD: { symbol: "NT$", fractionDigits: 0 },
  };

  const SUPABASE_UMD =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

  let supabase = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("load failed: " + src));
      document.head.appendChild(s);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(amount, currency) {
    const cfg = CURRENCY[currency] || CURRENCY.JPY;
    const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return `${cfg.symbol}${safe.toLocaleString("en-US", {
      minimumFractionDigits: cfg.fractionDigits,
      maximumFractionDigits: cfg.fractionDigits,
    })}`;
  }

  function getMember() {
    return (localStorage.getItem(MEMBER_KEY) || "").trim();
  }
  function setMember(name) {
    localStorage.setItem(MEMBER_KEY, name.trim());
  }

  // ---------- lightweight name modal ----------
  function memberList() {
    try {
      const m = window.TRIP_DATA && window.TRIP_DATA.members;
      return Array.isArray(m) ? m.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function askName() {
    return new Promise((resolve) => {
      const members = memberList();
      const chips = members
        .map(
          (m) =>
            `<button type="button" class="member-pick" data-name="${esc(
              m
            )}">${esc(m)}</button>`
        )
        .join("");
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <h3>你是哪一位？</h3>
          <p>點選你的名字就能加入，大家會看到是誰記帳／留言。</p>
          ${chips ? `<div class="member-picks">${chips}</div>` : ""}
          <input type="text" id="member-name" class="exp-input exp-grow" placeholder="或自行輸入名字" maxlength="20" />
          <button type="button" class="btn btn-primary" id="member-ok">進入</button>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector("#member-name");
      const ok = overlay.querySelector("#member-ok");
      input.value = getMember();
      function finish(v) {
        setMember(v);
        overlay.remove();
        resolve(v);
      }
      function submit() {
        const v = (input.value || "").trim();
        if (!v) {
          input.focus();
          return;
        }
        finish(v);
      }
      overlay.querySelectorAll(".member-pick").forEach((btn) => {
        btn.addEventListener("click", () => finish(btn.dataset.name));
      });
      ok.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
    });
  }

  // ---------- relabel personal-mode copy for shared mode ----------
  function relabelShared() {
    const head = document.querySelector("#expense .section-head");
    if (head) {
      const h = head.querySelector("h2");
      const p = head.querySelector("p");
      if (h) h.textContent = "共享記帳";
      if (p) p.textContent = "大家的花費即時同步，並顯示每人分攤";
    }
  }

  // ---------- shared bar ----------
  function renderBar(member) {
    const bar = document.getElementById("shared-bar");
    if (!bar) return;
    bar.hidden = false;
    bar.innerHTML = `
      <span class="shared-dot" aria-hidden="true"></span>
      <span>共享已連線 · 你是 <strong>${esc(member)}</strong></span>
      <button type="button" class="shared-switch" id="shared-switch">切換身分</button>`;
    bar.querySelector("#shared-switch").addEventListener("click", async () => {
      const name = await askName();
      renderBar(name);
      refreshAll();
    });
  }

  // ---------- expenses ----------
  async function loadExpenses() {
    const { data, error } = await supabase
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", TRIP)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }

  function paintExpenses(items) {
    const totalsEl = document.getElementById("expense-totals");
    const listEl = document.getElementById("expense-list");
    if (!totalsEl || !listEl) return;

    const totals = {};
    const perMember = {};
    items.forEach((it) => {
      const cur = CURRENCY[it.currency] ? it.currency : "JPY";
      const amt = Number(it.amount) || 0;
      totals[cur] = (totals[cur] || 0) + amt;
      perMember[it.member] = perMember[it.member] || {};
      perMember[it.member][cur] = (perMember[it.member][cur] || 0) + amt;
    });

    const totalChips = Object.keys(CURRENCY)
      .filter((c) => totals[c])
      .map(
        (c) =>
          `<div class="total-chip"><span class="total-label">總計</span><span class="total-value">${money(
            totals[c],
            c
          )}</span></div>`
      )
      .join("");

    const memberChips = Object.keys(perMember)
      .map((m) => {
        const parts = Object.keys(perMember[m])
          .map((c) => money(perMember[m][c], c))
          .join(" + ");
        return `<div class="member-chip"><span class="member-chip-name">${esc(
          m
        )}</span><span>${parts}</span></div>`;
      })
      .join("");

    totalsEl.innerHTML =
      (totalChips || `<p class="expense-empty">尚未有人記帳。</p>`) +
      (memberChips ? `<div class="member-tally">${memberChips}</div>` : "");

    listEl.innerHTML = items
      .map(
        (it) => `
      <li class="expense-item">
        <div class="expense-meta">
          <div class="expense-top">
            <span class="expense-item-name">${esc(it.item)}</span>
            <span class="expense-amount">${money(it.amount, it.currency)}</span>
          </div>
          <div class="expense-sub">
            <span class="cat-tag" data-cat="${esc(it.category)}">${esc(it.category)}</span>
            <span class="who">${esc(it.member)}</span>
            <span class="expense-date">${esc(it.spent_on)}</span>
          </div>
        </div>
        <button type="button" class="expense-del" data-del="${esc(it.id)}" aria-label="刪除">刪除</button>
      </li>`
      )
      .join("");
  }

  async function refreshExpenses() {
    paintExpenses(await loadExpenses());
  }

  function bindExpenseForm() {
    const form = document.getElementById("expense-form");
    const listEl = document.getElementById("expense-list");
    const errorEl = document.getElementById("exp-error");
    const dateEl = document.getElementById("exp-date");
    const itemEl = document.getElementById("exp-item");
    const amtEl = document.getElementById("exp-amt");
    const catEl = document.getElementById("exp-cat");
    const curEl = document.getElementById("exp-cur");
    if (!form) return;

    if (dateEl && !dateEl.value) {
      const d = new Date();
      dateEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const item = (itemEl.value || "").trim();
      const raw = (amtEl.value || "").trim();
      const amount = Number(raw);
      if (!item) return showErr("請輸入品項名稱");
      if (raw === "" || !Number.isFinite(amount)) return showErr("金額必須是數字");
      if (amount <= 0) return showErr("金額必須大於 0");
      hideErr();

      const payload = {
        trip_id: TRIP,
        member: getMember() || "匿名",
        item,
        amount: Math.round(amount * 100) / 100,
        currency: CURRENCY[curEl.value] ? curEl.value : "JPY",
        category: catEl.value || "其他",
        spent_on: dateEl.value || undefined,
      };
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const { error } = await supabase.from("trip_expenses").insert(payload);
      btn.disabled = false;
      if (error) return showErr("儲存失敗，請重試");
      itemEl.value = "";
      amtEl.value = "";
      itemEl.focus();
      refreshExpenses();
    });

    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".expense-del");
      if (!btn) return;
      btn.disabled = true;
      const { error } = await supabase
        .from("trip_expenses")
        .delete()
        .eq("id", btn.dataset.del);
      if (error) btn.disabled = false;
      refreshExpenses();
    });

    function showErr(m) {
      errorEl.textContent = m;
      errorEl.hidden = false;
    }
    function hideErr() {
      errorEl.hidden = true;
    }
  }

  // ---------- message board ----------
  async function loadMessages() {
    const { data, error } = await supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", TRIP)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
        d.getDate()
      ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }

  function paintMessages(items) {
    const listEl = document.getElementById("board-list");
    if (!listEl) return;
    const me = getMember();
    listEl.innerHTML = items
      .map(
        (m) => `
      <li class="board-item${m.member === me ? " is-me" : ""}">
        <div class="board-bubble">
          <div class="board-who">${esc(m.member)} <span class="board-time">${fmtTime(
            m.created_at
          )}</span></div>
          <div class="board-body">${esc(m.body)}</div>
        </div>
      </li>`
      )
      .join("");
    listEl.scrollTop = listEl.scrollHeight;
  }

  async function refreshMessages() {
    paintMessages(await loadMessages());
  }

  function bindBoard() {
    const section = document.getElementById("board");
    if (!section) return;
    section.querySelectorAll(".board-hint-personal").forEach((e) => (e.hidden = true));
    section.querySelectorAll(".board-hint-shared").forEach((e) => (e.hidden = false));
    const wrap = section.querySelector(".board-wrap");
    if (wrap) wrap.hidden = false;

    const form = document.getElementById("board-form");
    const input = document.getElementById("board-input");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = (input.value || "").trim();
      if (!body) return;
      input.value = "";
      const { error } = await supabase.from("trip_messages").insert({
        trip_id: TRIP,
        member: getMember() || "匿名",
        body,
      });
      if (error) {
        input.value = body;
        return;
      }
      refreshMessages();
    });
  }

  // ---------- day4 votes ----------
  async function loadVotes() {
    const { data, error } = await supabase
      .from("trip_day4_votes")
      .select("*")
      .eq("trip_id", TRIP);
    if (error) {
      console.error(error);
      return [];
    }
    return data || [];
  }

  function paintVotes(votes) {
    const me = getMember();
    const byOption = {};
    votes.forEach((v) => {
      byOption[v.option_id] = byOption[v.option_id] || [];
      byOption[v.option_id].push(v.member);
    });
    document.querySelectorAll(".option-card").forEach((card) => {
      const id = card.dataset.option;
      const voters = byOption[id] || [];
      const input = card.querySelector("input[data-day4]");
      if (input) input.checked = voters.includes(me);
      card.classList.toggle("is-selected", voters.includes(me));
      let tally = card.querySelector(".vote-tally");
      if (!tally) {
        tally = document.createElement("div");
        tally.className = "vote-tally";
        card.appendChild(tally);
      }
      tally.innerHTML = voters.length
        ? `<span class="vote-count">${voters.length} 票</span> ${voters
            .map((m) => `<span class="voter">${esc(m)}</span>`)
            .join("")}`
        : `<span class="vote-count vote-zero">還沒有人選</span>`;
    });
  }

  async function refreshVotes() {
    paintVotes(await loadVotes());
  }

  function bindVotes() {
    const root = document.getElementById("options-root");
    if (!root) return;
    root.addEventListener("change", async (e) => {
      const input = e.target.closest("input[data-day4]");
      if (!input) return;
      const id = input.dataset.day4;
      const me = getMember() || "匿名";
      if (input.checked) {
        await supabase
          .from("trip_day4_votes")
          .upsert({ trip_id: TRIP, member: me, option_id: id });
      } else {
        await supabase
          .from("trip_day4_votes")
          .delete()
          .eq("trip_id", TRIP)
          .eq("member", me)
          .eq("option_id", id);
      }
      refreshVotes();
    });
  }

  function refreshAll() {
    refreshExpenses();
    refreshMessages();
    refreshVotes();
  }

  function subscribe() {
    supabase
      .channel("trip-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_expenses", filter: `trip_id=eq.${TRIP}` },
        refreshExpenses
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_messages", filter: `trip_id=eq.${TRIP}` },
        refreshMessages
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_day4_votes", filter: `trip_id=eq.${TRIP}` },
        refreshVotes
      )
      .subscribe();
  }

  async function init() {
    try {
      await loadScript(SUPABASE_UMD);
    } catch (e) {
      console.error("Supabase 載入失敗", e);
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      console.error("Supabase UMD 全域未就緒");
      return;
    }
    supabase = window.supabase.createClient(
      CFG.url.replace(/\/$/, ""),
      CFG.key,
      { auth: { persistSession: false } }
    );

    relabelShared();
    let member = getMember();
    if (!member) member = await askName();
    renderBar(member);
    bindExpenseForm();
    bindBoard();
    bindVotes();
    await refreshAll();
    subscribe();
    window.__tripRefreshAll = refreshAll;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

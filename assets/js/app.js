(function () {
  "use strict";

  const state = {
    category: "all",
    query: "",
    plans: [],
    categories: [],
    broker: null,
    expandedId: null,
  };

  const els = {
    chipRow: document.getElementById("chipRow"),
    searchInput: document.getElementById("searchInput"),
    grid: document.getElementById("grid"),
    resultsMeta: document.getElementById("resultsMeta"),
    themeToggle: document.getElementById("themeToggle"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalClose: document.getElementById("modalClose"),
    modalPlanName: document.getElementById("modalPlanName"),
    modalBrokerName: document.getElementById("modalBrokerName"),
    modalAvatar: document.getElementById("modalAvatar"),
    modalLineBtn: document.getElementById("modalLineBtn"),
  };

  let pendingPlan = null;

  /* ---------------- Theme ---------------- */
  function initTheme() {
    const saved = localStorage.getItem("prakan_theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const current = document.documentElement.getAttribute("data-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = current ? current === "dark" : prefersDark;
    els.themeToggle.textContent = isDark ? "☀️" : "🌙";
  }

  els.themeToggle.addEventListener("click", () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = document.documentElement.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("prakan_theme", next);
    updateThemeIcon();
  });

  /* ---------------- Rendering ---------------- */
  function formatPrice(n) {
    return "฿" + n.toLocaleString("th-TH");
  }

  function renderChips() {
    const all = [{ key: "all", name_th: "ทั้งหมด", emoji: "✨", color: "#6c5ce7" }, ...state.categories];
    els.chipRow.innerHTML = all
      .map(
        (c) => `
        <button class="chip ${c.key === state.category ? "active" : ""}" data-key="${c.key}" type="button">
          <span>${c.emoji}</span><span>${c.name_th}</span>
        </button>`
      )
      .join("");

    els.chipRow.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.key;
        refresh();
      });
    });
  }

  function cardTemplate(plan, index) {
    const cat = plan.category;
    const popular = plan.is_popular
      ? `<span class="badge-popular">🔥 ยอดนิยม</span>`
      : "<span></span>";
    const isOpen = state.expandedId === plan.id;

    return `
      <article class="card" style="animation-delay:${index * 60}ms" data-id="${plan.id}">
        <div class="card-top">
          <span class="badge" style="background:${cat.color}">${cat.emoji} ${cat.name_th}</span>
          ${popular}
        </div>
        <div>
          <div class="card-insurer">${plan.insurer.name_th}</div>
          <h3 class="card-title">${plan.plan_name}</h3>
        </div>
        <div class="card-price">
          <span class="amount">${formatPrice(plan.premium_starting_at)}</span>
          <span class="unit">/ ${plan.premium_unit}</span>
        </div>
        <ul class="feature-list">
          ${plan.features.map((f) => `<li>${f}</li>`).join("")}
        </ul>
        <div class="card-actions">
          <button class="btn-detail ${isOpen ? "open" : ""}" data-detail="${plan.id}" type="button">
            <span>ดูรายละเอียด &amp; ข้อยกเว้น</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="card-detail ${isOpen ? "open" : ""}" id="detail-${plan.id}">
            <div class="card-detail-inner">
              <h4>ความคุ้มครองเด่น</h4>
              <ul><li>✓ ${plan.coverage_highlight}</li></ul>
              <h4>ข้อยกเว้นสำคัญ</h4>
              <ul class="exclusions">
                ${plan.exclusions.map((e) => `<li>${e}</li>`).join("")}
              </ul>
            </div>
          </div>
          <button class="btn-cta" data-interest="${plan.id}" type="button">
            <span>💬 สนใจ ทักไลน์เลย</span>
          </button>
        </div>
      </article>`;
  }

  function emptyStateTemplate() {
    return `
      <div class="empty-state">
        <span class="emoji">🧊😅</span>
        <h3>ยังไม่เจอแผนที่ตรงใจเลย</h3>
        <p>ลองเปลี่ยนหมวดหรือคำค้นหาดูอีกทีนะ</p>
        <button class="btn-reset" id="resetFilters" type="button">ล้างตัวกรองทั้งหมด</button>
      </div>`;
  }

  function renderGrid() {
    if (state.plans.length === 0) {
      els.grid.innerHTML = emptyStateTemplate();
      const resetBtn = document.getElementById("resetFilters");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          state.category = "all";
          state.query = "";
          els.searchInput.value = "";
          refresh();
        });
      }
      return;
    }

    els.grid.innerHTML = state.plans.map((p, i) => cardTemplate(p, i)).join("");

    els.grid.querySelectorAll("[data-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.detail;
        state.expandedId = state.expandedId === id ? null : id;
        const detail = document.getElementById(`detail-${id}`);
        detail.classList.toggle("open");
        btn.classList.toggle("open");
      });
    });

    els.grid.querySelectorAll("[data-interest]").forEach((btn) => {
      btn.addEventListener("click", () => onInterestClick(btn.dataset.interest));
    });
  }

  function renderMeta() {
    els.resultsMeta.innerHTML = `พบ <strong>${state.plans.length}</strong> แผนที่ตรงกับคุณ`;
  }

  /* ---------------- Modal / interest flow ---------------- */
  async function onInterestClick(planId) {
    const plan = state.plans.find((p) => p.id === planId);
    if (!plan) return;
    pendingPlan = plan;

    els.modalPlanName.textContent = `${plan.plan_name} · ${plan.insurer.name_th}`;
    els.modalBrokerName.textContent = state.broker ? state.broker.name : "กำลังโหลด...";
    els.modalAvatar.textContent = state.broker ? state.broker.avatar_initials : "…";
    openModal();
  }

  function openModal() {
    els.modalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    els.modalOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  els.modalClose.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  els.modalLineBtn.addEventListener("click", async () => {
    if (!pendingPlan || !state.broker) return;
    els.modalLineBtn.disabled = true;
    els.modalLineBtn.textContent = "กำลังเปิดแชท...";
    try {
      const res = await window.PrakanApi.postInterest({
        plan_id: pendingPlan.id,
        broker_id: state.broker.id,
      });
      window.open(res.line_url, "_blank", "noopener");
    } catch (err) {
      console.error("postInterest failed", err);
      window.open(state.broker.line_url, "_blank", "noopener");
    } finally {
      els.modalLineBtn.disabled = false;
      els.modalLineBtn.textContent = "💬 เปิดแชท LINE";
      closeModal();
    }
  });

  /* ---------------- Data flow ---------------- */
  let searchDebounce;
  els.searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.query = els.searchInput.value;
      refresh();
    }, 150);
  });

  async function refresh() {
    renderChips();
    const plans = await window.PrakanApi.getPlans({ category: state.category, q: state.query });
    state.plans = plans;
    renderMeta();
    renderGrid();
  }

  async function init() {
    initTheme();
    const [categories, broker] = await Promise.all([
      window.PrakanApi.getCategories(),
      window.PrakanApi.getBroker(),
    ]);
    state.categories = categories;
    state.broker = broker;
    await refresh();
  }

  init();
})();

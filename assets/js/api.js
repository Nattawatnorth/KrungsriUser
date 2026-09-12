/**
 * Data layer for Super Broker's customer-facing catalog.
 * Flip USE_MOCK_DATA to false once the FastAPI backend is deployed —
 * every function below already talks the same shape either way, so the
 * UI code in app.js never needs to change.
 */
window.PrakanApi = (function () {
  const USE_MOCK_DATA = true;
  const API_BASE = ""; // e.g. "https://api.prakanchill.dev" when backend is live

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getSessionId() {
    const key = "prakan_session_id";
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : "sid-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem(key, sid);
    }
    return sid;
  }

  /**
   * GET /api/plans?category=<key>&q=<search>
   * Mirrors the mock filtering so swapping the flag is a no-op for the UI.
   */
  async function getPlans({ category, q } = {}) {
    if (!USE_MOCK_DATA) {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (q) params.set("q", q);
      const res = await fetch(`${API_BASE}/api/plans?${params.toString()}`);
      if (!res.ok) throw new Error(`GET /api/plans failed: ${res.status}`);
      return res.json();
    }

    await delay(120); // simulate network so loading/empty states are honest
    const { categories, insurers, plans } = window.MOCK_DATA;
    const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));
    const insurerMap = Object.fromEntries(insurers.map((i) => [i.id, i]));

    const needle = (q || "").trim().toLowerCase();
    return plans
      .filter((p) => {
        const matchesCategory =
          !category || category === "all" || categoryMap[p.category_id]?.key === category;
        if (!matchesCategory) return false;
        if (!needle) return true;
        const insurerName = insurerMap[p.insurer_id]?.name_th || "";
        return (
          p.plan_name.toLowerCase().includes(needle) ||
          insurerName.toLowerCase().includes(needle)
        );
      })
      .map((p) => ({
        ...p,
        category: categoryMap[p.category_id],
        insurer: insurerMap[p.insurer_id],
      }));
  }

  function getCategories() {
    return Promise.resolve(window.MOCK_DATA.categories);
  }

  function getBroker() {
    // Single demo broker for the hackathon; a real backend would resolve
    // this per-plan or per-region.
    return Promise.resolve(window.MOCK_DATA.brokers[0]);
  }

  /**
   * POST /api/interest — logs the click as a lead signal for the broker
   * dashboard, then returns the LINE URL to redirect to.
   */
  async function postInterest({ plan_id, broker_id }) {
    const payload = {
      plan_id,
      broker_id,
      session_id: getSessionId(),
      referrer: document.referrer || "direct",
    };

    if (!USE_MOCK_DATA) {
      const res = await fetch(`${API_BASE}/api/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`POST /api/interest failed: ${res.status}`);
      return res.json(); // expected: { line_url }
    }

    // TODO(backend): replace with real POST /api/interest once FastAPI is ready.
    await delay(150);
    const clicks = JSON.parse(localStorage.getItem("prakan_interest_clicks") || "[]");
    clicks.push({ ...payload, clicked_at: new Date().toISOString() });
    localStorage.setItem("prakan_interest_clicks", JSON.stringify(clicks));

    const broker = window.MOCK_DATA.brokers.find((b) => b.id === broker_id);
    return { line_url: broker ? broker.line_url : window.MOCK_DATA.brokers[0].line_url };
  }

  return { getPlans, getCategories, getBroker, postInterest };
})();

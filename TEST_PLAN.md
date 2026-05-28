# ElioTax – QA Test Plan
**Sprint 1 | Author: Heba | Status: Draft**

---

## 1. What Is This App?

ElioTax is an e-commerce analytics dashboard for a **shoe and apparel store** (Canadian market).

Users ask plain-English questions like *"show me revenue by province"*, and the AI generates a chart automatically — no SQL needed. The backend handles data from these real database tables:

| Table | What it holds |
|-------|---------------|
| `Orders` | Each order: status, subtotal, tax, date |
| `OrderItems` | Each item in an order: product, price, quantity |
| `Products` | Each product: name, color, which group it belongs to |
| `ProductGroups` | Product families (e.g. TrailBlazer, Eclipse, Pulse) |
| `ProductVariants` | Sizes per product (US 7 – US 13, S/M/L/XL) |
| `Inventories` | Stock count per variant |
| `Addresses` | Customer address + Canadian province |
| `ProductCategories` | Category tags (shoes, trail, road, gym, apparel…) |
| `ProductGroupCategories` | Links groups to categories |

---

## 2. Scope — What We Test

| # | Feature | Priority |
|---|---------|----------|
| 1 | Login / JWT authentication | 🔴 High |
| 2 | AI query → chart JSON spec | 🔴 High |
| 3 | Chart rendering (bar, line, pie) | 🟡 Medium |
| 4 | Role-based access (admin / analyst / viewer) | 🟡 Medium |
| 5 | Share link | 🟢 Lower |

---

## 3. Testing Order

```
1. Auth       → every other feature needs a logged-in user
2. AI query   → core feature; chart rendering depends on it
3. Charts     → depends on AI JSON being correct
4. RBAC       → depends on auth + charts working
5. Share link → depends on everything else
```

---

## 4. Tools

| Tool | What It Tests | When |
|------|--------------|------|
| Jest | Unit functions | Sprint 2+ |
| Postman | API endpoints (`/auth/login`, `/ai/query`) | Sprint 2 |
| Playwright | Full browser flows (login → ask → see chart) | Sprint 3 |

---

## 5. Test Cases

### 5.1 Authentication
- [ ] `POST /auth/login` valid credentials → JWT token returned
- [ ] `POST /auth/login` wrong password → 401
- [ ] Request without JWT → 403
- [ ] Expired JWT → 401

### 5.2 AI Query (real questions against the real database)

**Bar chart questions:**
- [ ] "Show me revenue by province" → `{ chartType: "bar", xAxis: "province", yAxis: "SUM(subtotal)" }`
- [ ] "Top product groups by revenue" → `{ chartType: "bar", xAxis: "ProductGroups.name", ... }`

**Line chart questions:**
- [ ] "How have orders changed over the years?" → `{ chartType: "line", xAxis: "year(createdAt)", ... }`

**Pie chart questions:**
- [ ] "Revenue split by product category" → `{ chartType: "pie", xAxis: "ProductCategories.name", ... }`
- [ ] "Order status breakdown" → `{ chartType: "pie", xAxis: "Orders.status", ... }`

**Filter questions:**
- [ ] "Show only shipped orders by province" → filters include `{ field: "status", value: "shipped" }`

**Edge cases:**
- [ ] Empty question → 400 error, not a crash
- [ ] Nonsense question ("purple banana") → graceful error
- [ ] Viewer role calling `/ai/query` → 403

### 5.3 Chart Rendering
- [ ] Bar chart renders with correct X labels (province names / group names)
- [ ] Line chart renders with correct years on X axis
- [ ] Pie chart renders with correct slices and labels
- [ ] Chart updates when a new AI query is made

### 5.4 RBAC
- [ ] Admin sees all features + user management
- [ ] Analyst can query AI + save charts, cannot manage users
- [ ] Viewer sees charts only — no AI input, no edit controls
- [ ] Viewer gets 403 calling `/ai/query` directly

### 5.5 Share Link
- [ ] Saving a chart generates a UUID share link
- [ ] Opening the share link shows the correct chart
- [ ] Share link works without being logged in (if public)

---

## 6. Definition of Done

A feature is done when:
1. All test cases pass ✅
2. Edge cases covered (empty input, wrong role, expired token) ✅
3. No browser console errors during the flow ✅
4. Heba has signed off in the sprint review ✅

---

## 7. Real Data Facts (for AI accuracy testing)

These are real numbers from the database — use them to verify AI chart output makes sense:

| Query | Expected result |
|-------|----------------|
| Revenue by year | 2018: CA$122K · 2019: CA$107K · 2020: CA$118K · 2021: CA$115K · 2022: CA$101K · 2023: CA$124K |
| Top province by revenue | Manitoba (CA$26K) |
| Top product group | Eclipse (CA$27K) |
| Order statuses | shipped 43% · cart 26% · shipping 15% · paid 8% · payment 7% |
| Product count | 259 products across 48 groups |
| Price range | CA$50–CA$400 per item |

---

## 8. Risks

- AI accuracy needs a defined "acceptable" threshold — agree with Dev C (Aleksei) in Sprint 2
- RBAC depends on JWT being fully implemented by Dev B (Recep) — flag if delayed
- Playwright browser tests start Sprint 3 only (need working frontend from Dev A / Burcu)

# 📊 Intelligent Data Vitals & Visualization Hub

An AI-assisted analytics sandbox dashboard developed in partnership with **Elio Tax** for the **PowerCoders** program.

## 📝 Project Overview
This project is a Proof of Concept (PoC) designed to enable **natural-language data exploration**. Leadership lacks a single, flexible place to explore operational and commercial signals (such as transmission issues or revenue data). With this solution, a user can ask a question (e.g., *"revenue by category"* or *"orders stuck in transmission"*). An AI-infused layer then interprets the required filters, sorts, and aggregates on our GraphQL model, picks an appropriate visual representation, and renders the result.

---

## 🛠️ Tech Stack & Architecture
* **Language:** TypeScript (Company Standard).
* **Runtime:** Node.js syntax (compatible with Node, Deno, or Bun).
* **Backend API:** `graphql-gene` for automated schema and resolver generation.
* **Database:** Public SQLite e-commerce sandbox database.
* **Frontend UI:** React (Vite) + `Chart.js` for data visualization.

---

## 🔒 Core Architectural Guardrails
To ensure a successful delivery, the project relies on the following key technical checkpoints:
* **AI Engine Isolation:** The assistant/chat surface is decoupled from the GraphQL and visualization core, allowing tools or chat channels to be swapped later without a major refactor.
* **JSON Contract Alignment:** The backend adapter interface and the AI prompt output format are bound by a strict data contract to prevent integration friction.
* **Role-Based Access Control (RBAC):** Shareable URLs use secure identifiers whose views depend strictly on the user's authenticated role to prevent sensitive data leaks.

---
*Note: Local installation and setup instructions will be appended below as soon as the initial repository structure is pushed by the development team.*

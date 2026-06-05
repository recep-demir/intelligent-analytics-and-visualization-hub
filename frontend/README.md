# Frontend — Intelligent Analytics & Visualization Hub

React + TypeScript + Vite UI for the Intelligent Analytics & Visualization Hub project.

## How to Run

**1. Clone the repository:**

```bash
git clone https://github.com/Powercoders-Bootcamp/project-intelligent-analytics-and-visualization-hub.git
```

**2. Switch to the correct branch:**

```bash
git checkout development
```

**3. Navigate to the frontend directory:**

```bash
cd frontend
```

**4. Install dependencies:**

```bash
npm install
```

**5. Start the development server:**

```bash
npm run dev
```

**6. Open the project:**

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Tech Stack

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)

## ESLint Configuration

For production applications, enable type-aware lint rules by updating `eslint.config.js`:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      // or for stricter rules:
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

You can also add [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules.

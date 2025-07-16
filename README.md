### 1. Clone repository
```bash
git clone https://github.com/0xPolygonHermez/zisk-profiler.git
cd nuxt
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in development
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## 📁 Project Structure

```
nuxt/
├── components/          # Vue components
│   ├── Chart.vue       # Main chart component
│   ├── ChartConfig.vue # Chart configuration
│   ├── ChartLegend.vue # Chart legend
│   └── ChartStats.vue  # Statistics
├── pages/              # Application pages
└── public/data/        # JSON data
```

## 🎯 Available Commands

```bash
# Development
npm run dev

# Production
npm run build
npm run preview

# Generate static
npm run generate
```
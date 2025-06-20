module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue"
  ],
  theme: {
    extend: {
      colors: {
        'primary-dark': '#16302b',
        'accent-text': '#A3E635',
        'chart-grid': '#1E3D38'
      }
    }
  },
  plugins: []
}
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  
  css: ['~/assets/css/tailwind.css'],

  pages: true,
  router: {
    options: {
      strict: false
    }
  }
})
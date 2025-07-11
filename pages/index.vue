<script setup>
import Chart from '../components/Chart.vue';
</script>

<template>
  <div class="h-full relative">
    <div class="absolute top-6 left-6 z-20">
      <img src="/zisk.svg" alt="Zisk Logo"
        class="w-24 h-auto opacity-90 hover:opacity-100 transition-opacity drop-shadow-lg" />
    </div>

    <div class="pt-20">
      <Chart jsonPath="/data/stats.json" />
    </div>
  </div>
</template>
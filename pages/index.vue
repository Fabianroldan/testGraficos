<script setup>
const chartData = {
  labels: ['Enero', 'Febrero', 'Marzo'],
  datasets: [{
    label: 'Ventas 2023',
    backgroundColor: '#4ade80',
    data: [30, 40, 20]
  }]
}
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold mb-6">Gráfico con Chart.js</h1>
    <Chart :chart-data="chartData" class="max-w-2xl" />
  </div>
</template>
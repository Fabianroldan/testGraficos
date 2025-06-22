<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);
const isMounted = ref(false);

const props = defineProps({
  jsonPath: {
    type: String,
    required: true,
    validator: value => value.startsWith('/data/')
  }
});

onMounted(async () => {
  isMounted.value = true;
  
  if (process.client) {
    try {
      loading.value = true;
      
      const { 
        Chart, 
        BarController,
        BarElement,
        LinearScale,
        CategoryScale,
        Tooltip,
        Title
      } = await import('chart.js');
      const zoomPlugin = await import('chartjs-plugin-zoom');

      Chart.register(
        BarController,
        BarElement,
        LinearScale,
        CategoryScale,
        Tooltip,
        Title,
        zoomPlugin.default
      );

      const response = await fetch(props.jsonPath);
      if (!response.ok) throw new Error('Error al cargar archivo');
      
      const data = await response.json();
      const tasks = processData(data);

      if (Object.keys(tasks).length === 0) {
        throw new Error('No hay datos válidos en el JSON');
      }

      renderChart(Chart, tasks);
    } catch (err) {
      error.value = err.message;
      console.error('Error:', err);
    } finally {
      loading.value = false;
    }
  }
});

const toggleDataset = (index) => {
  if (!chartInstance.value) return;
  const meta = chartInstance.value.getDatasetMeta(index);
  meta.hidden = !meta.hidden;
  chartInstance.value.update();
};

const processData = ({ h, t, c, d }) => {
  const tasks = t.map((name, i) => ({
    name,
    color: c[i],
    segments: []
  }));

  d.forEach(([taskId, action, offset]) => {
    const time = h + offset;
    const task = tasks[taskId];

    if (action === 0) {
      task.segments.push({ start: time });
    } else {
      const last = task.segments.at(-1);
      if (last) last.end = time;
    }
  });

  return tasks;
};

const renderChart = (Chart, tasks) => {
  const datasets = tasks.map(task => ({
    label: task.name,
    data: task.segments.flatMap(seg => {
      const duration = seg.end ? seg.end - seg.start : null;
      return [
        {
          x: seg.start,
          y: task.name,
          custom: { duration, task: task.name.split('_')[0], core: task.name.split('_')[1] }
        },
        { 
          x: seg.end || seg.start + 100, 
          y: task.name,
          custom: { duration, task: task.name.split('_')[0], core: task.name.split('_')[1] }
        }
      ];
    }),
    backgroundColor: (ctx) => {
      const duration = ctx.raw?.custom?.duration;
      return duration !== undefined && duration !== null ? 
        `${task.color}CC` : '#FF000080';
    },
    borderColor: (ctx) => {
      const duration = ctx.raw?.custom?.duration;
      return duration !== undefined && duration !== null ? 
        task.color : '#FF0000';
    },
    borderWidth: 1,
    barThickness: 12,
    borderRadius: 4,
    borderSkipped: false
  }));

  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  chartInstance.value = new Chart(chartRef.value, {
    type: 'bar',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 12000,
          ticks: {
            stepSize: 500,
            color: '#A3E635',
            callback: v => `${(v / 1000).toFixed(1)}s`
          },
          grid: {
            color: '#1E3D38',
            drawBorder: false
          }
        },
        y: {
          type: 'category',
          grid: {
            color: '#1E3D38',
            drawBorder: false
          },
          ticks: {
            color: '#A3E635',
            font: {
              weight: 'bold',
              size: 10
            }
          }
        }
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy'
          },
          zoom: {
            wheel: {
              enabled: true
            },
            pinch: {
              enabled: true
            },
            mode: 'xy'
          }
        },
        tooltip: {
          backgroundColor: '#16302B',
          titleColor: '#A3E635',
          bodyColor: '#ECFDF5',
          borderColor: '#10B981',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Duración: ${custom.duration || 'N/A'}ms`,
                `Core: ${custom.core || 'N/A'}`,
                `Tipo: ${custom.task || 'N/A'}`
              ];
            }
          }
        }
      }
    }
  });
};

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }
});
</script>

<template>
  <div class="relative h-full w-full bg-primary-dark">
    <!-- Estado de carga -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-primary-dark/90 z-10">
      <div class="animate-pulse text-accent-text">Cargando datos...</div>
    </div>

    <!-- Mensaje de error -->
    <div 
      v-if="error"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-900/80 text-red-100 px-4 py-2 rounded-lg z-20"
    >
      {{ error }}
    </div>

    <!-- Contenedor del gráfico -->
    <div class="p-4 h-[70vh] min-h-[500px]">
      <ClientOnly>
        <canvas 
          v-if="isMounted" 
          ref="chartRef" 
          class="w-full h-full" 
          :class="{ 'opacity-50': loading }" 
        />
        <template #fallback>
          <div class="h-full flex items-center justify-center text-accent-text">
            <p>Cargando visualización...</p>
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Leyenda interactiva -->
    <div v-if="isMounted && chartInstance?.data?.datasets" class="absolute bottom-4 left-4 flex flex-wrap gap-2">
      <div 
        v-for="(task, i) in chartInstance.data.datasets" 
        :key="i"
        class="flex items-center text-xs cursor-pointer" 
        @click="toggleDataset(i)"
      >
        <div 
          class="w-3 h-3 mr-1 rounded-sm"
          :style="{ 
            backgroundColor: task.backgroundColor({ raw: { custom: { duration: 100 } } }) 
          }" 
        />
        {{ task.label }}
      </div>
    </div>
  </div>
</template>
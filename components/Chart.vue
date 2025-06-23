<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

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
  await loadData();
});

const loadData = async () => {
  if (process.client) {
    try {
      loading.value = true;
      error.value = null;
      
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
};

watch(() => props.jsonPath, async () => {
  if (isMounted.value) {
    await loadData();
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

  // Ordenar eventos por tiempo
  const sortedEvents = d.map(([taskId, action, offset]) => ({
    taskId,
    action,
    time: h + offset
  })).sort((a, b) => a.time - b.time);

  // Procesar eventos ordenados
  sortedEvents.forEach(({ taskId, action, time }) => {
    const task = tasks[taskId];
    if (!task) return;

    if (action === 0) { // begin
      // Cerrar cualquier segmento abierto previo
      const lastOpen = task.segments.find(s => !s.end);
      if (lastOpen) lastOpen.end = time;
      
      task.segments.push({ start: time });
    } else { // end
      const last = task.segments.at(-1);
      if (last && !last.end) last.end = time;
    }
  });

  return tasks;
};

const renderChart = (Chart, tasks) => {
  // Calcular mínimo y máximo para la escala
  const allTimes = tasks.flatMap(t => t.segments.flatMap(s => [s.start, s.end || s.start + 100]));
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);

  const datasets = tasks.map(task => ({
    label: task.name,
    data: task.segments.map(seg => ({
      // Punto de inicio de la barra (posición X)
      x: seg.start,
      y: task.name,
      // Ancho de la barra (duración)
      width: seg.end ? seg.end - seg.start : 100,
      custom: {
        duration: seg.end ? seg.end - seg.start : null,
        task: task.name.split('_')[0],
        core: task.name.split('_')[1],
        startTime: seg.start,
        endTime: seg.end || seg.start + 100
      }
    })),
    backgroundColor: (ctx) => {
      const custom = ctx.raw?.custom || {};
      if (!custom.duration) return '#FF000080';
      
      // Color por tipo de tarea
      const colorMap = {
        'Mem': '#A3E635',
        'Main': '#10B981',
        'Cache': '#34D399',
        'DB': '#3B82F6',
        'Net': '#8B5CF6'
      };
      return colorMap[custom.task] || '#6EE7B7';
    },
    borderColor: (ctx) => {
      const custom = ctx.raw?.custom || {};
      if (!custom.duration) return '#FF0000';
      return ctx.dataset.backgroundColor(ctx);
    },
    borderWidth: 1,
    // Configuración clave para mostrar solo la franja activa
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    barThickness: 'flex',
    minBarLength: 2,
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
          min: minTime,
          max: maxTime,
          ticks: {
            color: '#A3E635',
            callback: v => `${((v - minTime) / 1000).toFixed(2)}s`
          },
          grid: {
            color: '#1E3D38',
            drawBorder: false
          }
        },
        y: {
          type: 'category',
          offset: true,
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
            beforeLabel: (ctx) => {
              const custom = ctx.raw?.custom || {};
              const start = ((custom.startTime - minTime) / 1000).toFixed(3);
              const end = custom.endTime ? ((custom.endTime - minTime) / 1000).toFixed(3) : 'En curso';
              return [
                `Inicio: ${start}s`,
                `Fin: ${end}s`,
                `Duración: ${custom.duration ? (custom.duration / 1000).toFixed(3) + 's' : 'N/A'}`
              ];
            },
            label: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Tarea: ${custom.task || 'N/A'}`,
                `Core: ${custom.core || 'N/A'}`
              ];
            }
          }
        },
        legend: {
          display: false
        }
      },
      // Configuración clave para el posicionamiento de barras
      datasetOptions: {
        bar: {
          base: minTime // Establece el punto base para las barras
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
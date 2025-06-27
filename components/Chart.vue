<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);
const isMounted = ref(false);
const legendFilter = ref('');

const props = defineProps({
  jsonPath: {
    type: String,
    required: true,
    validator: value => value.startsWith('/data/')
  }
});

const filteredLegendItems = computed(() => {
  if (!chartInstance.value?.data?.datasets) return [];
  if (!legendFilter.value) return chartInstance.value.data.datasets;
  
  return chartInstance.value.data.datasets.filter(dataset => 
    dataset.label.toLowerCase().includes(legendFilter.value.toLowerCase()) ||
    dataset.originalName.toLowerCase().includes(legendFilter.value.toLowerCase())
  );
});

onMounted(async () => {
  isMounted.value = true;
  await loadData();
});

const loadData = async () => {
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

    Chart.register(
      BarController,
      BarElement,
      LinearScale,
      CategoryScale,
      Tooltip,
      Title
    );

    const response = await fetch(props.jsonPath);
    if (!response.ok) throw new Error('Error al cargar archivo');
    
    const data = await response.json();
    const tasks = processData(data);

    if (tasks.length === 0) {
      throw new Error('No hay datos válidos en el JSON');
    }

    renderChart(Chart, tasks);
  } catch (err) {
    error.value = err.message;
    console.error('Error:', err);
  } finally {
    loading.value = false;
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
  meta.hidden = meta.hidden === null ? !chartInstance.value.data.datasets[index].hidden : !meta.hidden;
  
  chartInstance.value.update();
};

const processData = (rawData) => {
  const tasks = [];
  
  rawData.forEach((item, index) => {
    const displayName = `${item.name.split('[')[0]}[${index}]`;
    
    tasks.push({
      name: displayName,
      originalName: item.name,
      originalData: item,
      color: getColorForTask(item.name),
      segments: [{
        start: item.start,
        end: item.start + item.duration,
        duration: item.duration
      }],
      originalIndex: index  // Guardamos el índice aquí
    });
  });

  return tasks;
};

const getColorForTask = (taskName) => {
  const type = taskName.split('_')[0];
  const colorMap = {
    'Main': '#10B981',
    'ROM': '#3B82F6',
    'INPUT': '#8B5CF6',
    'MEM': '#A3E635',
    'BINARY': '#EC4899',
    'ARITH': '#F59E0B',
    'KECCAKF': '#EF4444',
    'DEFAULT': '#6EE7B7'
  };
  return colorMap[type] || colorMap.DEFAULT;
};

const formatTime = (time) => {
  return new Intl.NumberFormat('en-US').format(time);
};

const renderChart = (Chart, tasks) => {
  const allTimes = tasks.flatMap(t => t.segments.flatMap(s => [s.start, s.end]));
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);

  const datasets = tasks.map(task => ({
    label: task.name,
    originalName: task.originalName,
    originalData: task.originalData,
    data: task.segments.map(seg => ({
      x: seg.start,
      y: task.name,
      width: seg.end - seg.start,
      custom: {
        ...task.originalData,
        duration: seg.end - seg.start,
        task: task.originalName.split('_')[0],
        subtask: task.originalName.split('_')[1] || '',
        startTime: seg.start,
        endTime: seg.end,
        formattedStart: formatTime(seg.start),
        formattedEnd: formatTime(seg.end),
        formattedDuration: formatTime(seg.end - seg.start),
        formattedRelativeStart: formatTime(seg.start - minTime),
        formattedRelativeEnd: formatTime(seg.end - minTime),
        originalIndex: task.originalIndex  // Usamos el índice guardado
      }
    })),
    backgroundColor: task.color + 'CC',
    borderColor: task.color,
    borderWidth: 1,
    barPercentage: 1.0,
    categoryPercentage: 1.0,
    barThickness: 12,
    borderRadius: 4,
    borderSkipped: false,
    hidden: false
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
            callback: v => `${((v - minTime) / 1000000).toFixed(2)}ms`
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
            },
            callback: function(value) {
              return value;
            }
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: '#16302B',
          titleColor: '#A3E635',
          bodyColor: '#ECFDF5',
          borderColor: '#10B981',
          borderWidth: 1,
          padding: 12,
          bodySpacing: 6,
          callbacks: {
            beforeLabel: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Nombre completo: ${ctx.dataset.label}`,
                `Tipo: ${custom.task}`,
                `Subtipo: ${custom.subtask || 'N/A'}`
              ];
            },
            label: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Inicio: ${custom.formattedStart}`,
                `Fin: ${custom.formattedEnd}`,
                `Duración: ${custom.formattedDuration} (${((custom.duration) / 1000000).toFixed(3)}ms)`
              ];
            }
          }
        },
        legend: {
          display: false
        }
      }
    }
  });

  const chartContainer = chartRef.value.parentElement;
  chartContainer.style.overflowY = 'auto';
  chartContainer.style.height = '70vh';
  chartRef.value.style.height = `${datasets.length * 20 + 100}px`;
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

    <!-- Contenedor del gráfico con scroll -->
    <div class="p-4 h-[70vh] min-h-[500px] overflow-y-auto">
      <ClientOnly>
        <div class="min-h-full">
          <canvas 
            v-if="isMounted" 
            ref="chartRef" 
            class="w-full"
            :class="{ 'opacity-50': loading }" 
          />
        </div>
        <template #fallback>
          <div class="h-full flex items-center justify-center text-accent-text">
            <p>Cargando visualización...</p>
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- Leyenda interactiva -->
    <div v-if="isMounted && chartInstance?.data?.datasets" class="absolute bottom-4 left-4 right-4 flex flex-col gap-1 max-h-[30vh] overflow-y-auto p-2 bg-primary-dark/90 rounded-lg border border-accent-border backdrop-blur-sm">
      <div class="sticky top-0 bg-primary-dark/90 py-1 z-10">
        <input 
          type="text" 
          v-model="legendFilter"
          placeholder="Filtrar tareas..."
          class="w-full px-2 py-1 bg-primary-darker text-accent-text rounded border border-accent-border focus:outline-none focus:ring-1 focus:ring-accent-border"
        />
      </div>
      <div 
        v-for="(task, i) in filteredLegendItems" 
        :key="i"
        class="flex items-center text-xs cursor-pointer hover:bg-primary-darker/50 px-2 py-1 rounded"
        @click="toggleDataset(i)"
      >
        <div 
          class="w-3 h-3 mr-2 rounded-sm flex-shrink-0"
          :style="{ backgroundColor: task.hidden ? '#6B7280' : task.backgroundColor }" 
        />
        <span class="truncate" :class="{ 'text-gray-400': task.hidden }">
          {{ task.label }}
        </span>
        <span class="ml-auto text-accent-text/70 text-xxs">
          {{ ((task.data[0].custom.duration) / 1000000).toFixed(2) }}ms
        </span>
      </div>
    </div>
  </div>
</template>
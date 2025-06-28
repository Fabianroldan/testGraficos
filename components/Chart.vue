<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import ChartLegend from './ChartLegend.vue';

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);
const isMounted = ref(false);

const chartData = computed(() => {
  return chartInstance.value?.data?.datasets?.[0]?.data || [];
});

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

const processData = (rawData) => {
  const nameCounts = {};
  return rawData.map((item) => {
    const count = nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
    const displayName = `${item.name}[${count}]`;
    return {
      name: displayName,
      originalName: item.name,
      originalData: item,
      color: getColorForTask(item.name),
      segments: [{
        start: item.start,
        end: item.start + item.duration,
        duration: item.duration
      }]
    };
  });
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

  const data = tasks.map(task => ({
    x: task.segments[0].start,
    y: task.name,
    backgroundColor: task.color + 'CC',
    borderColor: task.color,
    width: task.segments[0].duration,
    custom: {
      ...task.originalData,
      duration: task.segments[0].duration,
      task: task.originalName.split('_')[0],
      subtask: task.originalName.split('_')[1] || '',
      startTime: task.segments[0].start,
      endTime: task.segments[0].end,
      formattedStart: formatTime(task.segments[0].start),
      formattedEnd: formatTime(task.segments[0].end),
      formattedDuration: formatTime(task.segments[0].duration),
      formattedRelativeStart: formatTime(task.segments[0].start - minTime),
      formattedRelativeEnd: formatTime(task.segments[0].end - minTime)
    }
  }));

  const yLabels = tasks.map(task => task.name);

  if (chartInstance.value) {
    chartInstance.value.destroy();
  }

  chartInstance.value = new Chart(chartRef.value, {
    type: 'bar',
    data: {
      labels: yLabels,
      datasets: [{
        label: 'Tareas',
        data,
        backgroundColor: data.map(d => d.backgroundColor),
        borderColor: data.map(d => d.borderColor),
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        barThickness: 18,
        borderRadius: 4,
        borderSkipped: false,
        hidden: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      parsing: {
        xAxisKey: 'x',
        yAxisKey: 'y',
        widthKey: 'width'
      },
      scales: {
        x: {
          type: 'linear',
          min: minTime,
          max: maxTime,
          display: true,
          title: {
            display: true,
            text: 'Tiempo (Microsegundos)',
            color: '#A3E635',
            font: {
              size: 12,
              weight: 'bold'
            }
          },
          ticks: {
            display: true,
            color: '#A3E635',
            font: {
              size: 10,
              weight: 'normal'
            },
            maxTicksLimit: 10,
            callback: v => `${((v - minTime) / 1000000).toFixed(2)}ms`
          },
          grid: {
            display: true,
            color: '#1E3D38',
            drawBorder: true,
            borderColor: '#A3E635'
          }
        },
        y: {
          type: 'category',
          labels: yLabels,
          offset: true,
          display: true,
          title: {
            display: true,
            color: '#A3E635',
            font: {
              size: 12,
              weight: 'bold'
            }
          },
          grid: {
            display: true,
            color: '#1E3D38',
            drawBorder: true,
            borderColor: '#A3E635'
          },
          ticks: {
            display: true,
            color: '#A3E635',
            font: {
              weight: 'bold',
              size: 10
            },
            autoSkip: false,
            mirror: false,
            padding: 5
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
                `Nombre: ${ctx.raw.y}`,
                `Tipo: ${custom.task}`,
                `Subtipo: ${custom.subtask || 'N/A'}`
              ];
            },
            label: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Inicio: ${custom.formattedStart}`,
                `Fin: ${custom.formattedEnd}`,
                `Duración: ${((custom.duration) / 1000000).toFixed(3)}ms (${custom.duration.toLocaleString()}μs)`
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

  // Ajustar la altura del canvas para que quepa en pantalla
  const chartContainer = chartRef.value.parentElement;
  const availableHeight = window.innerHeight - 200; // Restamos espacio para la leyenda
  const barHeight = 18; // Altura de cada barra
  const totalHeight = Math.max(tasks.length * barHeight, 300);
  
  chartContainer.style.height = `${Math.min(availableHeight, totalHeight)}px`;
  chartRef.value.style.height = '100%';
  chartRef.value.style.width = '100%';
};

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }
});
</script>

<template>
  <div class="flex flex-col h-screen w-full bg-primary-dark">
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
    <div class="flex-1 p-4 overflow-hidden">
      <ClientOnly>
        <div class="h-full w-full">
          <canvas 
            v-if="isMounted" 
            ref="chartRef" 
            class="w-full h-full"
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

    <!-- Leyenda visual -->
    <ChartLegend 
      v-if="isMounted && chartData.length > 0"
      :chart-data="chartData"
    />
  </div>
</template>
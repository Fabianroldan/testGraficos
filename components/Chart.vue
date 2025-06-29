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
    const colorScheme = getColorForTask(item.name);
    return {
      name: displayName,
      originalName: item.name,
      originalData: item,
      colorScheme: colorScheme,
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
    'Main': {
      primary: '#475569',
      secondary: '#334155',
      border: '#64748B'
    },
    'ROM': {
      primary: '#1E40AF',
      secondary: '#1E3A8A',
      border: '#3B82F6'
    },
    'INPUT': {
      primary: '#6B21A8',
      secondary: '#581C87',
      border: '#8B5CF6'
    },
    'MEM': {
      primary: '#166534',
      secondary: '#14532D',
      border: '#22C55E'
    },
    'BINARY': {
      primary: '#BE185D',
      secondary: '#9D174D',
      border: '#EC4899'
    },
    'ARITH': {
      primary: '#C2410C',
      secondary: '#9A3412',
      border: '#F97316'
    },
    'KECCAKF': {
      primary: '#B91C1C',
      secondary: '#991B1B',
      border: '#EF4444'
    },
    'DEFAULT': {
      primary: '#374151',
      secondary: '#1F2937',
      border: '#6B7280'
    }
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

  const data = tasks.map(task => {
    const colorScheme = task.colorScheme;
    return {
      x: task.segments[0].start,
      y: task.name,
      backgroundColor: colorScheme.primary + 'E6',
      borderColor: colorScheme.border,
      hoverBackgroundColor: colorScheme.primary + 'F2',
      hoverBorderColor: colorScheme.secondary,
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
    };
  });

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
        barPercentage: 0.95, // Barras más grandes
        categoryPercentage: 0.95, // Más espacio para las barras
        borderRadius: 2, // Menos redondeado
        borderSkipped: false
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
      layout: {
        padding: {
          top: 20,
          bottom: 20
        }
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
            color: '#FFFFFF',
            font: {
              size: 15,
              weight: '600',
              family: 'Inter, system-ui, sans-serif'
            }
          },
          ticks: {
            display: true,
            color: '#FFFFFF',
            font: {
              size: 13,
              weight: '500',
              family: 'Inter, system-ui, sans-serif'
            },
            maxTicksLimit: 8,
            callback: v => `${((v - minTime) / 1000000).toFixed(2)}ms`
          },
          grid: {
            display: true,
            color: 'rgba(100, 116, 139, 0.15)', // Líneas de grid muy sutiles
            drawBorder: true,
            borderColor: '#475569',
            borderWidth: 1,
            lineWidth: 0.5
          }
        },
        y: {
          type: 'category',
          labels: yLabels,
          offset: true,
          display: true,
          title: {
            display: true,
            text: 'Tareas',
            color: '#FFFFFF',
            font: {
              size: 15,
              weight: '600',
              family: 'Inter, system-ui, sans-serif'
            }
          },
          grid: {
            display: true,
            color: 'rgba(100, 116, 139, 0.1)', // Líneas horizontales muy sutiles
            drawBorder: true,
            borderColor: '#475569',
            borderWidth: 1,
            lineWidth: 0.5
          },
          ticks: {
            display: true,
            color: '#FFFFFF',
            font: {
              weight: '500',
              size: 13,
              family: 'Inter, system-ui, sans-serif'
            },
            autoSkip: false,
            mirror: false,
            padding: 15
          },
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(51, 65, 85, 0.96)', // Slate 700 con alta opacidad
          titleColor: '#F8FAFC', // Slate 50
          bodyColor: '#E2E8F0', // Slate 200
          borderColor: '#64748B', // Slate 500
          borderWidth: 1,
          padding: 16,
          bodySpacing: 8,
          cornerRadius: 8,
          displayColors: true,
          usePointStyle: true,
          boxPadding: 6,
          titleFont: {
            size: 14,
            weight: '600',
            family: 'Inter, system-ui, sans-serif'
          },
          bodyFont: {
            size: 12,
            weight: '400',
            family: 'Inter, system-ui, sans-serif'
          },
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

  // Ajustar la altura del canvas para que sea mucho más grande
  const chartContainer = chartRef.value.parentElement;
  const availableHeight = window.innerHeight - 200; // Usar casi toda la altura disponible
  const barHeight = 40; // Barras más altas y prominentes
  const spacing = 6; // Menos espaciado para barras más grandes
  const totalHeight = Math.max(tasks.length * (barHeight + spacing), 600); // Altura mínima mucho mayor

  chartContainer.style.height = `${availableHeight + 150}px`; // Espacio extra para ejes
  chartRef.value.style.height = `${totalHeight}px`;
  chartRef.value.style.width = '50%';

  // Añadir sombra sutil y profesional
  chartContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)';
  chartContainer.style.borderRadius = '8px';
  chartContainer.style.overflow = 'hidden';
};

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy();
  }
});
</script>

<template>
  <div class="min-h-screen w-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
    <!-- Estado de carga -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-sm z-50">
      <div class="text-center">
        <div class="animate-spin w-10 h-10 border-3 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-4">
        </div>
        <div class="text-slate-700 text-lg font-medium">Cargando datos...</div>
      </div>
    </div>

    <!-- Mensaje de error -->
    <div v-if="error"
      class="absolute top-6 left-1/2 transform -translate-x-1/2 bg-red-50 text-red-800 px-6 py-3 rounded-lg border border-red-200 shadow-sm z-50">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd" />
        </svg>
        {{ error }}
      </div>
    </div>

    <!-- Contenedor principal -->
    <div class="flex flex-col min-h-screen">
      <!-- Gráfico con mucho más espacio -->
      <div class="flex-1 px-6 py-4 pb-8">
        <div class="max-w-7xl mx-auto">
          <ClientOnly>
            <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
              <canvas v-if="isMounted" ref="chartRef" class="w-full h-full transition-opacity duration-300"
                :class="{ 'opacity-50': loading }" />
            </div>
            <template #fallback>
              <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-12 flex items-center justify-center">
                <div class="text-center">
                  <div
                    class="animate-spin w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-4">
                  </div>
                  <p class="text-slate-600">Cargando visualización...</p>
                </div>
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <div class="w-full px-6 pt-20 pb-8">
        <ChartLegend v-if="isMounted && chartData.length > 0" :chart-data="chartData" />
      </div>
    </div>
  </div>
</template>
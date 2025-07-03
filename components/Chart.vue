<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import ChartLegend from './ChartLegend.vue';

const chartRef = ref(null);
const chartInstance = ref(null);
const loading = ref(true);
const error = ref(null);
const isMounted = ref(false);

const chartData = computed(() => chartInstance.value?.data?.datasets?.[0]?.data || []);

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
  loading.value = true;
  error.value = null;
  try {
    const ChartJS = await import('chart.js');
    const { Chart, BarController, BarElement, LinearScale, CategoryScale, Tooltip, Title } = ChartJS;
    const annotationPlugin = await import('chartjs-plugin-annotation');
    Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Title);
    Chart.register(annotationPlugin.default);
    const response = await fetch(props.jsonPath);
    if (!response.ok) throw new Error('Error al cargar archivo');
    const data = await response.json();
    const tasks = processData(data);
    if (!tasks.length) throw new Error('No hay datos válidos en el JSON');
    renderChart(Chart, tasks);
  } catch (err) {
    error.value = err.message;
    console.error('Error:', err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.jsonPath, async () => {
  if (isMounted.value) await loadData();
});

const processData = (rawData) => {
  const nameCounts = {};
  return rawData.map((item) => {
    const count = nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
    const displayName = `${item.name}[${count}] - ${formatTime(item.duration)} microsegundos`;
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
      primary: '#C2410C',
      secondary: '#9A3412',
      border: '#F97316'
    },
    'ARITH': {
      primary: '#0EA5E9',
      secondary: '#0369A1',
      border: '#38BDF8'
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

  const minTimeMin = minTime / 60_000_000;
  const maxTimeMin = maxTime / 60_000_000;
  const timeRange = maxTimeMin - minTimeMin;

  const adjustedMaxTime = timeRange < 0.000001 ? minTimeMin + 0.000001 : maxTimeMin;

  const data = tasks.map(task => {
    const colorScheme = task.colorScheme;
    const startMin = task.segments[0].start / 60_000_000;
    const endMin = task.segments[0].end / 60_000_000;
    const durationMin = task.segments[0].duration / 60_000_000;
    return {
      x: [startMin, endMin],
      y: task.name,
      backgroundColor: colorScheme.primary + 'E6',
      borderColor: colorScheme.border,
      hoverBackgroundColor: colorScheme.primary + 'F2',
      hoverBorderColor: colorScheme.secondary,
      custom: {
        ...task.originalData,
        duration: durationMin,
        task: task.originalName.split('_')[0],
        subtask: task.originalName.split('_')[1] || '',
        absoluteStartTime: startMin,
        absoluteEndTime: endMin,
        formattedDuration: durationMin.toFixed(8) + ' min',
        formattedAbsoluteStart: startMin.toFixed(8) + ' min',
        formattedAbsoluteEnd: endMin.toFixed(8) + ' min'
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
        barPercentage: 0.95,
        categoryPercentage: 0.95,
        borderRadius: 2,
        borderSkipped: false,
        minBarLength: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      parsing: {
        xAxisKey: 'x',
        yAxisKey: 'y'
      },
      layout: {
        padding: {
          top: 20,
          bottom: 20,
          right: 30
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: adjustedMaxTime + 0.5,
          display: true,
          title: {
            display: true,
            text: 'Tiempo absoluto (minutos)',
            color: '#A3E635',
            font: {
              size: 13,
              weight: '600',
              family: 'Inter, system-ui, sans-serif'
            }
          },
          ticks: {
            display: true,
            color: '#A3E635',
            font: {
              size: 11,
              weight: '500',
              family: 'Inter, system-ui, sans-serif'
            },
            maxTicksLimit: 10,
            callback: v => {
              if (timeRange < 0.000001) return `${v.toFixed(8)} min`;
              if (timeRange < 0.00001) return `${v.toFixed(7)} min`;
              if (timeRange < 0.0001) return `${v.toFixed(6)} min`;
              if (timeRange < 0.001) return `${v.toFixed(5)} min`;
              if (timeRange < 0.01) return `${v.toFixed(4)} min`;
              if (timeRange < 0.1) return `${v.toFixed(3)} min`;
              return `${v.toFixed(2)} min`;
            }
          },
          grid: {
            display: true,
            color: 'var(--color-chart-grid)',
            drawBorder: true,
            borderColor: 'var(--color-primary-dark)',
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
            color: '#A3E635',
            font: {
              size: 13,
              weight: '600',
              family: 'Inter, system-ui, sans-serif'
            }
          },
          grid: {
            display: true,
            color: 'var(--color-chart-grid)',
            drawBorder: true,
            borderColor: 'var(--color-primary-dark)',
            borderWidth: 1,
            lineWidth: 0.5
          },
          ticks: {
            display: true,
            color: '#A3E635',
            font: {
              weight: '500',
              size: 11,
              family: 'Inter, system-ui, sans-serif'
            },
            autoSkip: false,
            mirror: false,
            padding: 12
          },
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'var(--color-primary-dark)',
          titleColor: '#A3E635',
          bodyColor: '#E2E8F0',
          borderColor: 'var(--color-chart-grid)',
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
            label: (ctx) => {
              const custom = ctx.raw?.custom || {};
              return [
                `Inicio: ${custom.formattedAbsoluteStart}`,
                `Final: ${custom.formattedAbsoluteEnd}`,
                `Duración: ${custom.formattedDuration}`,
              ];
            }
          }
        },
        legend: {
          display: false
        },
        annotation: {
          annotations: {
            maxTimeLine: {
              type: 'line',
              xMin: adjustedMaxTime,
              xMax: adjustedMaxTime,
              borderColor: '#EF4444',
              borderWidth: 2,
              borderDash: [5, 5],
              label: {
                display: true,
                content: `Tiempo total: ${adjustedMaxTime.toFixed(2)} min`,
                position: 'end',
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                color: '#FFFFFF',
                font: {
                  size: 11,
                  weight: '600'
                },
                padding: 4,
                cornerRadius: 4
              }
            }
          }
        }
      }
    }
  });

  const chartContainer = chartRef.value.parentElement;
  const availableHeight = window.innerHeight - 200;
  const barHeight = 40;
  const spacing = 6;
  const totalHeight = Math.max(tasks.length * (barHeight + spacing), 600);

  chartContainer.style.height = `${availableHeight + 150}px`;
  chartRef.value.style.height = `${totalHeight}px`;
  chartRef.value.style.width = '80%';
};

onUnmounted(() => {
  if (chartInstance.value) chartInstance.value.destroy();
});
</script>

<template>
  <div class="min-h-screen w-full bg-primary-dark flex flex-col">
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

    <div class="flex-1 w-full px-4 py-8">
      <div class="max-w-[95vw] mx-auto">
        <ClientOnly>
          <div class="rounded-lg border border-slate-200 shadow-sm p-4 w-full h-[80vh] min-h-[600px] mx-auto flex items-center justify-center bg-[#1E3D38]">
            <canvas 
              v-if="isMounted" 
              ref="chartRef" 
              class="w-full h-full transition-opacity duration-300 text-accent-text"
              :class="{ 'opacity-50': loading }" 
            />
          </div>
          <template #fallback>
            <div class="rounded-lg border border-slate-200 shadow-sm h-[80vh] min-h-[600px] flex items-center justify-center bg-[#1E3D38]">
              <div class="text-center">
                <div class="animate-spin w-8 h-8 border-2 border-[#A3E635] border-t-[#1E3D38] rounded-full mx-auto mb-4"></div>
                <p class="text-[#A3E635]">Cargando visualización...</p>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <div class="w-full px-6 pt-8 pb-8">
      <ChartLegend v-if="isMounted && chartData.length > 0" :chart-data="chartData" />
    </div>
  </div>
</template>
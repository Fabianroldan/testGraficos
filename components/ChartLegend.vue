<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  chartData: {
    type: Array,
    default: () => []
  }
});

const legendFilter = ref('');
const selectedCategory = ref('');

const filteredLegendItems = computed(() => {
  if (!props.chartData || props.chartData.length === 0) return [];

  let filtered = props.chartData;

  if (legendFilter.value) {
    filtered = filtered.filter(item =>
      item.y.toLowerCase().includes(legendFilter.value.toLowerCase()) ||
      (item.custom?.task?.toLowerCase().includes(legendFilter.value.toLowerCase())) ||
      (item.custom?.subtask?.toLowerCase().includes(legendFilter.value.toLowerCase()))
    );
  }

  if (selectedCategory.value) {
    filtered = filtered.filter(item => item.custom?.task === selectedCategory.value);
  }

  return filtered;
});

const uniqueCategories = computed(() => {
  const categories = props.chartData.map(item => item.custom?.task).filter(Boolean);
  return [...new Set(categories)].sort();
});

const taskTypeStats = computed(() => {
  if (!filteredLegendItems.value.length) return {};
  
  const stats = {};
  
  filteredLegendItems.value.forEach(item => {
    const taskType = item.custom?.task;
    const duration = item.custom?.duration ?? 0;
    
    if (!stats[taskType]) {
      stats[taskType] = {
        totalDuration: 0,
        count: 0
      };
    }
    
    stats[taskType].totalDuration += duration;
    stats[taskType].count++;
  });
  
  // Debug: Log the data for verification
  if (process.dev) {
    console.log('Task type stats:', stats);
  }
  
  return stats;
});

const formatDuration = (microseconds) => {
  if (microseconds >= 60_000_000) {
    // >= 60 seconds -> show in minutes
    const minutes = microseconds / 60_000_000;
    return `${minutes.toFixed(3)} min`;
  } else if (microseconds >= 1_000_000) {
    // >= 1 second -> show in seconds
    const seconds = microseconds / 1_000_000;
    return `${seconds.toFixed(3)} s`;
  } else if (microseconds >= 1_000) {
    // >= 1 millisecond -> show in milliseconds
    const milliseconds = microseconds / 1_000;
    return `${milliseconds.toFixed(3)} ms`;
  } else {
    // < 1 millisecond -> show in microseconds
    return `${microseconds.toFixed(0)} μs`;
  }
};

const totalDuration = computed(() => {
  if (!filteredLegendItems.value.length) return '0.00';
  
  // Sum all individual task durations
  const totalMicroseconds = filteredLegendItems.value.reduce((sum, item) => {
    return sum + (item.custom?.duration ?? 0);
  }, 0);
  
  return formatDuration(totalMicroseconds);
});

const clearAllFilters = () => {
  legendFilter.value = '';
  selectedCategory.value = '';
};
</script>

<template>
  <div class="w-full max-w-[1800px] mx-auto">
    <div class="rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-[#1E3D38]">
      <div class="px-4 py-3 border-b border-slate-200 bg-[#1E3D38]">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h3 class="text-base font-semibold text-[#A3E635]">
            Filtered Tasks ({{ filteredLegendItems.length }})
          </h3>
          <select 
            v-model="selectedCategory"
            class="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#A3E635] bg-[#1E3D38] text-[#A3E635]"
          >
            <option value="">All</option>
            <option 
              v-for="category in uniqueCategories" 
              :key="category" 
              :value="category"
              class="bg-[#1E3D38]"
            >
              {{ category }}
            </option>
          </select>
        </div>

        <input 
          type="text" 
          v-model="legendFilter" 
          placeholder="Search tasks..."
          class="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#A3E635] placeholder-[#A3E635] bg-[#1E3D38] text-[#A3E635]"
        />
      </div>

      <div class="p-4">
        <div 
          v-if="filteredLegendItems.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar"
        >
          <div 
            v-for="(task, i) in filteredLegendItems" 
            :key="i" 
            class="hover:bg-[#223c4a] rounded-xl transition-colors p-3 border border-slate-200"
            :class="{
              'border-t': i === 0,
              'border-b': i === filteredLegendItems.length - 1
            }"
            style="background-color: #1E3D38;"
          >
            <div class="flex items-center gap-2 mb-2">
              <div 
                class="w-3 h-3 rounded flex-shrink-0"
                :style="{ backgroundColor: task.backgroundColor }" 
              />
              <h4 class="text-sm font-medium truncate text-[#A3E635]">
                {{ task.y }}
              </h4>
            </div>
            <div class="text-xs text-[#A3E635] opacity-80">
              <p>Start: {{ task.custom?.formattedAbsoluteStart }}</p>
              <p>Duration: {{ task.custom?.formattedDuration }}</p>
            </div>
          </div>
        </div>

        <div 
          v-if="filteredLegendItems.length > 0" 
          class="mt-4 pt-3 border-t border-slate-200"
        >
          <!-- Task Type Statistics -->
          <div class="mb-4">
            <h4 class="text-sm font-semibold text-[#A3E635] mb-2">Duration by Task Type:</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <div 
                v-for="(stats, taskType) in taskTypeStats" 
                :key="taskType"
                class="bg-[#223c4a] rounded-lg p-2"
              >
                <div class="flex justify-between items-center">
                  <span class="text-xs font-medium text-[#A3E635]">{{ taskType }}</span>
                  <span class="text-xs text-[#A3E635] opacity-80">({{ stats.count }})</span>
                </div>
                <div class="text-sm text-[#A3E635] font-semibold">
                  {{ formatDuration(stats.totalDuration) }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Total Summary -->
          <div class="flex justify-between text-sm text-[#A3E635] pt-2 border-t border-slate-200">
            <span>{{ filteredLegendItems.length }} tasks total</span>
            <span>Total Duration: {{ totalDuration }}</span>
          </div>
        </div>

        <div 
          v-else 
          class="text-center py-8 text-[#A3E635]"
        >
          <p class="mb-3">No tasks found</p>
          <button 
            @click="clearAllFilters"
            class="px-3 py-1.5 bg-[#A3E635] text-[#1E3D38] rounded text-sm hover:bg-[#b6f35a] transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #1E3D38;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #A3E635;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #b6f35a;
}
</style>
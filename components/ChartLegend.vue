<template>
    <div class="flex-shrink-0 p-4 border-t border-accent-border bg-primary-dark">
        <div class="max-w-full">
            <input type="text" v-model="legendFilter" placeholder="Filtrar tareas..."
                class="w-full px-2 py-1 bg-primary-darker text-accent-text rounded border border-accent-border focus:outline-none focus:ring-1 focus:ring-accent-border" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-[200px] overflow-y-auto">
            <div v-for="(task, i) in filteredLegendItems" :key="i" class="flex items-center text-xs px-2 py-1 rounded">
                <div class="w-3 h-3 mr-2 rounded-sm flex-shrink-0" :style="{ backgroundColor: task.backgroundColor }" />
                <span class="truncate">
                    {{ task.y }}
                </span>
                <span class="ml-auto text-accent-text/70 text-xxs">
                    {{ ((task.custom.duration) / 1000000).toFixed(2) }}ms ({{ task.custom.duration.toLocaleString()
                    }}μs)
                </span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    chartData: {
        type: Array,
        default: () => []
    }
});

const legendFilter = ref('');

const filteredLegendItems = computed(() => {
    if (!props.chartData || props.chartData.length === 0) return [];
    if (!legendFilter.value) return props.chartData;

    return props.chartData.filter(item =>
        item.y.toLowerCase().includes(legendFilter.value.toLowerCase()) ||
        (item.custom?.task?.toLowerCase().includes(legendFilter.value.toLowerCase()))
    );
});
</script>

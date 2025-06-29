<template>
    <div class="w-full max-w-none">
        <!-- Container principal simplificado -->
        <div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            
            <!-- Header simplificado -->
            <div class="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <div class="flex items-center justify-between gap-3 mb-3">
                    <h3 class="text-base font-semibold text-slate-900">
                        Tareas ({{ chartData.length }})
                    </h3>
                    <select 
                        v-model="selectedCategory" 
                        class="px-2 py-1 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                        <option value="">Todas</option>
                        <option v-for="category in uniqueCategories" :key="category" :value="category">
                            {{ category }}
                        </option>
                    </select>
                </div>
                
                <!-- Barra de búsqueda simplificada -->
                <input 
                    type="text" 
                    v-model="legendFilter" 
                    placeholder="Buscar tareas..." 
                    class="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-500 placeholder-slate-500"
                />
            </div>

            <!-- Contenido principal simplificado -->
            <div class="p-4">
                <!-- Grid de tareas simplificado -->
                <div v-if="filteredLegendItems.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar">
                    <div 
                        v-for="(task, i) in filteredLegendItems" 
                        :key="i" 
                        class="bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 hover:border-slate-300 transition-colors p-3"
                    >
                        <!-- Header de la tarjeta -->
                        <div class="flex items-center gap-2 mb-2">
                            <div 
                                class="w-3 h-3 rounded flex-shrink-0" 
                                :style="{ backgroundColor: task.backgroundColor }"
                            />
                            <h4 class="text-sm font-medium text-slate-900 truncate">
                                {{ task.y }}
                            </h4>
                        </div>
                        
                        <!-- Duración -->
                        <div class="text-sm font-semibold text-slate-900">
                            {{ ((task.custom.duration) / 1000000).toFixed(2) }}ms
                        </div>
                    </div>
                </div>
                
                <!-- Panel de estadísticas simplificado -->
                <div v-if="filteredLegendItems.length > 0" class="mt-4 pt-3 border-t border-slate-200">
                    <div class="flex justify-between text-sm text-slate-600">
                        <span>{{ filteredLegendItems.length }} tareas</span>
                        <span>Total: {{ totalDuration }}ms</span>
                    </div>
                </div>

                <!-- Estado vacío simplificado -->
                <div v-else class="text-center py-8 text-slate-500">
                    <p class="mb-3">No se encontraron tareas</p>
                    <button 
                        @click="clearAllFilters" 
                        class="px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700 transition-colors"
                    >
                        Limpiar filtros
                    </button>
                </div>
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
const selectedCategory = ref('');

// Filtros combinados
const filteredLegendItems = computed(() => {
    if (!props.chartData || props.chartData.length === 0) return [];
    
    let filtered = props.chartData;
    
    // Filtro por texto
    if (legendFilter.value) {
        filtered = filtered.filter(item =>
            item.y.toLowerCase().includes(legendFilter.value.toLowerCase()) ||
            (item.custom?.task?.toLowerCase().includes(legendFilter.value.toLowerCase())) ||
            (item.custom?.subtask?.toLowerCase().includes(legendFilter.value.toLowerCase()))
        );
    }
    
    // Filtro por categoría
    if (selectedCategory.value) {
        filtered = filtered.filter(item => item.custom?.task === selectedCategory.value);
    }
    
    return filtered;
});

// Categorías únicas
const uniqueCategories = computed(() => {
    const categories = props.chartData.map(item => item.custom?.task).filter(Boolean);
    return [...new Set(categories)];
});

// Estadísticas computadas
const totalDuration = computed(() => {
    const total = filteredLegendItems.value.reduce((sum, item) => {
        return sum + (item.custom?.duration || 0);
    }, 0);
    return (total / 1000000).toFixed(2);
});

const averageDuration = computed(() => {
    if (filteredLegendItems.value.length === 0) return '0.00';
    const avg = filteredLegendItems.value.reduce((sum, item) => {
        return sum + (item.custom?.duration || 0);
    }, 0) / filteredLegendItems.value.length;
    return (avg / 1000000).toFixed(2);
});

const maxDuration = computed(() => {
    if (filteredLegendItems.value.length === 0) return '0.00';
    const max = Math.max(...filteredLegendItems.value.map(item => item.custom?.duration || 0));
    return (max / 1000000).toFixed(2);
});

const maxDurationValue = computed(() => {
    if (props.chartData.length === 0) return 1;
    return Math.max(...props.chartData.map(item => item.custom?.duration || 0));
});

// Métodos utilitarios
const getCategoryCount = (category) => {
    return props.chartData.filter(item => item.custom?.task === category).length;
};

const getRelativePercentage = (duration) => {
    return ((duration / maxDurationValue.value) * 100).toFixed(1);
};

const clearAllFilters = () => {
    legendFilter.value = '';
    selectedCategory.value = '';
};
</script>

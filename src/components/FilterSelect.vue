<script setup>
/** Dropdown filter berbentuk pil; menjadi hitam saat terisi. `options`: [{ value, label }]. */
const model = defineModel({ type: [String, Number], default: '' })

defineProps({
  options: { type: Array, required: true },
  placeholder: { type: String, required: true },
})
const emit = defineEmits(['change'])
</script>

<template>
  <select v-model="model" :aria-label="placeholder" :class="{ 'filter-active': model !== '' && model !== null }" class="filter" @change="emit('change')">
    <option value="">{{ placeholder }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>

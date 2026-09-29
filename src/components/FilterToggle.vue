<script setup>
/** Filter on/off berbentuk pil. Aktif = model bernilai `value`, nonaktif = ''. */
const model = defineModel({ type: [String, Number], default: '' })

const props = defineProps({
  value: { type: [String, Number], default: '1' },
})
const emit = defineEmits(['change'])

function toggle() {
  model.value = model.value ? '' : props.value
  emit('change')
}
</script>

<template>
  <button type="button" :aria-pressed="!!model" :class="{ 'filter-toggle-active': !!model }" class="filter-toggle" @click="toggle">
    <slot />
  </button>
</template>

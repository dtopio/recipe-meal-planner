<script setup>
defineOptions({ inheritAttrs: false });

import { Primitive } from "reka-ui";
import { computed, useAttrs } from "vue";
import { cn } from "@/lib/utils";
import { buttonVariants } from ".";

const props = defineProps({
  variant: { type: null, required: false },
  size: { type: null, required: false },
  class: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "button" },
});

const attrs = useAttrs();
const buttonType = computed(() => {
  if (props.asChild || props.as !== "button") return undefined;
  return attrs.type ?? "button";
});
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    v-bind="attrs"
    :type="buttonType"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>

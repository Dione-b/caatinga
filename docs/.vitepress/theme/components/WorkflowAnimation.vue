<script setup lang="ts">
import { createTimeline, stagger } from "animejs";
import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref<HTMLElement | null>(null);

const steps = [
  { id: "init", label: "init", detail: "Scaffold project" },
  { id: "build", label: "build", detail: "Compile WASM" },
  { id: "deploy", label: "deploy", detail: "Record contractId" },
  { id: "generate", label: "generate", detail: "TypeScript bindings" },
  { id: "invoke", label: "invoke / read", detail: "CLI or browser" },
];

let timeline: ReturnType<typeof createTimeline> | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stopAnimation() {
  if (timeline) {
    timeline.pause();
    timeline.revert();
    timeline = null;
  }
}

function playAnimation() {
  if (!containerRef.value) return;

  stopAnimation();

  const nodes = containerRef.value.querySelectorAll<HTMLElement>(".workshop-step");
  const arrows = containerRef.value.querySelectorAll<HTMLElement>(".workshop-arrow");
  const progress = containerRef.value.querySelector<HTMLElement>(".workshop-progress-bar");

  if (prefersReducedMotion()) {
    nodes.forEach((node) => {
      node.style.opacity = "1";
      node.style.transform = "none";
      node.classList.add("is-active");
    });
    arrows.forEach((arrow) => {
      arrow.style.opacity = "1";
    });
    if (progress) progress.style.width = "100%";
    return;
  }

  nodes.forEach((node) => {
    node.classList.remove("is-active");
    node.style.opacity = "0.35";
    node.style.transform = "translateY(8px)";
  });
  arrows.forEach((arrow) => {
    arrow.style.opacity = "0.2";
  });
  if (progress) progress.style.width = "0%";

  timeline = createTimeline({ autoplay: true });

  timeline.add(
    nodes,
    {
      opacity: [0.35, 1],
      translateY: [8, 0],
      duration: 450,
      ease: "out(3)",
      delay: stagger(180),
      onBegin: ({ targets }) => {
        (targets as HTMLElement[]).forEach((target) => target.classList.add("is-active"));
      },
    },
    0
  );

  timeline.add(
    arrows,
    {
      opacity: [0.2, 1],
      duration: 300,
      ease: "out(2)",
      delay: stagger(180, { start: 120 }),
    },
    0
  );

  if (progress) {
    timeline.add(
      progress,
      {
        width: ["0%", "100%"],
        duration: steps.length * 180 + 300,
        ease: "out(2)",
      },
      0
    );
  }
}

function replay() {
  playAnimation();
}

onMounted(() => {
  playAnimation();
});

onUnmounted(() => {
  stopAnimation();
});
</script>

<template>
  <div ref="containerRef" class="workshop-animation workshop-workflow">
    <div class="workshop-animation-header">
      <span class="workshop-animation-label">Core workflow</span>
      <button type="button" class="workshop-replay-btn" @click="replay">Replay</button>
    </div>

    <div class="workshop-progress">
      <div class="workshop-progress-bar" />
    </div>

    <div class="workshop-steps">
      <template v-for="(step, index) in steps" :key="step.id">
        <div class="workshop-step" :data-step="step.id">
          <span class="workshop-step-index">{{ String(index + 1).padStart(2, "0") }}</span>
          <span class="workshop-step-label">{{ step.label }}</span>
          <span class="workshop-step-detail">{{ step.detail }}</span>
        </div>
        <span v-if="index < steps.length - 1" class="workshop-arrow" aria-hidden="true">→</span>
      </template>
    </div>
  </div>
</template>


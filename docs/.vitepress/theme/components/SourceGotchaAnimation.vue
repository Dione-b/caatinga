<script setup lang="ts">
import { animate, createTimeline, stagger } from "animejs";
import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref<HTMLElement | null>(null);
const replayKey = ref(0);

const validSource = { label: "alice", detail: "Stellar CLI identity alias" };
const invalidSources = [
  { label: "GABC…", detail: "Public address — rejected", code: "CAATINGA_SOURCE_IS_PUBLIC_KEY" },
  { label: "SABC…", detail: "Secret key — rejected", code: "CAATINGA_SOURCE_IS_SECRET_KEY" },
  { label: "seed phrase…", detail: "Mnemonic — rejected", code: "CAATINGA_SOURCE_IS_SEED_PHRASE" },
];

let timeline: ReturnType<typeof createTimeline> | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playAnimation() {
  if (!containerRef.value) return;

  timeline?.pause();

  const validCard = containerRef.value.querySelector<HTMLElement>(".workshop-source-valid");
  const invalidCards = containerRef.value.querySelectorAll<HTMLElement>(".workshop-source-invalid");

  if (prefersReducedMotion()) {
    if (validCard) {
      validCard.style.opacity = "1";
      validCard.style.transform = "none";
    }
    invalidCards.forEach((card) => {
      card.style.opacity = "1";
      card.style.transform = "none";
    });
    return;
  }

  if (validCard) {
    validCard.style.opacity = "0";
    validCard.style.transform = "translateX(-8px)";
  }
  invalidCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateX(8px)";
  });

  timeline = createTimeline({ autoplay: true });

  timeline
    .add(validCard, {
      opacity: [0, 1],
      translateX: [-8, 0],
      duration: 450,
      ease: "out(3)",
    })
    .add(
      invalidCards,
      {
        opacity: [0, 1],
        translateX: [8, 0],
        duration: 400,
        ease: "out(3)",
        delay: stagger(120),
      },
      "-=150"
    )
    .add(
      invalidCards,
      {
        translateX: [0, -3, 3, -2, 2, 0],
        duration: 500,
        ease: "out(2)",
        delay: stagger(80, { start: 200 }),
      },
      "-=100"
    );
}

function replay() {
  replayKey.value += 1;
  requestAnimationFrame(() => playAnimation());
}

onMounted(() => {
  playAnimation();
});

onUnmounted(() => {
  timeline?.pause();
});
</script>

<template>
  <div ref="containerRef" :key="replayKey" class="workshop-animation workshop-source">
    <div class="workshop-animation-header">
      <span class="workshop-animation-label">--source must be a CLI alias</span>
      <button type="button" class="workshop-replay-btn" @click="replay">Replay</button>
    </div>

    <div class="workshop-source-grid">
      <div class="workshop-source-card workshop-source-valid">
        <span class="workshop-source-badge workshop-source-badge-ok">OK</span>
        <span class="workshop-source-value workshop-mono">{{ validSource.label }}</span>
        <span class="workshop-source-detail">{{ validSource.detail }}</span>
      </div>

      <div
        v-for="item in invalidSources"
        :key="item.label"
        class="workshop-source-card workshop-source-invalid"
      >
        <span class="workshop-source-badge workshop-source-badge-bad">NO</span>
        <span class="workshop-source-value workshop-mono">{{ item.label }}</span>
        <span class="workshop-source-detail">{{ item.detail }}</span>
        <span class="workshop-source-code workshop-mono">{{ item.code }}</span>
      </div>
    </div>
  </div>
</template>

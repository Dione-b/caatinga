<script setup lang="ts">
import { animate, createTimeline } from "animejs";
import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref<HTMLElement | null>(null);
const replayKey = ref(0);

let timeline: ReturnType<typeof createTimeline> | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playAnimation() {
  if (!containerRef.value) return;

  timeline?.pause();

  const inPlacePanel = containerRef.value.querySelector<HTMLElement>(".workshop-panel-inplace");
  const redeployPanel = containerRef.value.querySelector<HTMLElement>(".workshop-panel-redeploy");
  const inPlaceId = containerRef.value.querySelector<HTMLElement>(".workshop-id-inplace");
  const redeployOld = containerRef.value.querySelector<HTMLElement>(".workshop-id-old");
  const redeployNew = containerRef.value.querySelector<HTMLElement>(".workshop-id-new");
  const wasmInPlace = containerRef.value.querySelector<HTMLElement>(".workshop-wasm-inplace");
  const wasmRedeploy = containerRef.value.querySelector<HTMLElement>(".workshop-wasm-redeploy");

  if (prefersReducedMotion()) {
    [inPlacePanel, redeployPanel].forEach((el) => {
      if (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      }
    });
    return;
  }

  [inPlacePanel, redeployPanel].forEach((el) => {
    if (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(12px)";
    }
  });

  timeline = createTimeline({ autoplay: true });

  timeline
    .add(inPlacePanel, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 500,
      ease: "out(3)",
    })
    .add(
      wasmInPlace,
      {
        backgroundColor: ["#1a1a1a", "#ffde00"],
        color: ["#ffde00", "#000000"],
        duration: 400,
        ease: "out(2)",
      },
      "-=200"
    )
    .add(
      inPlaceId,
      {
        scale: [1, 1.04, 1],
        duration: 350,
        ease: "out(2)",
      },
      "-=150"
    )
    .add(
      redeployPanel,
      {
        opacity: [0, 1],
        translateY: [12, 0],
        duration: 500,
        ease: "out(3)",
      },
      "+=200"
    )
    .add(
      redeployOld,
      {
        opacity: [1, 0.35],
        translateX: [0, -6],
        duration: 350,
        ease: "out(2)",
      },
      "-=250"
    )
    .add(
      redeployNew,
      {
        opacity: [0, 1],
        translateX: [6, 0],
        scale: [0.95, 1],
        duration: 400,
        ease: "out(3)",
      },
      "-=200"
    )
    .add(
      wasmRedeploy,
      {
        backgroundColor: ["#1a1a1a", "#ffde00"],
        color: ["#ffde00", "#000000"],
        duration: 400,
        ease: "out(2)",
      },
      "-=150"
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
  <div ref="containerRef" :key="replayKey" class="workshop-animation workshop-upgrade">
    <div class="workshop-animation-header">
      <span class="workshop-animation-label">Upgrade strategies</span>
      <button type="button" class="workshop-replay-btn" @click="replay">Replay</button>
    </div>

    <div class="workshop-panels">
      <div class="workshop-panel workshop-panel-inplace">
        <h4 class="workshop-panel-title">In-place — <code>caatinga upgrade</code></h4>
        <p class="workshop-panel-desc">Same contract instance; WASM hash changes.</p>
        <div class="workshop-panel-row">
          <span class="workshop-field-label">contractId</span>
          <span class="workshop-id-inplace workshop-mono">CABC…same</span>
        </div>
        <div class="workshop-panel-row">
          <span class="workshop-field-label">wasmHash</span>
          <span class="workshop-wasm-inplace workshop-mono">hash_v2</span>
        </div>
      </div>

      <div class="workshop-panel workshop-panel-redeploy">
        <h4 class="workshop-panel-title">Redeploy — <code>deploy --upgrade</code></h4>
        <p class="workshop-panel-desc">New instance; prior ID moves to history.</p>
        <div class="workshop-panel-row">
          <span class="workshop-field-label">contractId</span>
          <span class="workshop-id-stack">
            <span class="workshop-id-old workshop-mono">COLD…</span>
            <span class="workshop-id-new workshop-mono">CNEW…</span>
          </span>
        </div>
        <div class="workshop-panel-row">
          <span class="workshop-field-label">wasmHash</span>
          <span class="workshop-wasm-redeploy workshop-mono">hash_v2</span>
        </div>
      </div>
    </div>
  </div>
</template>

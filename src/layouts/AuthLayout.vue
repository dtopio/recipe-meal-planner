<template>
  <div class="min-h-screen flex flex-col lg:flex-row bg-background">
    <!-- Left decorative panel — desktop only -->
    <div class="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 text-white p-12">
      <!-- Animated blobs -->
      <div class="absolute inset-0 opacity-[0.08]">
        <div class="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/30 blur-3xl animate-float" />
        <div class="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl animate-float-delayed" />
        <div class="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-teal-300/15 blur-2xl animate-float-slow" />
      </div>

      <!-- Content -->
      <div class="relative z-10 text-center space-y-6 max-w-sm">
        <div class="flex items-center justify-center gap-3 mb-4">
          <div class="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8 text-emerald-100">
              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" x2="18" y1="17" y2="17" />
            </svg>
          </div>
        </div>
        <h1 class="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
          Plan together,<br />eat better.
        </h1>
        <p class="text-base xl:text-lg text-emerald-100/80 leading-relaxed">
          Collaborative meal planning and grocery shopping for your whole household.
        </p>
      </div>
    </div>

    <!-- Right panel — form area -->
    <div class="flex-1 flex flex-col">
      <!-- Mobile header -->
      <div class="flex items-center gap-3 p-6 lg:hidden">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-primary">
            <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" x2="18" y1="17" y2="17" />
          </svg>
        </div>
        <span class="text-lg font-bold text-foreground tracking-tight">MealSync</span>
      </div>

      <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div class="w-full max-w-[400px]">
          <slot />
        </div>
      </div>

      <!-- Footer -->
      <p class="text-center text-xs text-muted-foreground/60 pb-6">
        &copy; {{ new Date().getFullYear() }} MealSync. All rights reserved.
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}
@keyframes float-delayed {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(15px) scale(0.95); }
}
@keyframes float-slow {
  0%, 100% { transform: translateY(0) translateX(0); }
  33% { transform: translateY(-10px) translateX(10px); }
  66% { transform: translateY(10px) translateX(-5px); }
}
.animate-float { animation: float 8s ease-in-out infinite; }
.animate-float-delayed { animation: float-delayed 10s ease-in-out infinite; }
.animate-float-slow { animation: float-slow 14s ease-in-out infinite; }
</style>

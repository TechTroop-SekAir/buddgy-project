@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@300;400;500&display=swap');
@import 'tailwindcss';

@theme {
  --font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'DM Mono', ui-monospace, monospace;
}

:root {
  color-scheme: light dark;
}

* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
*:hover {
  scrollbar-color: oklch(0.7 0 0 / 0.3) transparent;
}

@keyframes progress-fill {
  from { width: 0%; }
  to { width: var(--target-width); }
}

.progress-bar {
  animation: progress-fill 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fade-up {
  animation: fade-up 0.4s ease both;
}

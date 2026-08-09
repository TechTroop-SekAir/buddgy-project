/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Reads client/src/styles/tokens.css — never restate hex here.
        'bg-page': 'var(--bg-page)',
        'bg-surface': 'var(--bg-surface)',
        'bg-input': 'var(--bg-input)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-subtle': 'var(--accent-subtle)',
        'border-card': 'var(--border-card)',
        'border-nav': 'var(--border-nav)',
        'status-ok': 'var(--status-ok)',
        'status-warning': 'var(--status-warning)',
        'status-danger': 'var(--status-danger)',
        'status-forecast-alert': 'var(--status-forecast-alert)',
        'form-success': 'var(--form-success)',
        'form-error': 'var(--form-error)',
      },
    },
  },
  plugins: [],
};

// No Mantine equivalent fits the design system's inline-text error convention
// (see DateInput.jsx for precedent) — this centralizes the
// `role="alert"` + `text-form-error` markup every page/modal used to
// hand-roll independently. `size` covers the two text sizes that markup used
// (text-sm in most places, text-xs in a couple of tight row contexts).
const SIZE_CLASSES = { xs: 'text-xs', sm: 'text-sm' };

export function Alert({ children, size = 'sm', className = '', ...props }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  return (
    <p role="alert" className={`${sizeClass} text-form-error ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

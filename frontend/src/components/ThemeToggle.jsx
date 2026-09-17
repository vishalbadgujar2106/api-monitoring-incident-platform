const OPTIONS = [
  { key: 'light', label: 'Light', icon: '☀' },
  { key: 'dark', label: 'Dark', icon: '☾' },
  { key: 'system', label: 'System', icon: '◐' },
];

export function ThemeToggle({ theme, onChange }) {
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`theme-toggle__btn ${theme === option.key ? 'theme-toggle__btn--active' : ''}`}
          onClick={() => onChange(option.key)}
          aria-pressed={theme === option.key}
          title={`${option.label} theme`}
        >
          <span aria-hidden="true">{option.icon}</span>
          <span className="sr-only">{option.label} theme</span>
        </button>
      ))}
    </div>
  );
}

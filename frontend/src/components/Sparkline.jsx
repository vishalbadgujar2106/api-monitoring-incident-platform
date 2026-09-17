const WIDTH = 100;
const HEIGHT = 28;
const PAD = 3;

export function Sparkline({ values, labels, color = 'var(--accent)', strokeWidth = 1.6 }) {
  const entries = (values ?? [])
    .map((value, index) => ({ value, label: labels?.[index] }))
    .filter((entry) => typeof entry.value === 'number' && !Number.isNaN(entry.value));

  if (entries.length < 2) {
    return (
      <svg
        className="sparkline sparkline--empty"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} />
      </svg>
    );
  }

  const points = entries.map((entry) => entry.value);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = (WIDTH - PAD * 2) / (points.length - 1);
  const hitWidth = Math.max(step * 0.9, 2);

  const coords = points.map((value, index) => {
    const x = PAD + index * step;
    const y = HEIGHT - PAD - ((value - min) / range) * (HEIGHT - PAD * 2);
    return [x, y];
  });

  const linePath = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = `M${PAD},${HEIGHT - PAD} L${linePath.split(' ').join(' L')} L${WIDTH - PAD},${HEIGHT - PAD} Z`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" preserveAspectRatio="none">
      <path d={areaPath} className="sparkline__area" style={{ fill: color }} />
      <polyline
        points={linePath}
        className="sparkline__line"
        style={{ stroke: color, strokeWidth }}
      />
      {/* Invisible full-height hit strips carrying native tooltips — a rect
          (unlike a circle) stays a clean hit target even under the
          non-uniform scaling preserveAspectRatio="none" allows. */}
      {entries.some((entry) => entry.label) &&
        coords.map(([x], index) => (
          <rect
            key={index}
            x={x - hitWidth / 2}
            y={0}
            width={hitWidth}
            height={HEIGHT}
            fill="transparent"
          >
            {entries[index].label && <title>{entries[index].label}</title>}
          </rect>
        ))}
    </svg>
  );
}

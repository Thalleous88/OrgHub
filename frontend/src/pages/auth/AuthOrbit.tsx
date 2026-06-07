interface MatrixDot {
  cx: number;
  cy: number;
  radius: number;
  opacity: number;
}

function createSphereDots(
  latitudeSteps: number,
  longitudeSteps: number,
  minimumRadius = 0.45,
  radiusRange = 0.9,
): MatrixDot[] {
  const dots: MatrixDot[] = [];

  for (let latitudeIndex = 1; latitudeIndex < latitudeSteps; latitudeIndex += 1) {
    const latitude = -Math.PI / 2 + (latitudeIndex / latitudeSteps) * Math.PI;
    const latitudeRadius = Math.cos(latitude);

    for (
      let longitudeIndex = 0;
      longitudeIndex <= longitudeSteps;
      longitudeIndex += 1
    ) {
      const longitude =
        -Math.PI / 2 + (longitudeIndex / longitudeSteps) * Math.PI;
      const depth = latitudeRadius * Math.cos(longitude);

      dots.push({
        cx: 50 + latitudeRadius * Math.sin(longitude) * 47,
        cy: 50 - Math.sin(latitude) * 47,
        radius: minimumRadius + depth * radiusRange,
        opacity: 0.18 + depth * 0.78,
      });
    }
  }

  return dots;
}

const planetDots = createSphereDots(52, 72, 0.1, 0.27);
const satelliteDots = createSphereDots(7, 9);

function DotMatrixSphere({ compact = false }: { compact?: boolean }) {
  const dots = compact ? satelliteDots : planetDots;

  return (
    <svg
      className="auth-orbit__matrix"
      viewBox="0 0 100 100"
      focusable="false"
    >
      {dots.map((dot, index) => (
        <circle
          key={index}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.radius}
          opacity={dot.opacity}
        />
      ))}
    </svg>
  );
}

export default function AuthOrbit() {
  return (
    <div className="auth-orbit" aria-hidden="true">
      <div className="auth-orbit__ring auth-orbit__ring--outer">
        <span className="auth-orbit__sphere">
          <DotMatrixSphere compact />
        </span>
      </div>
      <div className="auth-orbit__ring auth-orbit__ring--middle">
        <span className="auth-orbit__sphere">
          <DotMatrixSphere compact />
        </span>
      </div>
      <div className="auth-orbit__ring auth-orbit__ring--inner">
        <span className="auth-orbit__sphere">
          <DotMatrixSphere compact />
        </span>
      </div>
      <div className="auth-orbit__planet">
        <DotMatrixSphere />
      </div>
    </div>
  );
}

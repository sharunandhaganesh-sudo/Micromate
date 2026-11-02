import React from 'react';

// ==========================================
// 1. Realistic 3D Digital Thermometer
// ==========================================
export const Sensor3DThermometer: React.FC<{
  value: number | null;
  className?: string;
}> = ({ value, className = 'w-24 h-24' }) => {
  // Normalize value for column fill: -10°C to 50°C
  const temp = value !== null ? value : 25;
  const clamped = Math.min(Math.max(temp, -10), 50);
  const fillPct = ((clamped - -10) / 60) * 100; // 0 to 100%
  const fillHeight = 48 * (fillPct / 100); // max 48px
  const fillY = 66 - fillHeight;

  // Warm vs Cool gradient
  const isHot = temp >= 32;
  const isCold = temp <= 18;
  const fluidColor1 = isHot ? '#F97316' : isCold ? '#38BDF8' : '#0EA5E9';
  const fluidColor2 = isHot ? '#EF4444' : isCold ? '#0284C7' : '#0284C7';

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Glass Outer Cylinder Gradient */}
          <linearGradient id="thermoGlass" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.8" />
            <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.9" />
          </linearGradient>

          {/* Chrome Metal Cap Gradients */}
          <linearGradient id="chromeCap" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#94A3B8" />
            <stop offset="70%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* Liquid Mercury/Alcohol 3D Gradient */}
          <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={fluidColor1} />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="70%" stopColor={fluidColor1} />
            <stop offset="100%" stopColor={fluidColor2} />
          </linearGradient>

          {/* Bulb Radial 3D Sphere */}
          <radialGradient id="bulbGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="20%" stopColor={fluidColor1} />
            <stop offset="80%" stopColor={fluidColor2} />
            <stop offset="100%" stopColor="#0B132B" stopOpacity="0.6" />
          </radialGradient>

          {/* Glass Specular Reflection Highlight */}
          <linearGradient id="specular" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Shadow under base */}
        <ellipse cx="50" cy="94" rx="22" ry="5" fill="#0F172A" fillOpacity="0.08" />

        {/* Stem Backing / Bore Wall */}
        <rect x="42" y="16" width="16" height="54" rx="8" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />

        {/* Calibration Ticks on Backing */}
        <line x1="37" y1="22" x2="41" y2="22" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="38" y1="30" x2="41" y2="30" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
        <line x1="37" y1="38" x2="41" y2="38" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="38" y1="46" x2="41" y2="46" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />
        <line x1="37" y1="54" x2="41" y2="54" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="38" y1="62" x2="41" y2="62" stroke="#CBD5E1" strokeWidth="1" strokeLinecap="round" />

        {/* Metal Mounting Plate Top */}
        <rect x="40" y="8" width="20" height="9" rx="3" fill="url(#chromeCap)" stroke="#94A3B8" strokeWidth="0.8" />
        <circle cx="50" cy="12.5" r="2" fill="#334155" />

        {/* Active Liquid Column */}
        <rect
          x="46"
          y={fillY}
          width="8"
          height={fillHeight}
          rx="4"
          fill="url(#liquidGrad)"
          className="transition-all duration-700 ease-out"
        />

        {/* Bulb Liquid 3D Sphere */}
        <circle cx="50" cy="76" r="14" fill="url(#bulbGrad)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />

        {/* Glass Outer Tube with 3D reflections */}
        <rect x="42" y="16" width="16" height="54" rx="8" fill="url(#thermoGlass)" stroke="#CBD5E1" strokeWidth="1.2" />

        {/* Specular Highlight Streak */}
        <path d="M44 20 L44 65" stroke="url(#specular)" strokeWidth="2.5" strokeLinecap="round" />
        <ellipse cx="46" cy="72" rx="4" ry="2" fill="#FFFFFF" fillOpacity="0.6" transform="rotate(-30 46 72)" />
      </svg>
    </div>
  );
};

// ==========================================
// 2. Realistic 3D Humidity Water Droplet Sensor
// ==========================================
export const Sensor3DHumidity: React.FC<{
  value: number | null;
  className?: string;
}> = ({ value, className = 'w-24 h-24' }) => {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md animate-float-droplet transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* 3D Glass Droplet Body Gradient */}
          <radialGradient id="dropBody" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#BAE6FD" />
            <stop offset="25%" stopColor="#38BDF8" />
            <stop offset="70%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </radialGradient>

          {/* Internal Water Level Waves */}
          <linearGradient id="dropWave" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.8" />
          </linearGradient>

          {/* Glossy Specular Glow */}
          <linearGradient id="specularGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#E0F2FE" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>

          {/* Sensor Ring Base */}
          <linearGradient id="metalRing" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
        </defs>

        {/* Soft Ground Shadow */}
        <ellipse cx="50" cy="92" rx="20" ry="5" fill="#0284C7" fillOpacity="0.12" />

        {/* Metallic Base Mount Plinth */}
        <ellipse cx="50" cy="85" rx="24" ry="7" fill="url(#metalRing)" stroke="#94A3B8" strokeWidth="0.8" />
        <ellipse cx="50" cy="83" rx="21" ry="5.5" fill="#F1F5F9" />

        {/* Main 3D Droplet Shape */}
        <path
          d="M50 14 C50 14 24 50 24 67 C24 81 35.6 88 50 88 C64.4 88 76 81 76 67 C76 50 50 14 50 14 Z"
          fill="url(#dropBody)"
          stroke="#38BDF8"
          strokeWidth="1.2"
        />

        {/* Moisture Level Fill Curve */}
        <path
          d="M27 68 C35 65 42 71 50 67 C58 63 65 67 73 68 C74.8 73 72 82 50 86 C28 82 25.2 73 27 68 Z"
          fill="url(#dropWave)"
        />

        {/* 3D Primary Highlight Reflection Curve */}
        <path
          d="M49 22 C49 22 32 48 32 63 C32 69 34 72 38 72 C35 66 36 49 49 25 Z"
          fill="url(#specularGlow)"
        />

        {/* Micro Specular Pearl Highlight */}
        <circle cx="43" cy="38" r="3" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="47" cy="32" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />

        {/* Moisture Mist Particles (subtle) */}
        <circle cx="62" cy="55" r="2" fill="#E0F2FE" fillOpacity="0.6" />
        <circle cx="58" cy="72" r="2.5" fill="#E0F2FE" fillOpacity="0.5" />
      </svg>
    </div>
  );
};

// ==========================================
// 3. Realistic 3D Barometer / Atmospheric Pressure Gauge
// ==========================================
export const Sensor3DBarometer: React.FC<{
  value: number | null;
  className?: string;
}> = ({ value, className = 'w-24 h-24' }) => {
  // Pressure typical scale: 950 to 1050 hPa -> -120deg to +120deg
  const pres = value !== null ? value : 1013.25;
  const clamped = Math.min(Math.max(pres, 950), 1050);
  const rotationDeg = -120 + ((clamped - 950) / 100) * 240;

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Chrome Bezel Rim Outer */}
          <radialGradient id="chromeBezel" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#E2E8F0" />
            <stop offset="65%" stopColor="#94A3B8" />
            <stop offset="90%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>

          {/* Dial Face Inner Sunburst */}
          <radialGradient id="dialFace" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </radialGradient>

          {/* Needle 3D Gradient */}
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="50%" stopColor="#F87171" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>

          {/* Center Cap Pin */}
          <radialGradient id="centerPin" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#1E293B" />
          </radialGradient>

          {/* Glass Lens Reflection */}
          <linearGradient id="lensReflect" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer Shadow */}
        <circle cx="50" cy="52" r="44" fill="#0F172A" fillOpacity="0.08" />

        {/* Metallic Bezel Rim */}
        <circle cx="50" cy="50" r="44" fill="url(#chromeBezel)" stroke="#CBD5E1" strokeWidth="1" />

        {/* Step Ring */}
        <circle cx="50" cy="50" r="39" fill="#334155" stroke="#64748B" strokeWidth="0.8" />

        {/* Watch Dial Face */}
        <circle cx="50" cy="50" r="37" fill="url(#dialFace)" />

        {/* Radial Calibration Arc (Normal / Storm / Fair) */}
        <circle
          cx="50"
          cy="50"
          r="30"
          stroke="#E2E8F0"
          strokeWidth="3"
          strokeDasharray="125 200"
          strokeDashoffset="30"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          stroke="#38BDF8"
          strokeWidth="3"
          strokeDasharray="40 200"
          strokeDashoffset="10"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          stroke="#10B981"
          strokeWidth="3"
          strokeDasharray="45 200"
          strokeDashoffset="170"
          fill="none"
        />

        {/* Major Tick Marks */}
        <g stroke="#334155" strokeWidth="1.5" strokeLinecap="round">
          <line x1="50" y1="16" x2="50" y2="21" /> {/* 1013 */}
          <line x1="26" y1="26" x2="30" y2="30" /> {/* 980 */}
          <line x1="74" y1="26" x2="70" y2="30" /> {/* 1040 */}
          <line x1="16" y1="50" x2="21" y2="50" /> {/* 950 */}
          <line x1="84" y1="50" x2="79" y2="50" /> {/* 1050 */}
        </g>

        {/* Minor Dial Hash Marks */}
        <g stroke="#94A3B8" strokeWidth="0.8">
          <line x1="37" y1="20" x2="39" y2="23" />
          <line x1="63" y1="20" x2="61" y2="23" />
          <line x1="20" y1="37" x2="23" y2="39" />
          <line x1="80" y1="37" x2="77" y2="39" />
        </g>

        {/* Dial Text Label */}
        <text x="50" y="38" textAnchor="middle" fill="#64748B" fontSize="5" fontWeight="bold" letterSpacing="0.5">
          BAROMETER
        </text>
        <text x="50" y="67" textAnchor="middle" fill="#94A3B8" fontSize="4.5" fontFamily="monospace">
          hPa
        </text>

        {/* Needle with dynamic rotation */}
        <g
          transform={`rotate(${rotationDeg} 50 50)`}
          className="transition-transform duration-700 ease-out"
        >
          {/* Needle Drop Shadow */}
          <polygon points="49,52 50,19 51,52" fill="#0F172A" fillOpacity="0.2" transform="translate(1, 1)" />
          {/* Main Needle Blade */}
          <polygon points="48.5,50 50,18 51.5,50 50,56" fill="url(#needleGrad)" />
          {/* Counterbalance Tail */}
          <circle cx="50" cy="56" r="2.5" fill="#DC2626" />
        </g>

        {/* Center Metal Pin Cap */}
        <circle cx="50" cy="50" r="4.5" fill="url(#centerPin)" stroke="#CBD5E1" strokeWidth="0.8" />
        <circle cx="49" cy="49" r="1.5" fill="#FFFFFF" fillOpacity="0.7" />

        {/* Convex Glass Lens Arc Highlight */}
        <path d="M20 30 A37 37 0 0 1 80 30 A37 20 0 0 0 20 30 Z" fill="url(#lensReflect)" />
      </svg>
    </div>
  );
};

// ==========================================
// 4. Realistic 3D Wind Anemometer (Rotating Cups)
// ==========================================
export const Sensor3DAnemometer: React.FC<{
  value: number | null;
  className?: string;
}> = ({ value, className = 'w-24 h-24' }) => {
  const wind = value !== null ? value : 0;
  // Dynamic rotation speed based on wind velocity
  const isMoving = wind > 0.5;
  const animStyle = isMoving
    ? {
        animationDuration: `${Math.max(0.6, 4 - Math.min(wind, 30) * 0.1)}s`,
      }
    : undefined;

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Chrome Mast Shaft Gradient */}
          <linearGradient id="mastGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="35%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* Rotor Hub Rotor Dome */}
          <radialGradient id="hubDome" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#38BDF8" />
            <stop offset="85%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0C4A6E" />
          </radialGradient>

          {/* 3D Hemispherical Cups Gradients */}
          <radialGradient id="cupGrad1" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#38BDF8" />
            <stop offset="80%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#075985" />
          </radialGradient>

          <radialGradient id="cupGrad2" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#60A5FA" />
            <stop offset="80%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E40AF" />
          </radialGradient>

          <radialGradient id="cupGrad3" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#0284C7" />
            <stop offset="80%" stopColor="#0369A1" />
            <stop offset="100%" stopColor="#082F49" />
          </radialGradient>

          {/* Mounting Base Flange */}
          <linearGradient id="baseFlange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="50%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
        </defs>

        {/* Base Shadow */}
        <ellipse cx="50" cy="94" rx="22" ry="5" fill="#0F172A" fillOpacity="0.08" />

        {/* Mounting Mast Stand */}
        <rect x="47" y="44" width="6" height="46" rx="3" fill="url(#mastGrad)" stroke="#94A3B8" strokeWidth="0.8" />
        <ellipse cx="50" cy="90" rx="18" ry="5" fill="url(#baseFlange)" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="50" cy="88" rx="14" ry="3.5" fill="#F1F5F9" />

        {/* Rotating 3-Cup Rotor Assembly */}
        <g
          className={isMoving ? 'animate-spin-wind origin-center' : ''}
          style={{ transformOrigin: '50px 38px', ...animStyle }}
        >
          {/* Arm 1 (Top / 0 deg) */}
          <line x1="50" y1="38" x2="50" y2="15" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cup 1 */}
          <path
            d="M50 15 C50 8 40 8 40 15 C40 22 50 22 50 15 Z"
            fill="url(#cupGrad1)"
            stroke="#0284C7"
            strokeWidth="0.8"
            transform="rotate(0 50 15)"
          />

          {/* Arm 2 (Bottom-Right / 120 deg) */}
          <line x1="50" y1="38" x2="70" y2="49" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cup 2 */}
          <path
            d="M70 49 C74 43 67 36 62 40 C57 44 64 51 70 49 Z"
            fill="url(#cupGrad2)"
            stroke="#1D4ED8"
            strokeWidth="0.8"
          />

          {/* Arm 3 (Bottom-Left / 240 deg) */}
          <line x1="50" y1="38" x2="30" y2="49" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
          {/* Cup 3 */}
          <path
            d="M30 49 C26 43 33 36 38 40 C43 44 36 51 30 49 Z"
            fill="url(#cupGrad3)"
            stroke="#0369A1"
            strokeWidth="0.8"
          />

          {/* Central Bearing Hub Dome */}
          <circle cx="50" cy="38" r="7.5" fill="url(#hubDome)" stroke="#CBD5E1" strokeWidth="1" />
          <circle cx="48" cy="36" r="2" fill="#FFFFFF" fillOpacity="0.8" />
        </g>

        {/* Aerodynamic Wind Breezes / Streamlines */}
        {isMoving && (
          <g stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
            <path d="M12 25 Q18 22 24 25" />
            <path d="M78 30 Q84 27 90 30" />
            <path d="M74 18 Q82 15 88 18" />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// 5. Realistic 3D Tipping-Bucket Rain Gauge
// ==========================================
export const Sensor3DRainGauge: React.FC<{
  value: number | null;
  className?: string;
}> = ({ value, className = 'w-24 h-24' }) => {
  const rain = value !== null ? value : 0;
  // Normalize liquid height: 0mm to 50mm -> 0px to 32px
  const clamped = Math.min(Math.max(rain, 0), 50);
  const waterHeight = Math.max(3, (clamped / 50) * 32);
  const waterY = 82 - waterHeight;

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Stainless Steel Outer Funnel Gradient */}
          <linearGradient id="metalFunnel" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="25%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#E2E8F0" />
            <stop offset="85%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Transparent Acrylic Cylinder Body */}
          <linearGradient id="acrylicGlass" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#CBD5E1" stopOpacity="0.7" />
            <stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#F8FAFC" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.7" />
          </linearGradient>

          {/* Clear Blue Water Fill */}
          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.95" />
          </linearGradient>

          {/* Surface Meniscus */}
          <linearGradient id="waterSurface" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#BAE6FD" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
        </defs>

        {/* Soft Ground Shadow */}
        <ellipse cx="50" cy="94" rx="22" ry="5" fill="#0F172A" fillOpacity="0.08" />

        {/* Stainless Steel Collector Funnel (Top) */}
        <polygon points="26,12 74,12 60,34 40,34" fill="url(#metalFunnel)" stroke="#94A3B8" strokeWidth="0.8" />
        <ellipse cx="50" cy="12" rx="24" ry="4" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
        <ellipse cx="50" cy="12" rx="20" ry="3" fill="#1E293B" fillOpacity="0.15" />

        {/* Funnel Throat Orifice */}
        <rect x="46" y="34" width="8" height="6" fill="#64748B" />

        {/* Measuring Cylinder Inner Backing */}
        <rect x="36" y="40" width="28" height="45" rx="3" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.8" />

        {/* Millimeter Graduation Scale Lines */}
        <g stroke="#94A3B8" strokeWidth="1">
          <line x1="37" y1="46" x2="43" y2="46" />
          <line x1="37" y1="53" x2="40" y2="53" />
          <line x1="37" y1="60" x2="43" y2="60" />
          <line x1="37" y1="67" x2="40" y2="67" />
          <line x1="37" y1="74" x2="43" y2="74" />
          <line x1="37" y1="81" x2="40" y2="81" />
        </g>

        {/* Accumulated Water Volume */}
        <rect
          x="37"
          y={waterY}
          width="26"
          height={waterHeight}
          rx="2"
          fill="url(#waterGrad)"
          className="transition-all duration-700 ease-out"
        />
        {/* Water Surface Meniscus Ellipse */}
        <ellipse
          cx="50"
          cy={waterY}
          rx="13"
          ry="2"
          fill="url(#waterSurface)"
          className="transition-all duration-700 ease-out"
        />

        {/* Transparent Outer Acrylic Cylinder with Glass Shimmer */}
        <rect x="36" y="40" width="28" height="45" rx="3" fill="url(#acrylicGlass)" stroke="#CBD5E1" strokeWidth="1" />

        {/* Specular Highlight Streak on Glass */}
        <line x1="40" y1="43" x2="40" y2="82" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />

        {/* Heavy Rain Falling Drops if rain > 0 */}
        {rain > 0 && (
          <g fill="#38BDF8">
            <ellipse cx="50" cy="22" rx="1.5" ry="2.5" className="animate-rain-drop" />
            <ellipse cx="46" cy="28" rx="1.2" ry="2" className="animate-rain-drop" style={{ animationDelay: '0.4s' }} />
            <ellipse cx="54" cy="26" rx="1.2" ry="2" className="animate-rain-drop" style={{ animationDelay: '0.8s' }} />
          </g>
        )}

        {/* Base Pedestal Flange */}
        <ellipse cx="50" cy="87" rx="18" ry="4" fill="#94A3B8" stroke="#64748B" strokeWidth="0.8" />
        <ellipse cx="50" cy="85" rx="16" ry="3.5" fill="#E2E8F0" />
      </svg>
    </div>
  );
};

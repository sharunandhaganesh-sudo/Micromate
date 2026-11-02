import React from 'react';

export type MicroMateEmotion =
  | 'happy'
  | 'excited'
  | 'thinking'
  | 'worried'
  | 'surprised'
  | 'sleepy'
  | 'sad'
  | 'in_alert';

interface MicroMateAvatarProps {
  emotion?: MicroMateEmotion;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isFloating?: boolean;
}

export const MicroMateAvatar: React.FC<MicroMateAvatarProps> = ({
  emotion = 'happy',
  size = 'md',
  className = '',
  isFloating = false,
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-36 h-36',
  };

  const isAlert = emotion === 'in_alert';

  return (
    <div
      className={`relative inline-block select-none ${sizeMap[size]} ${
        isFloating ? 'animate-bounce-slow' : ''
      } ${className}`}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          {/* Headphone Glow Gradient */}
          <radialGradient id="earGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isAlert ? '#EF4444' : '#38BDF8'} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isAlert ? '#991B1B' : '#0284C7'} stopOpacity="0.2" />
          </radialGradient>

          {/* Helmet Body Gradient */}
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Visor Screen Gradient */}
          <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isAlert ? '#2A0808' : '#0B1528'} />
            <stop offset="100%" stopColor={isAlert ? '#1A0404' : '#070D18'} />
          </linearGradient>

          {/* Sprout Green */}
          <linearGradient id="sproutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>

          {/* Blue Trim & Cape */}
          <linearGradient id="capeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
        </defs>

        {/* 1. Cape Behind Body */}
        <path
          d="M 68 140 C 50 160 40 185 62 195 C 80 190 100 185 138 195 C 160 185 150 160 132 140 Z"
          fill="url(#capeGrad)"
          opacity="0.9"
        />

        {/* 2. Sprout Leaf on Top of Head */}
        <g id="sprout">
          {/* Stem */}
          <path
            d="M 100 48 Q 98 32 100 24"
            stroke="#16A34A"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Left Leaf */}
          <path
            d="M 100 25 C 88 18 80 24 84 32 C 90 35 96 30 100 25 Z"
            fill="url(#sproutGrad)"
            stroke="#15803D"
            strokeWidth="1.5"
          />
          {/* Right Leaf */}
          <path
            d="M 100 25 C 114 16 122 22 118 30 C 112 34 104 29 100 25 Z"
            fill="url(#sproutGrad)"
            stroke="#15803D"
            strokeWidth="1.5"
          />
        </g>

        {/* 3. Alert Beacon Siren (Only in Alert mode) */}
        {isAlert && (
          <g id="siren" className="animate-pulse">
            <path d="M 94 48 L 106 48 L 104 36 L 96 36 Z" fill="#EF4444" />
            <circle cx="100" cy="36" r="6" fill="#F87171" />
            <line x1="88" y1="28" x2="82" y2="24" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="112" y1="28" x2="118" y2="24" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {/* 4. Left & Right Headphones */}
        {/* Left Ear Phone */}
        <g id="leftEar">
          <rect x="22" y="70" width="18" height="42" rx="9" fill={isAlert ? '#991B1B' : '#0284C7'} />
          <circle cx="31" cy="91" r="12" fill={isAlert ? '#EF4444' : '#38BDF8'} />
          <circle cx="31" cy="91" r="6" fill={isAlert ? '#FCA5A5' : '#BAE6FD'} className={isAlert ? 'animate-ping' : ''} />
        </g>

        {/* Right Ear Phone */}
        <g id="rightEar">
          <rect x="160" y="70" width="18" height="42" rx="9" fill={isAlert ? '#991B1B' : '#0284C7'} />
          <circle cx="169" cy="91" r="12" fill={isAlert ? '#EF4444' : '#38BDF8'} />
          <circle cx="169" cy="91" r="6" fill={isAlert ? '#FCA5A5' : '#BAE6FD'} className={isAlert ? 'animate-ping' : ''} />
        </g>

        {/* 5. Headphone Arc Band */}
        <path
          d="M 36 78 C 42 46 158 46 164 78"
          stroke={isAlert ? '#DC2626' : '#0284C7'}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />

        {/* 6. Robot Head Base */}
        <rect
          x="38"
          y="50"
          width="124"
          height="82"
          rx="38"
          fill="url(#bodyGrad)"
          stroke={isAlert ? '#DC2626' : '#0284C7'}
          strokeWidth="3.5"
        />

        {/* 7. Visor Screen */}
        <rect
          x="48"
          y="60"
          width="104"
          height="62"
          rx="26"
          fill="url(#visorGrad)"
          stroke="#1E293B"
          strokeWidth="2"
        />

        {/* Visor Glare/Reflect */}
        <path
          d="M 58 66 Q 95 62 138 72"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* 8. Robot Body & Chest Crest */}
        <path
          d="M 72 132 C 72 132 68 175 100 175 C 132 175 128 132 128 132 Z"
          fill="url(#bodyGrad)"
          stroke="#0284C7"
          strokeWidth="3"
        />

        {/* Leaf Emblem on Chest */}
        <circle cx="100" cy="154" r="11" fill="#0284C7" />
        <path
          d="M 100 147 C 94 150 94 158 100 160 C 106 158 106 150 100 147 Z"
          fill="#4ADE80"
        />

        {/* Arms / Hands */}
        <ellipse cx="62" cy="148" rx="8" ry="12" fill="url(#bodyGrad)" stroke="#0284C7" strokeWidth="2.5" />
        <ellipse cx="138" cy="148" rx="8" ry="12" fill="url(#bodyGrad)" stroke="#0284C7" strokeWidth="2.5" />

        {/* 9. Visor Expressions & Emotions */}
        {/* HAPPY (Curved smiling eyes, rosy cheeks, cute mouth) */}
        {emotion === 'happy' && (
          <g id="expr-happy">
            {/* Left Eye */}
            <path d="M 70 88 Q 78 80 86 88" stroke="#38BDF8" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            {/* Right Eye */}
            <path d="M 114 88 Q 122 80 130 88" stroke="#38BDF8" strokeWidth="4.5" strokeLinecap="round" fill="none" />
            {/* Smile Mouth */}
            <path d="M 94 98 Q 100 104 106 98" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Cheeks */}
            <ellipse cx="68" cy="96" rx="4" ry="2.5" fill="#F472B6" opacity="0.7" />
            <ellipse cx="132" cy="96" rx="4" ry="2.5" fill="#F472B6" opacity="0.7" />
          </g>
        )}

        {/* EXCITED (Star eyes ✨, cheerful open mouth) */}
        {emotion === 'excited' && (
          <g id="expr-excited">
            {/* Left Star Eye */}
            <path d="M 78 78 L 80 85 L 87 87 L 80 89 L 78 96 L 76 89 L 69 87 L 76 85 Z" fill="#FACC15" />
            {/* Right Star Eye */}
            <path d="M 122 78 L 124 85 L 131 87 L 124 89 L 122 96 L 120 89 L 113 87 L 120 85 Z" fill="#FACC15" />
            {/* Open Mouth */}
            <path d="M 94 97 Q 100 106 106 97 Z" fill="#38BDF8" />
            {/* Cheeks */}
            <ellipse cx="67" cy="97" rx="4.5" ry="3" fill="#F472B6" opacity="0.8" />
            <ellipse cx="133" cy="97" rx="4.5" ry="3" fill="#F472B6" opacity="0.8" />
          </g>
        )}

        {/* THINKING (Looking up, question mark ❓) */}
        {emotion === 'thinking' && (
          <g id="expr-thinking">
            {/* Left Eye */}
            <circle cx="78" cy="85" r="4.5" fill="#38BDF8" />
            {/* Right Eye */}
            <circle cx="122" cy="85" r="4.5" fill="#38BDF8" />
            {/* Hand at chin */}
            <ellipse cx="106" cy="106" rx="6" ry="6" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2" />
            {/* Small wavy mouth */}
            <path d="M 94 98 Q 98 100 102 98" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* Floating question mark */}
            <text x="140" y="66" fill="#38BDF8" fontSize="16" fontWeight="bold" fontFamily="monospace">?</text>
          </g>
        )}

        {/* WORRIED (Wavy mouth, tilted eyes, sweat droplet 💧) */}
        {emotion === 'worried' && (
          <g id="expr-worried">
            {/* Left Eye */}
            <path d="M 72 84 Q 80 89 86 86" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Right Eye */}
            <path d="M 114 86 Q 120 89 128 84" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Wavy Mouth */}
            <path d="M 93 100 Q 97 97 101 100 Q 105 103 108 99" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* Sweat Drop */}
            <path d="M 134 76 C 132 80 130 84 133 86 C 136 88 138 85 137 81 Z" fill="#38BDF8" />
          </g>
        )}

        {/* SURPRISED (Wide open O_O eyes & mouth) */}
        {emotion === 'surprised' && (
          <g id="expr-surprised">
            {/* Left Eye */}
            <circle cx="78" cy="87" r="7" stroke="#38BDF8" strokeWidth="3" fill="none" />
            {/* Right Eye */}
            <circle cx="122" cy="87" r="7" stroke="#38BDF8" strokeWidth="3" fill="none" />
            {/* O Mouth */}
            <ellipse cx="100" cy="100" rx="4" ry="6" fill="#38BDF8" />
          </g>
        )}

        {/* SLEEPY (Closed calm eyes, Z z Z floating) */}
        {emotion === 'sleepy' && (
          <g id="expr-sleepy">
            {/* Left Eye */}
            <line x1="72" y1="88" x2="84" y2="88" stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />
            {/* Right Eye */}
            <line x1="116" y1="88" x2="128" y2="88" stroke="#64748B" strokeWidth="3.5" strokeLinecap="round" />
            {/* Gentle smile */}
            <path d="M 96 99 Q 100 102 104 99" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Z z Z */}
            <text x="136" y="70" fill="#38BDF8" fontSize="13" fontWeight="bold" fontFamily="monospace">Z</text>
            <text x="146" y="60" fill="#38BDF8" fontSize="10" fontWeight="bold" fontFamily="monospace">z</text>
          </g>
        )}

        {/* SAD (Drooping eyes, tear) */}
        {emotion === 'sad' && (
          <g id="expr-sad">
            {/* Left Eye */}
            <path d="M 72 87 Q 78 82 86 89" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Right Eye */}
            <path d="M 114 89 Q 122 82 128 87" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Down Mouth */}
            <path d="M 95 101 Q 100 96 105 101" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* Tear */}
            <ellipse cx="86" cy="98" rx="2.5" ry="4" fill="#38BDF8" />
          </g>
        )}

        {/* IN ALERT (Red alert brows, glowing eyes, siren flashing) */}
        {emotion === 'in_alert' && (
          <g id="expr-alert">
            {/* Left Angled Eye */}
            <path d="M 70 82 L 86 90 L 74 92 Z" fill="#EF4444" />
            {/* Right Angled Eye */}
            <path d="M 130 82 L 114 90 L 126 92 Z" fill="#EF4444" />
            {/* Alert Mouth */}
            <line x1="93" y1="101" x2="107" y2="101" stroke="#EF4444" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
};

import { ImageResponse } from 'next/og';

export const alt = 'AxisForge — On-Demand 3D Print Studio';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#F6F6F3',
        padding: '64px 72px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '18px',
              backgroundColor: '#141413',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 20.5L10.5 26.5M20 20.5L29.5 26.5"
                stroke="#F6F6F3"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path d="M20 9.5V20.5" stroke="#FF4F00" strokeWidth="3" strokeLinecap="round" />
              <circle cx="20" cy="20.5" r="2.6" fill="#F6F6F3" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: '34px',
                fontWeight: 700,
                color: '#141413',
                letterSpacing: '-0.025em',
              }}
            >
              AxisForge
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#71717A',
                letterSpacing: '0.12em',
              }}
            >
              ON-DEMAND 3D PRINT STUDIO • STUDIO 01
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderRadius: '999px',
            padding: '12px 22px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#27272A',
          }}
        >
          <div
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '999px',
              backgroundColor: '#10B981',
            }}
          />
          <span>Bambu Lab X1C Farm • 256 × 256 × 256 mm</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '940px' }}>
        <div
          style={{
            fontSize: '60px',
            fontWeight: 700,
            color: '#141413',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
          }}
        >
          Fra idé, .STL, .3MF eller parametrisk .SCAD til ferdig 3D-print.
        </div>
        <div style={{ fontSize: '22px', color: '#52525B', lineHeight: 1.45 }}>
          Interaktiv 3D-konfigurator med sanntids millimeter-skalering, deterministisk slicing og
          direkte produksjon på Bambu Lab X1C.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #E4E4E7',
          paddingTop: '24px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#71717A',
          letterSpacing: '0.06em',
        }}
      >
        <span>1. VELG / GENERER 3D-MODELL</span>
        <span style={{ color: '#FF4F00' }}>→</span>
        <span>2. TILPASS MILLIMETER & PLASTTYPE</span>
        <span style={{ color: '#FF4F00' }}>→</span>
        <span>3. SE PRIS & BESTILL</span>
      </div>
    </div>,
    {
      ...size,
    }
  );
}

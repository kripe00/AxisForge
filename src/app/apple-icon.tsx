import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#141413',
        borderRadius: 42,
      }}
    >
      <svg width="124" height="124" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 20.5L10.5 26.5M20 20.5L29.5 26.5"
          stroke="#F6F6F3"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path d="M20 9.5V20.5" stroke="#FF4F00" strokeWidth="3" strokeLinecap="round" />
        <circle cx="20" cy="20.5" r="2.6" fill="#F6F6F3" />
      </svg>
    </div>,
    {
      ...size,
    }
  );
}

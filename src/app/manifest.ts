import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AxisForge — On-Demand 3D Print Studio',
    short_name: 'AxisForge',
    description:
      'Nordisk 3D-print på bestilling. Generer 3D-modeller med AI, tilpass parametriske .SCAD-modeller eller last opp .STL / .3MF.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F6F3',
    theme_color: '#141413',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/logo-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}

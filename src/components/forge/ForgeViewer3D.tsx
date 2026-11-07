'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Eye, Grid as GridIcon, Loader2, RotateCw } from 'lucide-react';
import {
  BAMBU_BUILD_VOLUME_MM,
  MATERIALS,
  type CatalogFileFormat,
  type DimensionsMm,
  type FilamentMaterialCode,
  type ParametricTemplateId,
  type ProceduralPreset,
} from '@/lib/schemas/forge';
import { base64ToArrayBuffer, parseCadModelBuffer } from '@/lib/three/model-loader';
import { buildParametricModel } from '@/lib/three/parametric-engine';
import { useForgeStore } from '@/store/useForgeStore';

const MM_TO_SCENE = 0.1;
const PLATE_SIZE_UNITS = BAMBU_BUILD_VOLUME_MM.x * MM_TO_SCENE; // 25.6

interface ProceduralMeshProps {
  preset: ProceduralPreset;
  customGeometry: THREE.BufferGeometry | null;
  dimensionsMm: DimensionsMm;
  materialCode: FilamentMaterialCode;
  colorHex: string;
  wireframe: boolean;
  autoRotate: boolean;
  showBoundingBox: boolean;
}

function detectFormatFromUrlOrFormat(
  url?: string | null,
  explicitFormat?: CatalogFileFormat | null
): 'stl' | '3mf' {
  if (explicitFormat === '3mf') {
    return '3mf';
  }
  if (url && url.toLowerCase().endsWith('.3mf')) {
    return '3mf';
  }
  return 'stl';
}

/**
 * Hook that resolves a normalized THREE.BufferGeometry from either:
 * 1. An already-parsed THREE.BufferGeometry passed in memory,
 * 2. A base64-encoded .stl or .3mf payload (`stlBase64`),
 * 3. A server-hosted or blob URL (`modelFileUrl`, e.g. `/uploads/catalog/...`), or
 * 4. Raw OpenSCAD source (`scadSource` or `.scad` URL) compiled via `/api/parametric/scad`.
 */
function useResolvedCadGeometry(options: {
  directGeometry?: THREE.BufferGeometry | null;
  parametricTemplateId?: ParametricTemplateId | null;
  parametricParams?: Record<string, number> | null;
  modelFileUrl?: string | null;
  stlBase64?: string | null;
  scadSource?: string | null;
  fileFormat?: CatalogFileFormat | null;
  isExternalScadCompileActive?: boolean;
}): {
  geometry: THREE.BufferGeometry | null;
  triangleCount: number | null;
  isLoadingMesh: boolean;
  meshError: string | null;
} {
  const {
    directGeometry,
    parametricTemplateId,
    parametricParams,
    modelFileUrl,
    stlBase64,
    scadSource,
    fileFormat,
    isExternalScadCompileActive,
  } = options;
  const [fetchedGeometry, setFetchedGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [fetchedTriangles, setFetchedTriangles] = useState<number | null>(null);
  const [isLoadingMesh, setIsLoadingMesh] = useState(false);
  const [meshError, setMeshError] = useState<string | null>(null);

  const inlineParsed = useMemo(() => {
    if (directGeometry) {
      const pos = directGeometry.getAttribute('position');
      const count = pos ? Math.floor(pos.count / 3) : null;
      return { geometry: directGeometry, triangleCount: count };
    }
    if (parametricTemplateId) {
      try {
        const built = buildParametricModel(parametricTemplateId, parametricParams ?? {});
        return {
          geometry: built.normalizedGeometry,
          triangleCount: built.triangleCount,
        };
      } catch {
        return null;
      }
    }
    if (!stlBase64) return null;
    try {
      const format = detectFormatFromUrlOrFormat(modelFileUrl, fileFormat);
      const buffer = base64ToArrayBuffer(stlBase64);
      const parsed = parseCadModelBuffer(buffer, format);
      return {
        geometry: parsed.normalizedGeometry,
        triangleCount: parsed.triangleCount,
      };
    } catch {
      return null;
    }
  }, [directGeometry, parametricTemplateId, parametricParams, stlBase64, modelFileUrl, fileFormat]);

  useEffect(() => {
    if (inlineParsed?.geometry) {
      setFetchedGeometry(null);
      setFetchedTriangles(null);
      setIsLoadingMesh(false);
      setMeshError(null);
      return;
    }

    if (isExternalScadCompileActive) {
      return;
    }

    const isScadUrl = Boolean(modelFileUrl && modelFileUrl.toLowerCase().endsWith('.scad'));
    const needsScadCompilation = Boolean(scadSource || isScadUrl);

    if (!modelFileUrl && !needsScadCompilation) {
      setFetchedGeometry(null);
      setFetchedTriangles(null);
      setIsLoadingMesh(false);
      setMeshError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingMesh(true);
    setMeshError(null);

    if (needsScadCompilation) {
      const compilePromise = (async () => {
        let sourceText = scadSource;
        if (!sourceText && modelFileUrl) {
          const srcRes = await fetch(modelFileUrl);
          if (!srcRes.ok) {
            throw new Error(`Kunne ikke laste .scad-fil (${srcRes.status})`);
          }
          sourceText = await srcRes.text();
        }
        if (!sourceText) {
          throw new Error('Tom .scad-kildekode');
        }

        const compileRes = await fetch('/api/parametric/scad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scadSource: sourceText,
            parameters: {},
            fastPreview: true,
          }),
        });
        const data = (await compileRes.json()) as {
          stlBase64?: string;
          message?: string;
        };
        if (!compileRes.ok || !data.stlBase64) {
          throw new Error(data.message || 'Kunne ikke kompilere .scad-fil til 3D-mesh');
        }
        const buffer = base64ToArrayBuffer(data.stlBase64);
        return parseCadModelBuffer(buffer, 'stl');
      })();

      compilePromise
        .then((analysis) => {
          if (cancelled) return;
          setFetchedGeometry(analysis.normalizedGeometry);
          setFetchedTriangles(analysis.triangleCount);
          setIsLoadingMesh(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setFetchedGeometry(null);
          setFetchedTriangles(null);
          setIsLoadingMesh(false);
          setMeshError(err instanceof Error ? err.message : 'Kunne ikke kompilere .scad-fil');
        });

      return () => {
        cancelled = true;
      };
    }

    const format = detectFormatFromUrlOrFormat(modelFileUrl, fileFormat);

    fetch(modelFileUrl!)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Kunne ikke laste 3D-fil (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const analysis = parseCadModelBuffer(buffer, format);
        setFetchedGeometry(analysis.normalizedGeometry);
        setFetchedTriangles(analysis.triangleCount);
        setIsLoadingMesh(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchedGeometry(null);
        setFetchedTriangles(null);
        setIsLoadingMesh(false);
        setMeshError(err instanceof Error ? err.message : 'Kunne ikke lese 3D-fil');
      });

    return () => {
      cancelled = true;
    };
  }, [inlineParsed, modelFileUrl, scadSource, fileFormat, isExternalScadCompileActive]);

  return {
    geometry: inlineParsed?.geometry ?? fetchedGeometry,
    triangleCount: inlineParsed?.triangleCount ?? fetchedTriangles,
    isLoadingMesh,
    meshError,
  };
}

function ProceduralCadModel({
  preset,
  customGeometry,
  dimensionsMm,
  materialCode,
  colorHex,
  wireframe,
  autoRotate,
  showBoundingBox,
}: ProceduralMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const filament = MATERIALS[materialCode];

  const widthU = dimensionsMm.x * MM_TO_SCENE;
  const depthU = dimensionsMm.y * MM_TO_SCENE;
  const heightU = dimensionsMm.z * MM_TO_SCENE;

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.28;
    }
  });

  const sharedMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: filament.roughness,
        metalness: filament.metalness,
        wireframe,
        side: THREE.DoubleSide,
      }),
    [colorHex, filament.roughness, filament.metalness, wireframe]
  );

  const edgeColor = colorHex.toUpperCase() === '#111111' ? '#3F3F46' : '#18181B';

  const customEdgesGeometry = useMemo(() => {
    if (!customGeometry) return null;
    try {
      return new THREE.EdgesGeometry(customGeometry, 28);
    } catch {
      return null;
    }
  }, [customGeometry]);

  useEffect(() => {
    return () => {
      customEdgesGeometry?.dispose();
    };
  }, [customEdgesGeometry]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Subtle Brim Ring on build plate */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry
          args={[Math.max(widthU, depthU) * 0.48, Math.max(widthU, depthU) * 0.54, 48]}
        />
        <meshBasicMaterial
          color={colorHex}
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* Scaled Model Group */}
      <group scale={[widthU, heightU, depthU]}>
        {customGeometry ? (
          <group key={customGeometry.uuid}>
            <mesh geometry={customGeometry} material={sharedMaterial} castShadow receiveShadow />
            {customEdgesGeometry && !wireframe && (
              <lineSegments geometry={customEdgesGeometry}>
                <lineBasicMaterial color={edgeColor} transparent opacity={0.45} />
              </lineSegments>
            )}
          </group>
        ) : (
          <>
            {preset === 'MECH_TURRET' && (
              <group>
                <mesh position={[0, 0.08, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <cylinderGeometry args={[0.48, 0.5, 0.16, 8]} />
                </mesh>
                <mesh position={[0, 0.26, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <cylinderGeometry args={[0.34, 0.4, 0.2, 16]} />
                </mesh>
                <mesh position={[0, 0.56, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <boxGeometry args={[0.68, 0.42, 0.74]} />
                </mesh>
                <mesh
                  position={[-0.16, 0.58, 0.42]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={sharedMaterial}
                  castShadow
                >
                  <cylinderGeometry args={[0.08, 0.08, 0.36, 12]} />
                </mesh>
                <mesh
                  position={[0.16, 0.58, 0.42]}
                  rotation={[Math.PI / 2, 0, 0]}
                  material={sharedMaterial}
                  castShadow
                >
                  <cylinderGeometry args={[0.08, 0.08, 0.36, 12]} />
                </mesh>
                <mesh position={[0, 0.88, -0.05]} material={sharedMaterial} castShadow>
                  <boxGeometry args={[0.36, 0.24, 0.38]} />
                </mesh>
              </group>
            )}

            {preset === 'PLANETARY_GEAR' && (
              <group>
                <mesh position={[0, 0.35, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <cylinderGeometry args={[0.5, 0.5, 0.7, 16]} />
                </mesh>
                <mesh position={[0, 0.65, 0]} material={sharedMaterial} castShadow>
                  <cylinderGeometry args={[0.2, 0.2, 0.7, 6]} />
                </mesh>
                {[0, 1, 2, 3].map((idx) => {
                  const angle = (idx * Math.PI) / 2;
                  return (
                    <mesh
                      key={idx}
                      position={[Math.cos(angle) * 0.32, 0.52, Math.sin(angle) * 0.32]}
                      material={sharedMaterial}
                      castShadow
                    >
                      <cylinderGeometry args={[0.12, 0.12, 0.95, 10]} />
                    </mesh>
                  );
                })}
              </group>
            )}

            {preset === 'CYBER_HELMET' && (
              <group>
                <mesh position={[0, 0.12, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <cylinderGeometry args={[0.36, 0.46, 0.24, 12]} />
                </mesh>
                <mesh position={[0, 0.56, 0]} material={sharedMaterial} castShadow>
                  <dodecahedronGeometry args={[0.44, 1]} />
                </mesh>
                <mesh position={[0, 0.58, 0.28]} material={sharedMaterial} castShadow>
                  <boxGeometry args={[0.66, 0.22, 0.32]} />
                </mesh>
                <mesh
                  position={[-0.4, 0.68, -0.05]}
                  rotation={[0, 0, -0.15]}
                  material={sharedMaterial}
                >
                  <boxGeometry args={[0.08, 0.42, 0.24]} />
                </mesh>
                <mesh
                  position={[0.4, 0.68, -0.05]}
                  rotation={[0, 0, 0.15]}
                  material={sharedMaterial}
                >
                  <boxGeometry args={[0.08, 0.42, 0.24]} />
                </mesh>
              </group>
            )}

            {preset === 'INDUSTRIAL_BRACKET' && (
              <group>
                <mesh position={[0, 0.09, 0]} material={sharedMaterial} castShadow receiveShadow>
                  <boxGeometry args={[0.96, 0.18, 0.88]} />
                </mesh>
                <mesh position={[0, 0.52, -0.32]} material={sharedMaterial} castShadow>
                  <boxGeometry args={[0.96, 0.92, 0.22]} />
                </mesh>
                <mesh
                  position={[-0.36, 0.42, 0.04]}
                  rotation={[Math.PI / 4, 0, 0]}
                  material={sharedMaterial}
                  castShadow
                >
                  <boxGeometry args={[0.14, 0.68, 0.68]} />
                </mesh>
                <mesh
                  position={[0.36, 0.42, 0.04]}
                  rotation={[Math.PI / 4, 0, 0]}
                  material={sharedMaterial}
                  castShadow
                >
                  <boxGeometry args={[0.14, 0.68, 0.68]} />
                </mesh>
              </group>
            )}
          </>
        )}
      </group>

      {/* Refined Nordic Dimension Callout */}
      {showBoundingBox && (
        <group position={[0, heightU / 2, 0]}>
          <mesh>
            <boxGeometry args={[widthU, heightU, depthU]} />
            <meshBasicMaterial color="#FF4F00" wireframe transparent opacity={0.4} />
          </mesh>
          <Html position={[widthU / 2 + 0.4, heightU / 2 + 0.3, 0]} center distanceFactor={26}>
            <div className="whitespace-nowrap rounded-full border border-zinc-200/90 bg-white/95 px-3 py-1 font-mono text-[11px] font-semibold text-zinc-900 shadow-nordic">
              {dimensionsMm.x} × {dimensionsMm.y} × {dimensionsMm.z} mm
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

interface BambuPlateSceneProps {
  preset: ProceduralPreset;
  customGeometry: THREE.BufferGeometry | null;
  dimensionsMm: DimensionsMm;
  materialCode: FilamentMaterialCode;
  colorHex: string;
  wireframe: boolean;
  autoRotate: boolean;
  showBoundingBox: boolean;
}

function BambuBuildPlateScene({
  preset,
  customGeometry,
  dimensionsMm,
  materialCode,
  colorHex,
  wireframe,
  autoRotate,
  showBoundingBox,
}: BambuPlateSceneProps) {
  const plateMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const tabMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ camera }) => {
    // Smoothly make the build plate transparent when the user rotates down to look underneath
    // camera.position.y >= 1.2 -> solid (opacity 1.0)
    // camera.position.y <= -0.2 -> crystal-clear glass (opacity 0.06)
    const t = THREE.MathUtils.clamp((camera.position.y + 0.2) / 1.4, 0, 1);
    const nextOpacity = THREE.MathUtils.lerp(0.06, 1.0, t);
    const shouldWriteDepth = nextOpacity > 0.95;

    if (plateMatRef.current) {
      plateMatRef.current.opacity = nextOpacity;
      plateMatRef.current.depthWrite = shouldWriteDepth;
    }
    if (tabMatRef.current) {
      tabMatRef.current.opacity = nextOpacity;
      tabMatRef.current.depthWrite = shouldWriteDepth;
    }
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[18, 28, 18]}
        intensity={1.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-16, 14, -14]} intensity={0.5} />
      {/* Bottom fill light so the underside of the model is well-lit when viewing from below */}
      <directionalLight position={[0, -24, 10]} intensity={0.75} />

      {/* Physical Bambu Lab 256 x 256 mm Anodized Dark Build Plate (auto-transparent from below) */}
      <group position={[0, -0.15, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[PLATE_SIZE_UNITS, 0.3, PLATE_SIZE_UNITS]} />
          <meshStandardMaterial
            ref={plateMatRef}
            color="#202225"
            roughness={0.8}
            metalness={0.2}
            transparent
            opacity={1}
          />
        </mesh>

        {/* Front Bambu Lab Nozzle Calibration Tab */}
        <mesh position={[0, 0, PLATE_SIZE_UNITS / 2 + 0.55]}>
          <boxGeometry args={[6.2, 0.26, 1.1]} />
          <meshStandardMaterial
            ref={tabMatRef}
            color="#18181B"
            roughness={0.7}
            transparent
            opacity={1}
          />
        </mesh>
      </group>

      {/* Precision Millimeter Grid Overlay */}
      <Grid
        position={[0, 0.01, 0]}
        args={[PLATE_SIZE_UNITS, PLATE_SIZE_UNITS]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#3F3F46"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#71717A"
        fadeDistance={65}
        infiniteGrid={false}
        side={THREE.DoubleSide}
      />

      {/* Subtle 256 x 256 x 256 mm Build Volume Envelope */}
      <mesh position={[0, PLATE_SIZE_UNITS / 2, 0]}>
        <boxGeometry args={[PLATE_SIZE_UNITS, PLATE_SIZE_UNITS, PLATE_SIZE_UNITS]} />
        <meshBasicMaterial
          color="#71717A"
          wireframe
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      <Html
        position={[-PLATE_SIZE_UNITS / 2 + 2.8, 0.2, PLATE_SIZE_UNITS / 2 + 1.0]}
        center
        distanceFactor={32}
      >
        <div className="whitespace-nowrap rounded-full bg-zinc-900/90 px-2.5 py-0.5 font-mono text-[10px] font-medium text-zinc-200">
          Bambu Lab X1C • 256 × 256 × 256 mm
        </div>
      </Html>

      <ProceduralCadModel
        preset={preset}
        customGeometry={customGeometry}
        dimensionsMm={dimensionsMm}
        materialCode={materialCode}
        colorHex={colorHex}
        wireframe={wireframe}
        autoRotate={autoRotate}
        showBoundingBox={showBoundingBox}
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI - 0.05}
        minDistance={8}
        maxDistance={48}
        target={[0, (dimensionsMm.z * MM_TO_SCENE) / 2, 0]}
      />
    </>
  );
}

export function ForgeViewer3D() {
  const {
    activeJob,
    material,
    colorHex,
    wireframeMode,
    showBoundingBox,
    autoRotate,
    isCompilingScad,
    errorBanner,
    toggleWireframeMode,
    toggleBoundingBox,
    toggleAutoRotate,
    getComputedDimensionsMm,
  } = useForgeStore();

  const liveDims = getComputedDimensionsMm();
  const selectedFilament = MATERIALS[material];

  const { geometry, triangleCount, isLoadingMesh, meshError } = useResolvedCadGeometry({
    parametricTemplateId: activeJob.parametricTemplateId,
    parametricParams: activeJob.parametricParams,
    modelFileUrl: activeJob.modelFileUrl ?? activeJob.glbDownloadUrl,
    stlBase64: activeJob.stlBase64,
    scadSource: activeJob.scadSource,
    fileFormat: activeJob.fileFormat,
    isExternalScadCompileActive: isCompilingScad,
  });

  const activeFormatLabel = activeJob.parametricTemplateId
    ? 'Parametrisk CAD'
    : `Ekte ${(activeJob.fileFormat || 'stl').toUpperCase()}`;

  const isBusy = isLoadingMesh || isCompilingScad;
  const activeError = errorBanner || meshError;

  return (
    <section
      aria-label="Interaktiv 3D Bambu Lab Byggeplate"
      className="relative flex h-[450px] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-[#ECEBE6] to-[#E2E0D8] shadow-nordic-lg sm:h-[520px]"
    >
      {/* Top Studio Glass Bar */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 bg-white/80 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-display text-xs font-semibold tracking-tight text-zinc-900">
            {activeJob.prompt}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          {isBusy && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-800">
              <Loader2 className="h-3 w-3 animate-spin" />
              {isCompilingScad ? 'Kompilerer .SCAD til 3D...' : 'Laster 3D-fil...'}
            </span>
          )}
          {geometry && !isBusy && (
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800">
              {activeFormatLabel}-mesh
              {triangleCount ? ` • ${triangleCount.toLocaleString('nb-NO')} triangler` : ''}
            </span>
          )}
          <span className="rounded-md bg-zinc-900 px-2.5 py-0.5 font-semibold text-white">
            {liveDims.x} × {liveDims.y} × {liveDims.z} mm
          </span>
        </div>
      </div>

      {/* Three.js Canvas */}
      <div className="relative flex-1 cursor-grab active:cursor-grabbing">
        <Canvas shadows camera={{ position: [19, 16, 22], fov: 42 }} gl={{ antialias: true }}>
          <BambuBuildPlateScene
            preset={activeJob.proceduralPreset}
            customGeometry={geometry}
            dimensionsMm={liveDims}
            materialCode={material}
            colorHex={colorHex}
            wireframe={wireframeMode}
            autoRotate={autoRotate}
            showBoundingBox={showBoundingBox}
          />
        </Canvas>

        {/* Live OpenSCAD Compilation Overlay */}
        {isBusy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-5 py-3.5 shadow-nordic-lg">
              <Loader2 className="h-5 w-5 animate-spin text-[#FF4F00]" />
              <div>
                <div className="font-display text-xs font-bold text-zinc-900">
                  {isCompilingScad
                    ? 'Kompilerer parametrisk .SCAD-fil med OpenSCAD...'
                    : 'Leser 3D-geometri...'}
                </div>
                <div className="font-mono text-[11px] text-zinc-500">
                  Bygger 3D-mesh og oppdaterer byggeplaten
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Overlay if compilation fails */}
        {activeError && !isBusy && (
          <div className="absolute left-4 right-4 top-4 rounded-xl border border-red-200 bg-red-50/95 px-4 py-2.5 text-xs font-medium text-red-900 shadow-nordic">
            {activeError}
          </div>
        )}

        {/* Floating Translucent Pill Controls */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAutoRotate}
            aria-pressed={autoRotate}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all ${
              autoRotate
                ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                : 'border-zinc-200/90 bg-white/85 text-zinc-700 hover:bg-white'
            }`}
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Rotasjon</span>
          </button>

          <button
            type="button"
            onClick={toggleBoundingBox}
            aria-pressed={showBoundingBox}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all ${
              showBoundingBox
                ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                : 'border-zinc-200/90 bg-white/85 text-zinc-700 hover:bg-white'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>Dimensjoner</span>
          </button>

          <button
            type="button"
            onClick={toggleWireframeMode}
            aria-pressed={wireframeMode}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all ${
              wireframeMode
                ? 'border-[#FF4F00] bg-[#FF4F00] text-white shadow-nordic-sm'
                : 'border-zinc-200/90 bg-white/85 text-zinc-700 hover:bg-white'
            }`}
          >
            <GridIcon className="h-3.5 w-3.5" />
            <span>Trådmodell</span>
          </button>
        </div>

        {/* Floating Active Filament Pill */}
        <div className="pointer-events-none absolute right-4 top-4 hidden items-center gap-2 rounded-full border border-zinc-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-zinc-800 shadow-nordic-sm backdrop-blur-md sm:flex">
          <Eye className="h-3.5 w-3.5 text-zinc-400" />
          <span
            className="h-3 w-3 rounded-full border border-black/15"
            style={{ backgroundColor: colorHex }}
          />
          <span>{selectedFilament.label}</span>
        </div>
      </div>
    </section>
  );
}

export interface AdminModelPreview3DProps {
  title: string;
  fileFormat: CatalogFileFormat;
  directGeometry: THREE.BufferGeometry | null;
  parametricTemplateId?: ParametricTemplateId | null;
  parametricParams?: Record<string, number> | null;
  scadSource?: string | null;
  isCompilingScad?: boolean;
  modelFileUrl?: string | null;
  stlBase64?: string | null;
  preset: ProceduralPreset;
  dimensionsMm: DimensionsMm;
  materialCode: FilamentMaterialCode;
  colorHex: string;
  triangleCount?: number | null;
}

/**
 * Dedicated live 3D Bambu Lab build plate preview for `/admin` so admins can inspect
 * uploaded .STL, .3MF, and parametric models directly before and after publishing.
 */
export function AdminModelPreview3D({
  title,
  fileFormat,
  directGeometry,
  parametricTemplateId,
  parametricParams,
  scadSource,
  isCompilingScad,
  modelFileUrl,
  stlBase64,
  preset,
  dimensionsMm,
  materialCode,
  colorHex,
  triangleCount: propTriangles,
}: AdminModelPreview3DProps) {
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  const { geometry, triangleCount, isLoadingMesh } = useResolvedCadGeometry({
    directGeometry,
    parametricTemplateId,
    parametricParams,
    scadSource,
    modelFileUrl,
    stlBase64,
    fileFormat,
    isExternalScadCompileActive: isCompilingScad,
  });

  const resolvedTriangles = propTriangles ?? triangleCount;

  return (
    <div className="relative flex h-[320px] flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-[#ECEBE6] to-[#E2E0D8] shadow-nordic">
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/70 bg-white/85 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-display text-xs font-bold text-zinc-900">
            3D-forhåndsvisning: {title || 'Valgt modell'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {isLoadingMesh ? (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-800">
              Leser 3D-fil...
            </span>
          ) : geometry ? (
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800">
              Ekte .{fileFormat.toUpperCase()} mesh
              {resolvedTriangles ? ` (${resolvedTriangles.toLocaleString('nb-NO')} tri)` : ''}
            </span>
          ) : (
            <span className="rounded bg-zinc-200/80 px-2 py-0.5 font-medium text-zinc-700">
              Standard forhåndsvisning
            </span>
          )}
          <span className="rounded bg-zinc-900 px-2 py-0.5 font-semibold text-white">
            {dimensionsMm.x}×{dimensionsMm.y}×{dimensionsMm.z} mm
          </span>
        </div>
      </div>

      <div className="relative flex-1 cursor-grab active:cursor-grabbing">
        <Canvas shadows camera={{ position: [19, 16, 22], fov: 42 }} gl={{ antialias: true }}>
          <BambuBuildPlateScene
            preset={preset}
            customGeometry={geometry}
            dimensionsMm={dimensionsMm}
            materialCode={materialCode}
            colorHex={colorHex}
            wireframe={wireframe}
            autoRotate={autoRotate}
            showBoundingBox={true}
          />
        </Canvas>

        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${
              autoRotate
                ? 'border-zinc-900 bg-zinc-900 text-white'
                : 'border-zinc-200 bg-white/85 text-zinc-700'
            }`}
          >
            Rotasjon
          </button>
          <button
            type="button"
            onClick={() => setWireframe((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md ${
              wireframe
                ? 'border-[#FF4F00] bg-[#FF4F00] text-white'
                : 'border-zinc-200 bg-white/85 text-zinc-700'
            }`}
          >
            Trådmodell
          </button>
        </div>
      </div>
    </div>
  );
}

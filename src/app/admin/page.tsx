'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type * as THREE from 'three';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Eye,
  FileBox,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  MATERIALS,
  type CatalogFileFormat,
  type CatalogModelDocument,
  type FilamentMaterialCode,
  type ParametricTemplateId,
  type ProceduralPreset,
  type ScadParameterDef,
} from '@/lib/schemas/forge';
import {
  base64ToArrayBuffer,
  generateSample3mfArchive,
  parseCadModelBuffer,
} from '@/lib/three/model-loader';
import {
  buildParametricModel,
  getDefaultParametricValues,
  PARAMETRIC_TEMPLATES,
} from '@/lib/three/parametric-engine';
import { parseScadParameters, SAMPLE_OPENSCAD_FILE_CONTENT } from '@/lib/three/scad-parser';
import { useForgeStore } from '@/store/useForgeStore';
import { useAuth } from '@/components/providers/AuthProvider';

const AdminModelPreview3D = dynamic(
  () => import('@/components/forge/ForgeViewer3D').then((mod) => mod.AdminModelPreview3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-zinc-200 bg-[#ECEBE6] font-mono text-xs text-zinc-500">
        Laster 3D-forhåndsvisning...
      </div>
    ),
  }
);

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return window.btoa(binary);
}

/**
 * Generates a real ASCII STL file of a calibration/hex stand so admin can test STL parsing
 * and 3D rendering with one click even without a local .stl file on disk.
 */
function generateSampleAsciiStl(sizeMm = 75): ArrayBuffer {
  const r = sizeMm / 2;
  const h = sizeMm;
  const segments = 6;
  const lines: string[] = ['solid axisforge_hex_stand'];

  for (let i = 0; i < segments; i++) {
    const a1 = (i * 2 * Math.PI) / segments;
    const a2 = ((i + 1) * 2 * Math.PI) / segments;
    const x1 = (Math.cos(a1) * r).toFixed(3);
    const y1 = (Math.sin(a1) * r).toFixed(3);
    const x2 = (Math.cos(a2) * r).toFixed(3);
    const y2 = (Math.sin(a2) * r).toFixed(3);

    // Side quad (2 triangles)
    lines.push('facet normal 0 0 0', 'outer loop');
    lines.push(`vertex ${x1} ${y1} 0`, `vertex ${x2} ${y2} 0`, `vertex ${x2} ${y2} ${h}`);
    lines.push('endloop', 'endfacet');

    lines.push('facet normal 0 0 0', 'outer loop');
    lines.push(`vertex ${x1} ${y1} 0`, `vertex ${x2} ${y2} ${h}`, `vertex ${x1} ${y1} ${h}`);
    lines.push('endloop', 'endfacet');

    // Top cap triangle
    lines.push('facet normal 0 0 1', 'outer loop');
    lines.push(`vertex 0 0 ${h}`, `vertex ${x1} ${y1} ${h}`, `vertex ${x2} ${y2} ${h}`);
    lines.push('endloop', 'endfacet');

    // Bottom cap triangle
    lines.push('facet normal 0 0 -1', 'outer loop');
    lines.push(`vertex 0 0 0`, `vertex ${x2} ${y2} 0`, `vertex ${x1} ${y1} 0`);
    lines.push('endloop', 'endfacet');
  }

  lines.push('endsolid axisforge_hex_stand');
  const encoder = new TextEncoder();
  return encoder.encode(lines.join('\n')).buffer;
}

export default function AdminCatalogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectCatalogModel, fetchCatalogModels } = useForgeStore();

  const [models, setModels] = useState<CatalogModelDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Form & Live 3D Mesh State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Eksempelmodell');
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<CatalogFileFormat>('stl');
  const [rawFileBlob, setRawFileBlob] = useState<File | null>(null);
  const [stlBase64, setStlBase64] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewGeometry, setPreviewGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [triangleCount, setTriangleCount] = useState<number | null>(null);
  const [overhangRatio, setOverhangRatio] = useState<number>(0.18);
  const [proceduralPreset, setProceduralPreset] = useState<ProceduralPreset>('MECH_TURRET');
  const [parametricTemplateId, setParametricTemplateId] = useState<ParametricTemplateId | null>(
    null
  );
  const [parametricParams, setParametricParams] = useState<Record<string, number> | null>(null);
  const [scadSource, setScadSource] = useState<string | null>(null);
  const [scadParameters, setScadParameters] = useState<ScadParameterDef[] | null>(null);
  const [dimX, setDimX] = useState(85);
  const [dimY, setDimY] = useState(85);
  const [dimZ, setDimZ] = useState(110);
  const [volumeCm3, setVolumeCm3] = useState(160);
  const [defaultMaterial, setDefaultMaterial] = useState<FilamentMaterialCode>('PLA_MATTE');
  const [defaultColorHex, setDefaultColorHex] = useState('#FF5500');

  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [adminAiPrompt, setAdminAiPrompt] = useState(
    'Forsterket vinkelbrakett 90x70x45 mm med avstivningsribber og M5 skruehull'
  );
  const [adminModelTier, setAdminModelTier] = useState<'flash' | 'pro'>('flash');
  const [isCompilingScad, setIsCompilingScad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalog');
      const data = (await res.json()) as { models?: CatalogModelDocument[] };
      if (data.models) {
        setModels(data.models);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const applyParsedBuffer = (
    buffer: ArrayBuffer,
    format: CatalogFileFormat,
    selectedName: string,
    fileObj: File
  ) => {
    const analysis = parseCadModelBuffer(buffer, format === '3mf' ? '3mf' : 'stl');
    setRawFileBlob(fileObj);
    setFileName(selectedName);
    setFileFormat(format);
    setParametricTemplateId(null);
    setParametricParams(null);
    setScadSource(null);
    setScadParameters(null);
    setPreviewUrl(null);
    setPreviewGeometry(analysis.normalizedGeometry);
    setTriangleCount(analysis.triangleCount);
    setOverhangRatio(analysis.overhangRatio);
    setDimX(analysis.boundingBoxMm.x);
    setDimY(analysis.boundingBoxMm.y);
    setDimZ(analysis.boundingBoxMm.z);
    setVolumeCm3(analysis.volumeCm3);

    // Keep base64 inline for files <= 2.5 MB as an instant memory cache; all files are also saved via /api/catalog/upload
    if (buffer.byteLength <= 2.5 * 1024 * 1024) {
      setStlBase64(arrayBufferToBase64(buffer));
    } else {
      setStlBase64(null);
    }

    setParseStatus(
      `${format.toUpperCase()}-analyse fullført: ${analysis.triangleCount.toLocaleString('nb-NO')} triangler • ${analysis.boundingBoxMm.x} × ${analysis.boundingBoxMm.y} × ${analysis.boundingBoxMm.z} mm • ${analysis.volumeCm3} cm³`
    );
  };

  const applyScadSourceAndCompile = async (
    sourceText: string,
    selectedName: string,
    _fileObj: File | null
  ) => {
    setErrorMsg(null);
    setIsCompilingScad(true);
    const extractedParams = parseScadParameters(sourceText);

    setFileName(selectedName);
    setFileFormat('scad');
    setParametricTemplateId(null);
    setParametricParams(null);
    setScadSource(sourceText);
    setScadParameters(extractedParams);
    setPreviewUrl(null);

    setParseStatus(
      `Kompilerer ${selectedName} (${extractedParams.length} parametre funnet) med OpenSCAD CLI...`
    );

    try {
      const res = await fetch('/api/parametric/scad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scadSource: sourceText,
          parameters: {},
          fastPreview: true,
        }),
      });

      const data = (await res.json()) as {
        stlBase64?: string;
        message?: string;
      };

      if (!res.ok || !data.stlBase64) {
        throw new Error(data.message || 'OpenSCAD kunne ikke kompilere .scad-filen');
      }

      const buffer = base64ToArrayBuffer(data.stlBase64);
      const analysis = parseCadModelBuffer(buffer, 'stl');

      // Store the compiled binary .stl file in rawFileBlob so /api/catalog/upload stores a ready-to-render .stl mesh
      const compiledStlName = `${selectedName.replace(/\.scad$/i, '')}_compiled.stl`;
      const compiledStlFile = new File([buffer], compiledStlName, {
        type: 'model/stl',
      });

      setRawFileBlob(compiledStlFile);
      setPreviewGeometry(analysis.normalizedGeometry);
      setTriangleCount(analysis.triangleCount);
      setOverhangRatio(analysis.overhangRatio);
      setDimX(analysis.boundingBoxMm.x);
      setDimY(analysis.boundingBoxMm.y);
      setDimZ(analysis.boundingBoxMm.z);
      setVolumeCm3(analysis.volumeCm3);
      if (buffer.byteLength <= 2.5 * 1024 * 1024) {
        setStlBase64(data.stlBase64);
      } else {
        setStlBase64(null);
      }

      setParseStatus(
        `OpenSCAD (.SCAD) kompilert: ${extractedParams.length} redigerbare parametre • ${analysis.triangleCount.toLocaleString('nb-NO')} triangler • ${analysis.boundingBoxMm.x} × ${analysis.boundingBoxMm.y} × ${analysis.boundingBoxMm.z} mm`
      );
    } finally {
      setIsCompilingScad(false);
    }
  };

  const handleLoadSampleParametric = (tplId: ParametricTemplateId = 'ORGANIZER_BOX') => {
    setErrorMsg(null);
    const spec = PARAMETRIC_TEMPLATES[tplId];
    const defaults = getDefaultParametricValues(tplId);
    const built = buildParametricModel(tplId, defaults);

    setRawFileBlob(null);
    setStlBase64(null);
    setPreviewUrl(null);
    setScadSource(null);
    setScadParameters(null);
    setPreviewGeometry(built.normalizedGeometry);
    setTriangleCount(built.triangleCount);
    setOverhangRatio(built.overhangRatio);
    setParametricTemplateId(tplId);
    setParametricParams(defaults);
    setFileName(`parametric_${tplId.toLowerCase()}.stl`);
    setFileFormat('stl');
    setTitle(spec.title);
    setDescription(spec.description);
    setCategory(spec.category);
    setDimX(built.boundingBoxMm.x);
    setDimY(built.boundingBoxMm.y);
    setDimZ(built.boundingBoxMm.z);
    setVolumeCm3(built.volumeCm3);
    setDefaultMaterial(spec.recommendedMaterial);
    setDefaultColorHex(spec.recommendedColorHex);
    setParseStatus(
      `Parametrisk mal (${spec.shortTitle}) lastet: ${built.summarySpec} • ${built.volumeCm3} cm³`
    );
  };

  const handleLoadSampleScad = async () => {
    setErrorMsg(null);
    setTitle('OpenSCAD Parametrisk Flensfeste (.SCAD)');
    setDescription(
      'Ekte parametrisk OpenSCAD-fil (.scad). Kunden kan justere ytterdiameter, rørhull, kragehøyde og skruehull i 3D.'
    );
    setCategory('Parametrisk .SCAD');
    try {
      await applyScadSourceAndCompile(
        SAMPLE_OPENSCAD_FILE_CONTENT,
        'parametric_flange_mount.scad',
        null
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Feil ved kompilering av .scad-fil');
    }
  };

  const handleAiGenerateScadInAdmin = async () => {
    if (adminAiPrompt.trim().length < 3) return;
    setErrorMsg(null);
    setIsCompilingScad(true);
    setParseStatus('AI skriver parametrisk OpenSCAD-kode og kompilerer 3D-mesh...');

    try {
      const res = await fetch('/api/parametric/scad/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: adminAiPrompt.trim(),
          modelTier: adminModelTier,
        }),
      });

      const data = (await res.json()) as {
        title?: string;
        fileName?: string;
        description?: string;
        category?: string;
        scadSource?: string;
        message?: string;
      };

      if (!res.ok || !data.scadSource) {
        throw new Error(data.message || 'Kunne ikke AI-generere .scad-modell');
      }

      setTitle(data.title || 'AI Parametrisk .SCAD-modell');
      setDescription(data.description || `AI-generert parametrisk modell: ${adminAiPrompt}`);
      setCategory(data.category || 'Parametrisk .SCAD');

      await applyScadSourceAndCompile(
        data.scadSource,
        data.fileName || 'ai_parametric_model.scad',
        null
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Feil ved AI-generering av .scad');
      setIsCompilingScad(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setErrorMsg(null);
    const lower = file.name.toLowerCase();
    const ext: CatalogFileFormat = lower.endsWith('.scad')
      ? 'scad'
      : lower.endsWith('.3mf')
        ? '3mf'
        : 'stl';

    const cleanTitle = file.name
      .replace(/\.(stl|3mf|scad)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setTitle(cleanTitle);
    setDescription(
      ext === 'scad'
        ? `Parametrisk OpenSCAD-fil (${file.name}) der kunden kan justere mål og hull direkte i nettleseren.`
        : `Ferdig 3D-modell (${file.name}) klar for bestilling og print på Bambu Lab X1C.`
    );

    try {
      if (ext === 'scad') {
        const scadText = await file.text();
        setCategory('Parametrisk .SCAD');
        await applyScadSourceAndCompile(scadText, file.name, file);
      } else {
        const buffer = await file.arrayBuffer();
        applyParsedBuffer(buffer, ext, file.name, file);
      }
    } catch (err) {
      setFileName(file.name);
      setFileFormat(ext);
      setRawFileBlob(file);
      setPreviewGeometry(null);
      setTriangleCount(null);
      const reason = err instanceof Error ? err.message : 'Ukjent struktur';
      setErrorMsg(`Kunne ikke lese 3D-geometri fra ${file.name} (${reason}).`);
    }
  };

  const handleLoadGeneratedSampleStl = () => {
    setErrorMsg(null);
    const buffer = generateSampleAsciiStl(90);
    const sampleFile = new File([buffer], 'nordic_hex_organizer.stl', {
      type: 'model/stl',
    });
    setTitle('Nordisk Sekskantet Skrivebords-holder');
    setDescription(
      'Minimalistisk sekskantet holder for verktøy og penner. Generert som ekte STL-mesh.'
    );
    setCategory('Design & Kontor');
    applyParsedBuffer(buffer, 'stl', sampleFile.name, sampleFile);
  };

  const handleLoadGeneratedSample3mf = () => {
    setErrorMsg(null);
    const buffer = generateSample3mfArchive(42, 95);
    const sampleFile = new File([buffer], 'nordic_fluted_cup.3mf', {
      type: 'model/3mf',
    });
    setTitle('Nordisk Riflet Oppbevaringskopp (.3MF)');
    setDescription(
      'Arkitektonisk riflet sylinderkopp for skrivebord eller verksted. Lagret som ekte .3MF-arkiv.'
    );
    setCategory('Design & Interiør');
    applyParsedBuffer(buffer, '3mf', sampleFile.name, sampleFile);
  };

  const handlePreviewExistingCatalogItem = (item: CatalogModelDocument) => {
    setErrorMsg(null);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setFileName(item.fileName);
    setFileFormat(item.fileFormat);
    setProceduralPreset(item.proceduralPreset);
    setParametricTemplateId(item.parametricTemplateId ?? null);
    setParametricParams(item.parametricParams ?? null);
    setScadSource(item.scadSource ?? null);
    setScadParameters(item.scadParameters ?? null);
    setDimX(item.boundingBoxMm.x);
    setDimY(item.boundingBoxMm.y);
    setDimZ(item.boundingBoxMm.z);
    setVolumeCm3(item.volumeCm3);
    setDefaultMaterial(item.defaultMaterial);
    setDefaultColorHex(item.defaultColorHex);
    setPreviewGeometry(null);
    setTriangleCount(null);
    setPreviewUrl(item.modelFileUrl ?? null);
    setStlBase64(item.stlBase64 ?? null);
    if (item.scadSource) {
      void applyScadSourceAndCompile(item.scadSource, item.fileName, null);
    } else {
      setParseStatus(`Viser «${item.title}» (${item.fileName}) i 3D-forhåndsvisningen.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      let uploadedFileUrl: string | null = previewUrl;

      // Upload the binary .stl / .3mf / .scad file to /api/catalog/upload so files of any size work in 3D
      if (rawFileBlob) {
        const uploadForm = new FormData();
        uploadForm.append('file', rawFileBlob);
        const uploadRes = await fetch('/api/catalog/upload', {
          method: 'POST',
          body: uploadForm,
        });
        const uploadData = (await uploadRes.json()) as {
          modelFileUrl?: string;
          message?: string;
        };
        if (!uploadRes.ok || !uploadData.modelFileUrl) {
          throw new Error(uploadData.message || 'Kunne ikke laste opp 3D-filen til serveren');
        }
        uploadedFileUrl = uploadData.modelFileUrl;
      }

      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          fileName: fileName || `${title.toLowerCase().replace(/\s+/g, '_')}.${fileFormat}`,
          fileFormat,
          modelFileUrl: uploadedFileUrl,
          stlBase64,
          proceduralPreset,
          parametricTemplateId,
          parametricParams,
          scadSource,
          scadParameters,
          boundingBoxMm: { x: dimX, y: dimY, z: dimZ },
          volumeCm3,
          overhangRatio,
          defaultMaterial,
          defaultColorHex,
        }),
      });

      const data = (await res.json()) as {
        model?: CatalogModelDocument;
        message?: string;
      };

      if (!res.ok || !data.model) {
        throw new Error(data.message || 'Kunne ikke lagre modellen i katalogen');
      }

      setRawFileBlob(null);
      setPreviewUrl(data.model.modelFileUrl ?? null);
      setParseStatus(`Modellen «${data.model.title}» er publisert med full 3D-visning!`);
      await loadModels();
      await fetchCatalogModels();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Feil ved lagring');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/catalog?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadModels();
    await fetchCatalogModels();
  };

  const handleOpenInConfigurator = async (model: CatalogModelDocument) => {
    await selectCatalogModel(model, user?.uid || 'dev-operator-01');
    router.push('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white px-6 py-5 shadow-nordic">
        <div>
          <span className="rounded-full bg-[#FF4F00]/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#FF4F00]">
            Admin • Katalog & Eksempelfiler (.STL + .3MF + .SCAD)
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-900">
            Last opp STL-, 3MF- og parametriske .SCAD-modeller
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Alle <code className="font-mono">.stl</code>, <code className="font-mono">.3mf</code> og
            parametriske <code className="font-mono">.scad</code>-filer (OpenSCAD) analyseres og
            vises i 3D både her og på forsiden.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#141413] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#FF4F00]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Tilbake til konfigurator</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left 5 Cols: Upload STL / 3MF / SCAD Form */}
        <section
          aria-labelledby="upload-stl-heading"
          className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-nordic lg:col-span-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-4">
            <h2
              id="upload-stl-heading"
              className="font-display text-base font-bold tracking-tight text-zinc-900"
            >
              Last opp .STL, .3MF eller .SCAD
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleLoadGeneratedSampleStl}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200/70"
              >
                <Wand2 className="h-3 w-3 text-[#FF4F00]" />
                <span>Test .STL</span>
              </button>
              <button
                type="button"
                onClick={handleLoadGeneratedSample3mf}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200/70"
              >
                <Wand2 className="h-3 w-3 text-emerald-600" />
                <span>Test .3MF</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadSampleScad()}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200/70"
              >
                <Wand2 className="h-3 w-3 text-[#FF4F00]" />
                <span>Test .SCAD</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadSampleParametric('ORGANIZER_BOX')}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200/70"
              >
                <Wand2 className="h-3 w-3 text-zinc-900" />
                <span>Test Mal</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} method="POST" className="space-y-4">
            {/* AI OpenSCAD Generator for Admin */}
            <div className="rounded-xl border border-zinc-200/90 bg-[#F6F6F3]/80 p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="admin-scad-ai-input"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900"
                >
                  <Wand2 className="h-3.5 w-3.5 text-[#FF4F00]" />
                  <span>Generer parametrisk .SCAD-modell med AI</span>
                </label>

                <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setAdminModelTier('flash')}
                    className={`rounded-md px-2 py-0.5 transition-colors ${
                      adminModelTier === 'flash'
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    3.8 Flash (Rask)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminModelTier('pro')}
                    className={`rounded-md px-2 py-0.5 transition-colors ${
                      adminModelTier === 'pro'
                        ? 'bg-[#FF4F00] text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    3.1 Pro (Avansert)
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  id="admin-scad-ai-input"
                  name="adminAiPrompt"
                  type="text"
                  value={adminAiPrompt}
                  onChange={(e) => setAdminAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAiGenerateScadInAdmin();
                    }
                  }}
                  placeholder="F.eks. Tannhjul med 24 tenner, 12mm tykkelse og 8mm akselhull..."
                  className="min-h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900"
                />
                <button
                  type="button"
                  disabled={isCompilingScad}
                  onClick={() => void handleAiGenerateScadInAdmin()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF4F00] disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>{isCompilingScad ? 'Genererer...' : 'Generer .SCAD'}</span>
                </button>
              </div>
            </div>

            {/* File Dropzone */}
            <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-[#F6F6F3]/60 p-5 text-center transition-colors hover:border-[#FF4F00]">
              <label htmlFor="admin-stl-file" className="cursor-pointer">
                <Upload className="mx-auto h-7 w-7 text-[#FF4F00]" />
                <span className="mt-2 block text-xs font-bold text-zinc-900">
                  {fileName
                    ? `Valgt 3D-fil: ${fileName}`
                    : 'Velg .STL, .3MF eller parametrisk .SCAD-fil fra PC-en din'}
                </span>
                <span className="mt-1 block text-[11px] text-zinc-500">
                  .SCAD-filer kompileres med OpenSCAD og gir kunden egne parameter-slidere i 3D
                </span>
                <span className="mt-3 inline-block rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white">
                  Velg 3D-fil (.stl / .3mf / .scad)
                </span>
              </label>
              <input
                id="admin-stl-file"
                name="stlFile"
                type="file"
                accept=".stl,.3mf,.scad"
                onChange={(e) => void handleFileUpload(e)}
                className="sr-only"
              />
            </div>

            {parseStatus && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{parseStatus}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="catalog-title"
                className="mb-1.5 block text-xs font-semibold text-zinc-800"
              >
                Visningsnavn i butikken
              </label>
              <input
                id="catalog-title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="catalog-category"
                  className="mb-1.5 block text-xs font-semibold text-zinc-800"
                >
                  Kategori
                </label>
                <input
                  id="catalog-category"
                  name="category"
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="catalog-preset"
                  className="mb-1.5 block text-xs font-semibold text-zinc-800"
                >
                  Fallback-form (kun hvis uten fil)
                </label>
                <select
                  id="catalog-preset"
                  name="proceduralPreset"
                  value={proceduralPreset}
                  onChange={(e) => setProceduralPreset(e.target.value as ProceduralPreset)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3 py-2 text-xs font-medium text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                >
                  <option value="MECH_TURRET">Mekanisk Tårn</option>
                  <option value="PLANETARY_GEAR">Planetgir / Tannhjul</option>
                  <option value="CYBER_HELMET">Hjelm / Byste</option>
                  <option value="INDUSTRIAL_BRACKET">Brakett / Feste</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="catalog-desc"
                className="mb-1.5 block text-xs font-semibold text-zinc-800"
              >
                Kort beskrivelse til kunden
              </label>
              <textarea
                id="catalog-desc"
                name="description"
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 p-3 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Dimensions & Volume */}
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label
                  htmlFor="dim-x"
                  className="mb-1 block font-mono text-[11px] font-semibold text-zinc-600"
                >
                  Bredde X (mm)
                </label>
                <input
                  id="dim-x"
                  type="number"
                  min={2}
                  max={256}
                  required
                  value={dimX}
                  onChange={(e) => setDimX(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 bg-[#F6F6F3]/60 px-2.5 py-2 font-mono text-xs text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="dim-y"
                  className="mb-1 block font-mono text-[11px] font-semibold text-zinc-600"
                >
                  Dybde Y (mm)
                </label>
                <input
                  id="dim-y"
                  type="number"
                  min={2}
                  max={256}
                  required
                  value={dimY}
                  onChange={(e) => setDimY(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 bg-[#F6F6F3]/60 px-2.5 py-2 font-mono text-xs text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="dim-z"
                  className="mb-1 block font-mono text-[11px] font-semibold text-zinc-600"
                >
                  Høyde Z (mm)
                </label>
                <input
                  id="dim-z"
                  type="number"
                  min={2}
                  max={256}
                  required
                  value={dimZ}
                  onChange={(e) => setDimZ(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 bg-[#F6F6F3]/60 px-2.5 py-2 font-mono text-xs text-zinc-900"
                />
              </div>
              <div>
                <label
                  htmlFor="vol-cm3"
                  className="mb-1 block font-mono text-[11px] font-semibold text-zinc-600"
                >
                  Volum (cm³)
                </label>
                <input
                  id="vol-cm3"
                  type="number"
                  step="0.1"
                  min={1}
                  required
                  value={volumeCm3}
                  onChange={(e) => setVolumeCm3(Number(e.target.value))}
                  className="w-full rounded-lg border border-zinc-200 bg-[#F6F6F3]/60 px-2.5 py-2 font-mono text-xs text-zinc-900"
                />
              </div>
            </div>

            {/* Default Material */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="default-mat"
                  className="mb-1.5 block text-xs font-semibold text-zinc-800"
                >
                  Anbefalt plasttype
                </label>
                <select
                  id="default-mat"
                  value={defaultMaterial}
                  onChange={(e) => {
                    const nextMat = e.target.value as FilamentMaterialCode;
                    setDefaultMaterial(nextMat);
                    setDefaultColorHex(MATERIALS[nextMat].colors[0] ?? '#111111');
                  }}
                  className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3 py-2 text-xs font-medium text-zinc-900"
                >
                  {(Object.keys(MATERIALS) as FilamentMaterialCode[]).map((code) => (
                    <option key={code} value={code}>
                      {MATERIALS[code].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="default-color"
                  className="mb-1.5 block text-xs font-semibold text-zinc-800"
                >
                  Standardfarge
                </label>
                <select
                  id="default-color"
                  value={defaultColorHex}
                  onChange={(e) => setDefaultColorHex(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3 py-2 text-xs font-medium text-zinc-900"
                >
                  {MATERIALS[defaultMaterial].colors.map((hex) => (
                    <option key={hex} value={hex}>
                      {MATERIALS[defaultMaterial].colorNames[hex] || hex}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving || isCompilingScad}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-3.5 text-xs font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>
                {isCompilingScad
                  ? 'Kompilerer .SCAD med OpenSCAD...'
                  : isSaving
                    ? 'Laster opp og lagrer...'
                    : 'Publiser modell til butikken'}
              </span>
            </button>
          </form>
        </section>

        {/* Right 7 Cols: Live 3D Build Plate Preview + Active Catalog Models List */}
        <div className="space-y-6 lg:col-span-7">
          {/* Live Interactive 3D Preview of the Uploaded STL / 3MF / SCAD File */}
          <AdminModelPreview3D
            title={title || fileName || 'Forhåndsvisning'}
            fileFormat={fileFormat}
            directGeometry={previewGeometry}
            parametricTemplateId={parametricTemplateId}
            parametricParams={parametricParams}
            scadSource={scadSource}
            isCompilingScad={isCompilingScad}
            modelFileUrl={previewUrl}
            stlBase64={stlBase64}
            preset={proceduralPreset}
            dimensionsMm={{ x: dimX, y: dimY, z: dimZ }}
            materialCode={defaultMaterial}
            colorHex={defaultColorHex}
            triangleCount={triangleCount}
          />

          <section
            aria-labelledby="catalog-list-heading"
            className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-nordic"
          >
            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h2
                  id="catalog-list-heading"
                  className="font-display text-base font-bold tracking-tight text-zinc-900"
                >
                  Aktive eksempelmodeller i katalogen ({models.length})
                </h2>
                <p className="text-xs text-zinc-500">
                  Klikk «Åpne i 3D-konfigurator» for å åpne modellen i hovedvisningen på forsiden.
                </p>
              </div>
              <FileBox className="h-5 w-5 text-zinc-400" />
            </div>

            {loading ? (
              <div className="p-8 text-center font-mono text-xs text-zinc-500">
                Laster katalog...
              </div>
            ) : (
              <div className="space-y-3">
                {models.map((item) => {
                  const hasRealMesh = Boolean(item.modelFileUrl || item.stlBase64);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200/90 bg-[#F6F6F3]/50 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                            .{item.fileFormat}
                          </span>
                          <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-nordic-sm">
                            {item.category}
                          </span>
                          {hasRealMesh && (
                            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                              Ekte .{item.fileFormat.toUpperCase()} 3D-mesh
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 font-display text-sm font-bold text-zinc-900">
                          {item.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Box className="h-3 w-3 text-zinc-400" />
                            {item.boundingBoxMm.x} × {item.boundingBoxMm.y} × {item.boundingBoxMm.z}{' '}
                            mm
                          </span>
                          <span>•</span>
                          <span>Volum: {item.volumeCm3} cm³</span>
                          <span>•</span>
                          <span>{item.fileName}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewExistingCatalogItem(item)}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Vis 3D her</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenInConfigurator(item)}
                          className="rounded-xl bg-[#141413] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF4F00]"
                        >
                          Åpne i 3D-konfigurator
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          aria-label={`Slett ${item.title}`}
                          className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

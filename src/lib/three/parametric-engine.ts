import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DimensionsMm, FilamentMaterialCode } from '@/lib/schemas/forge';

export type ParametricTemplateId = 'ORGANIZER_BOX' | 'L_BRACKET' | 'DESK_CLAMP' | 'PIPE_MOUNT';

export interface ParametricParameterDef {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  quickPresets?: { label: string; value: number }[];
}

export interface ParametricTemplateSpec {
  id: ParametricTemplateId;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  recommendedMaterial: FilamentMaterialCode;
  recommendedColorHex: string;
  parameters: ParametricParameterDef[];
}

export interface GeneratedParametricModel {
  templateId: ParametricTemplateId;
  /** Normalized 1x1x1 geometry resting on Y=0, centered on X=0, Z=0 */
  normalizedGeometry: THREE.BufferGeometry;
  /** Real millimeter geometry before 1x1x1 normalization (used for STL export) */
  rawMillimeterGeometry: THREE.BufferGeometry;
  boundingBoxMm: DimensionsMm;
  volumeCm3: number;
  overhangRatio: number;
  triangleCount: number;
  summarySpec: string;
}

export const PARAMETRIC_TEMPLATES: Record<ParametricTemplateId, ParametricTemplateSpec> = {
  ORGANIZER_BOX: {
    id: 'ORGANIZER_BOX',
    title: 'Parametrisk Oppbevaringsboks / Skuffe-innsats',
    shortTitle: 'Oppbevaringsboks',
    category: 'Organisering & Kontor',
    description:
      'Skreddersydd boks med valgfrie skillevegger. Tilpass nøyaktig bredde, dybde, høyde og antall rom til skuffen eller arbeidsbenken din.',
    recommendedMaterial: 'PLA_MATTE',
    recommendedColorHex: '#F4F0EA',
    parameters: [
      {
        key: 'widthMm',
        label: 'Ytre bredde (X)',
        unit: 'mm',
        min: 40,
        max: 240,
        step: 5,
        defaultValue: 150,
      },
      {
        key: 'depthMm',
        label: 'Ytre dybde (Y)',
        unit: 'mm',
        min: 40,
        max: 240,
        step: 5,
        defaultValue: 110,
      },
      {
        key: 'heightMm',
        label: 'Ytre høyde (Z)',
        unit: 'mm',
        min: 20,
        max: 140,
        step: 5,
        defaultValue: 45,
      },
      {
        key: 'wallMm',
        label: 'Veggtykkelse',
        unit: 'mm',
        min: 1.6,
        max: 4.8,
        step: 0.4,
        defaultValue: 2.4,
        quickPresets: [
          { label: 'Lett (1.6 mm)', value: 1.6 },
          { label: 'Standard (2.4 mm)', value: 2.4 },
          { label: 'Kraftig (3.6 mm)', value: 3.6 },
        ],
      },
      {
        key: 'compartmentsX',
        label: 'Antall rom i bredden',
        unit: 'rom',
        min: 1,
        max: 5,
        step: 1,
        defaultValue: 3,
      },
      {
        key: 'compartmentsY',
        label: 'Antall rom i dybden',
        unit: 'rom',
        min: 1,
        max: 4,
        step: 1,
        defaultValue: 2,
      },
    ],
  },

  L_BRACKET: {
    id: 'L_BRACKET',
    title: 'Parametrisk Vinkelbrakett / Hylleknekt',
    shortTitle: 'Vinkelbrakett',
    category: 'Beslag & Verksted',
    description:
      'Forsterket 90° vinkelbrakett der skruehull-diameter (M3–M8) og godstykkelse holdes eksakt uansett lengde på armene.',
    recommendedMaterial: 'PETG_INDUSTRIAL',
    recommendedColorHex: '#111111',
    parameters: [
      {
        key: 'armLengthMm',
        label: 'Horisontal arm (X)',
        unit: 'mm',
        min: 35,
        max: 200,
        step: 5,
        defaultValue: 90,
      },
      {
        key: 'armHeightMm',
        label: 'Vertikal arm (Z)',
        unit: 'mm',
        min: 35,
        max: 200,
        step: 5,
        defaultValue: 90,
      },
      {
        key: 'widthMm',
        label: 'Brakett-bredde (Y)',
        unit: 'mm',
        min: 20,
        max: 120,
        step: 5,
        defaultValue: 45,
      },
      {
        key: 'thicknessMm',
        label: 'Godstykkelse',
        unit: 'mm',
        min: 3,
        max: 12,
        step: 1,
        defaultValue: 6,
      },
      {
        key: 'holeDiaMm',
        label: 'Skruehull-diameter',
        unit: 'mm',
        min: 3,
        max: 9,
        step: 0.5,
        defaultValue: 5.5,
        quickPresets: [
          { label: 'M3 (3.5 mm)', value: 3.5 },
          { label: 'M4 (4.5 mm)', value: 4.5 },
          { label: 'M5 (5.5 mm)', value: 5.5 },
          { label: 'M6 (6.5 mm)', value: 6.5 },
          { label: 'M8 (8.5 mm)', value: 8.5 },
        ],
      },
      {
        key: 'gussetCount',
        label: 'Avstivningsribber',
        unit: 'stk',
        min: 0,
        max: 2,
        step: 1,
        defaultValue: 2,
      },
    ],
  },

  DESK_CLAMP: {
    id: 'DESK_CLAMP',
    title: 'Parametrisk Bordklemme & Kabelholder',
    shortTitle: 'Bordklemme',
    category: 'Skrivebord & Kabel',
    description:
      'Tilpass kjeft-åpningen på millimeteren etter tykkelsen på skrivebordet ditt, med integrerte kabelspor i front.',
    recommendedMaterial: 'PETG_INDUSTRIAL',
    recommendedColorHex: '#FF5500',
    parameters: [
      {
        key: 'jawGapMm',
        label: 'Bordplatens tykkelse (Åpning)',
        unit: 'mm',
        min: 10,
        max: 70,
        step: 1,
        defaultValue: 28,
        quickPresets: [
          { label: 'Tynn plate (16 mm)', value: 16 },
          { label: 'Standard (22 mm)', value: 22 },
          { label: 'IKEA-bord (28 mm)', value: 28 },
          { label: 'Benkeplate (40 mm)', value: 40 },
        ],
      },
      {
        key: 'throatDepthMm',
        label: 'Innstikk-dybde på bord',
        unit: 'mm',
        min: 25,
        max: 90,
        step: 5,
        defaultValue: 45,
      },
      {
        key: 'widthMm',
        label: 'Bredde på klemme',
        unit: 'mm',
        min: 20,
        max: 90,
        step: 5,
        defaultValue: 40,
      },
      {
        key: 'wallMm',
        label: 'Godstykkelse',
        unit: 'mm',
        min: 4,
        max: 12,
        step: 1,
        defaultValue: 7,
      },
      {
        key: 'cableSlots',
        label: 'Antall kabelspor i front',
        unit: 'spor',
        min: 0,
        max: 5,
        step: 1,
        defaultValue: 3,
      },
    ],
  },

  PIPE_MOUNT: {
    id: 'PIPE_MOUNT',
    title: 'Parametrisk Rør- og Stangfeste (Flens)',
    shortTitle: 'Rør-/Stangfeste',
    category: 'Reservedel & Feste',
    description:
      'Sylinderhylse på monteringsflens for rør, garderobestang, mikrofonarm eller sensor. Eksakt indre diameter i millimeter.',
    recommendedMaterial: 'PAHT_CF',
    recommendedColorHex: '#111111',
    parameters: [
      {
        key: 'innerDiaMm',
        label: 'Indre rørdiameter (Ø)',
        unit: 'mm',
        min: 10,
        max: 100,
        step: 1,
        defaultValue: 32,
        quickPresets: [
          { label: 'Ø 16 mm', value: 16 },
          { label: 'Ø 25 mm', value: 25 },
          { label: 'Ø 32 mm', value: 32 },
          { label: 'Ø 50 mm', value: 50 },
        ],
      },
      {
        key: 'sleeveHeightMm',
        label: 'Total høyde (Z)',
        unit: 'mm',
        min: 20,
        max: 140,
        step: 5,
        defaultValue: 55,
      },
      {
        key: 'wallMm',
        label: 'Veggtykkelse hylse',
        unit: 'mm',
        min: 3,
        max: 10,
        step: 0.5,
        defaultValue: 5,
      },
      {
        key: 'flangeSizeMm',
        label: 'Fotplate bredde',
        unit: 'mm',
        min: 50,
        max: 180,
        step: 5,
        defaultValue: 95,
      },
      {
        key: 'boltDiaMm',
        label: 'Skruehull i fotplate',
        unit: 'mm',
        min: 3,
        max: 9,
        step: 0.5,
        defaultValue: 5.5,
      },
    ],
  },
};

export function getDefaultParametricValues(
  templateId: ParametricTemplateId
): Record<string, number> {
  const spec = PARAMETRIC_TEMPLATES[templateId];
  const out: Record<string, number> = {};
  for (const p of spec.parameters) {
    out[p.key] = p.defaultValue;
  }
  return out;
}

function createBoxPart(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  centerX: number,
  centerY: number,
  centerZ: number
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
  g.translate(centerX, centerY, centerZ);
  return g.index ? g.toNonIndexed() : g;
}

function createExtrudedShapePart(
  shape: THREE.Shape,
  depth: number,
  rotateXRad = 0,
  rotateYRad = 0,
  translateX = 0,
  translateY = 0,
  translateZ = 0
): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 28,
  });
  if (rotateXRad !== 0) g.rotateX(rotateXRad);
  if (rotateYRad !== 0) g.rotateY(rotateYRad);
  g.translate(translateX, translateY, translateZ);
  return g.index ? g.toNonIndexed() : g;
}

/**
 * Builds a real Three.js Y-up millimeter BufferGeometry + exact solid volume (cm3)
 * for any of the 4 parametric templates.
 */
export function buildParametricModel(
  templateId: ParametricTemplateId,
  rawParams: Record<string, number>
): GeneratedParametricModel {
  const defaults = getDefaultParametricValues(templateId);
  const p = { ...defaults, ...rawParams };

  const parts: THREE.BufferGeometry[] = [];
  let solidVolumeMm3 = 0;
  let overhangRatio = 0.08;
  let summarySpec = '';

  if (templateId === 'ORGANIZER_BOX') {
    const width = Math.min(240, Math.max(40, p.widthMm ?? 150));
    const depth = Math.min(240, Math.max(40, p.depthMm ?? 110));
    const height = Math.min(140, Math.max(20, p.heightMm ?? 45));
    const wall = Math.min(5, Math.max(1.6, p.wallMm ?? 2.4));
    const compX = Math.min(5, Math.max(1, Math.round(p.compartmentsX ?? 3)));
    const compY = Math.min(4, Math.max(1, Math.round(p.compartmentsY ?? 2)));

    const innerW = Math.max(10, width - wall * 2);
    const innerD = Math.max(10, depth - wall * 2);
    const innerH = Math.max(5, height - wall);

    // Bottom plate
    parts.push(createBoxPart(width, wall, depth, 0, wall / 2, 0));
    // Front & Back outer walls (along X)
    parts.push(createBoxPart(width, innerH, wall, 0, wall + innerH / 2, depth / 2 - wall / 2));
    parts.push(createBoxPart(width, innerH, wall, 0, wall + innerH / 2, -depth / 2 + wall / 2));
    // Left & Right outer walls (along Z)
    parts.push(createBoxPart(wall, innerH, innerD, -width / 2 + wall / 2, wall + innerH / 2, 0));
    parts.push(createBoxPart(wall, innerH, innerD, width / 2 - wall / 2, wall + innerH / 2, 0));

    // Internal X dividers
    for (let i = 1; i < compX; i++) {
      const xPos = -innerW / 2 + (innerW * i) / compX;
      parts.push(createBoxPart(wall, innerH, innerD, xPos, wall + innerH / 2, 0));
    }

    // Internal Y (Z-axis in Three.js) dividers
    for (let j = 1; j < compY; j++) {
      const zPos = -innerD / 2 + (innerD * j) / compY;
      parts.push(createBoxPart(innerW, innerH, wall, 0, wall + innerH / 2, zPos));
    }

    const outerVol = width * depth * height;
    const hollowVol = innerW * innerD * innerH;
    const dividersVol = (compX - 1) * wall * innerH * innerD + (compY - 1) * innerW * innerH * wall;
    solidVolumeMm3 = Math.max(2000, outerVol - hollowVol + dividersVol);
    overhangRatio = 0.04;
    summarySpec = `${width}×${depth}×${height} mm • ${compX}×${compY} rom • ${wall} mm vegg`;
  } else if (templateId === 'L_BRACKET') {
    const armX = Math.min(200, Math.max(35, p.armLengthMm ?? 90));
    const armZ = Math.min(200, Math.max(35, p.armHeightMm ?? 90));
    const widthY = Math.min(120, Math.max(20, p.widthMm ?? 45));
    const thick = Math.min(12, Math.max(3, p.thicknessMm ?? 6));
    const holeDia = Math.min(9, Math.max(3, p.holeDiaMm ?? 5.5));
    const gussets = Math.min(2, Math.max(0, Math.round(p.gussetCount ?? 2)));

    const holeRadius = holeDia / 2;

    // Horizontal base plate with 2 real circular bolt holes using ExtrudeGeometry
    const baseShape = new THREE.Shape();
    baseShape.moveTo(0, -widthY / 2);
    baseShape.lineTo(armX, -widthY / 2);
    baseShape.lineTo(armX, widthY / 2);
    baseShape.lineTo(0, widthY / 2);
    baseShape.closePath();

    const holeX1 = Math.max(thick + holeRadius + 5, armX * 0.45);
    const holeX2 = Math.max(holeX1 + holeDia + 4, armX * 0.78);
    if (holeX1 + holeRadius < armX - 3) {
      const h1 = new THREE.Path();
      h1.absarc(holeX1, 0, holeRadius, 0, Math.PI * 2, false);
      baseShape.holes.push(h1);
    }
    if (holeX2 + holeRadius < armX - 3) {
      const h2 = new THREE.Path();
      h2.absarc(holeX2, 0, holeRadius, 0, Math.PI * 2, false);
      baseShape.holes.push(h2);
    }

    // Extrude base plate along Y (height = thick)
    parts.push(createExtrudedShapePart(baseShape, thick, -Math.PI / 2, 0, -armX / 2, 0, 0));

    // Vertical backplate with 2 real circular bolt holes
    const backShape = new THREE.Shape();
    backShape.moveTo(-widthY / 2, thick);
    backShape.lineTo(widthY / 2, thick);
    backShape.lineTo(widthY / 2, armZ);
    backShape.lineTo(-widthY / 2, armZ);
    backShape.closePath();

    const holeZ1 = Math.max(thick + holeRadius + 6, armZ * 0.45);
    const holeZ2 = Math.max(holeZ1 + holeDia + 4, armZ * 0.78);
    if (holeZ1 + holeRadius < armZ - 3) {
      const v1 = new THREE.Path();
      v1.absarc(0, holeZ1, holeRadius, 0, Math.PI * 2, false);
      backShape.holes.push(v1);
    }
    if (holeZ2 + holeRadius < armZ - 3) {
      const v2 = new THREE.Path();
      v2.absarc(0, holeZ2, holeRadius, 0, Math.PI * 2, false);
      backShape.holes.push(v2);
    }

    const backGeom = new THREE.ExtrudeGeometry(backShape, {
      depth: thick,
      bevelEnabled: false,
      curveSegments: 24,
    });
    backGeom.rotateY(Math.PI / 2);
    backGeom.translate(-armX / 2, 0, 0);
    parts.push(backGeom.index ? backGeom.toNonIndexed() : backGeom);

    // Triangular Gusset Ribs
    const ribLenX = Math.max(12, (armX - thick) * 0.65);
    const ribLenZ = Math.max(12, (armZ - thick) * 0.65);
    const ribThick = Math.max(3, thick * 0.75);

    const makeGusset = (zOffset: number) => {
      const ribShape = new THREE.Shape();
      ribShape.moveTo(thick, thick);
      ribShape.lineTo(thick + ribLenX, thick);
      ribShape.lineTo(thick, thick + ribLenZ);
      ribShape.closePath();
      const rg = new THREE.ExtrudeGeometry(ribShape, {
        depth: ribThick,
        bevelEnabled: false,
      });
      rg.translate(-armX / 2, 0, zOffset - ribThick / 2);
      return rg.index ? rg.toNonIndexed() : rg;
    };

    if (gussets === 1) {
      parts.push(makeGusset(0));
    } else if (gussets >= 2) {
      const edgeZ = widthY / 2 - ribThick / 2;
      parts.push(makeGusset(-edgeZ));
      parts.push(makeGusset(edgeZ));
    }

    solidVolumeMm3 =
      armX * widthY * thick +
      (armZ - thick) * widthY * thick +
      gussets * (0.5 * ribLenX * ribLenZ * ribThick);
    overhangRatio = 0.12;
    summarySpec = `${armX}×${armZ}×${widthY} mm • ${thick} mm gods • Ø${holeDia} mm hull`;
  } else if (templateId === 'DESK_CLAMP') {
    const jawGap = Math.min(70, Math.max(10, p.jawGapMm ?? 28));
    const throat = Math.min(90, Math.max(25, p.throatDepthMm ?? 45));
    const width = Math.min(90, Math.max(20, p.widthMm ?? 40));
    const wall = Math.min(12, Math.max(4, p.wallMm ?? 7));
    const slots = Math.min(5, Math.max(0, Math.round(p.cableSlots ?? 3)));

    const totalHeight = jawGap + wall * 2;
    const totalX = throat + wall + (slots > 0 ? 14 : 0);

    // Bottom jaw
    parts.push(createBoxPart(throat + wall, wall, width, 0, wall / 2, 0));
    // Vertical C-spine
    parts.push(
      createBoxPart(wall, jawGap, width, -(throat + wall) / 2 + wall / 2, wall + jawGap / 2, 0)
    );
    // Top jaw
    parts.push(createBoxPart(throat + wall, wall, width, 0, wall + jawGap + wall / 2, 0));
    // Clamp screw collar boss under bottom jaw
    const bossG = new THREE.CylinderGeometry(wall * 1.1, wall * 1.1, wall * 0.9, 16);
    bossG.translate((throat + wall) * 0.18, wall * 0.45, 0);
    parts.push(bossG.index ? bossG.toNonIndexed() : bossG);

    // Front cable comb fingers if slots > 0
    if (slots > 0) {
      const spineFrontX = -(throat + wall) / 2 - 7;
      const combY = wall + jawGap + wall / 2;
      const fingerCount = slots + 1;
      const slotWidth = 6.5;
      const totalAvailZ = width;
      const fingerWidth = Math.max(3, (totalAvailZ - slots * slotWidth) / fingerCount);

      for (let i = 0; i < fingerCount; i++) {
        const zCenter = -width / 2 + fingerWidth / 2 + i * (fingerWidth + slotWidth);
        if (zCenter + fingerWidth / 2 <= width / 2 + 1) {
          parts.push(createBoxPart(14, wall, fingerWidth, spineFrontX, combY, zCenter));
        }
      }
    }

    solidVolumeMm3 =
      2 * (throat + wall) * wall * width +
      jawGap * wall * width +
      (slots > 0 ? 14 * wall * width * 0.65 : 0);
    overhangRatio = 0.24;
    summarySpec = `${jawGap} mm bordåpning • ${throat} mm dybde • ${slots} kabelspor (Mål: ${Math.round(totalX)}×${width}×${totalHeight} mm)`;
  } else {
    // PIPE_MOUNT
    const innerDia = Math.min(100, Math.max(10, p.innerDiaMm ?? 32));
    const height = Math.min(140, Math.max(20, p.sleeveHeightMm ?? 55));
    const wall = Math.min(10, Math.max(3, p.wallMm ?? 5));
    const innerR = innerDia / 2;
    const outerR = innerR + wall;
    const flange = Math.min(180, Math.max(outerR * 2 + 16, p.flangeSizeMm ?? 95));
    const boltDia = Math.min(9, Math.max(3, p.boltDiaMm ?? 5.5));
    const flangeThick = Math.max(5, wall * 1.15);

    // Base flange with central pipe bore + 4 corner bolt holes
    const flangeShape = new THREE.Shape();
    const halfF = flange / 2;
    flangeShape.moveTo(-halfF, -halfF);
    flangeShape.lineTo(halfF, -halfF);
    flangeShape.lineTo(halfF, halfF);
    flangeShape.lineTo(-halfF, halfF);
    flangeShape.closePath();

    const centerBore = new THREE.Path();
    centerBore.absarc(0, 0, innerR, 0, Math.PI * 2, false);
    flangeShape.holes.push(centerBore);

    const boltOffset = halfF - Math.max(boltDia + 4, 11);
    const corners: [number, number][] = [
      [-boltOffset, -boltOffset],
      [boltOffset, -boltOffset],
      [boltOffset, boltOffset],
      [-boltOffset, boltOffset],
    ];
    for (const [cx, cy] of corners) {
      if (Math.hypot(cx, cy) > outerR + boltDia / 2 + 2) {
        const bh = new THREE.Path();
        bh.absarc(cx, cy, boltDia / 2, 0, Math.PI * 2, false);
        flangeShape.holes.push(bh);
      }
    }

    parts.push(createExtrudedShapePart(flangeShape, flangeThick, -Math.PI / 2, 0, 0, 0, 0));

    // Hollow cylindrical pipe sleeve
    const sleeveShape = new THREE.Shape();
    sleeveShape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const sleeveHole = new THREE.Path();
    sleeveHole.absarc(0, 0, innerR, 0, Math.PI * 2, false);
    sleeveShape.holes.push(sleeveHole);

    const sleeveH = Math.max(8, height - flangeThick);
    parts.push(createExtrudedShapePart(sleeveShape, sleeveH, -Math.PI / 2, 0, 0, flangeThick, 0));

    solidVolumeMm3 =
      (flange * flange - Math.PI * innerR * innerR) * flangeThick +
      Math.PI * (outerR * outerR - innerR * innerR) * sleeveH;
    overhangRatio = 0.06;
    summarySpec = `Ø${innerDia} mm indre rør • ${flange}×${flange} mm flens • ${height} mm høyde`;
  }

  const merged =
    parts.length === 1
      ? parts[0]!
      : (BufferGeometryUtils.mergeGeometries(parts, false) ?? parts[0]!);

  merged.computeVertexNormals();
  merged.computeBoundingBox();

  const box = merged.boundingBox ?? new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Center on X=0, Z=0 and rest flat on Y=0 in real millimeters
  const rawMillimeterGeometry = merged.clone();
  rawMillimeterGeometry.translate(-center.x, -box.min.y, -center.z);
  rawMillimeterGeometry.computeVertexNormals();

  // Normalized 1x1x1 geometry for ForgeViewer3D outer scale group
  const normalizedGeometry = rawMillimeterGeometry.clone();
  const sx = size.x > 0.0001 ? 1 / size.x : 1;
  const sy = size.y > 0.0001 ? 1 / size.y : 1;
  const sz = size.z > 0.0001 ? 1 / size.z : 1;
  normalizedGeometry.scale(sx, sy, sz);
  normalizedGeometry.computeVertexNormals();

  const pos = normalizedGeometry.getAttribute('position');
  const triangleCount = pos ? Math.floor(pos.count / 3) : 0;

  const boundingBoxMm: DimensionsMm = {
    x: Math.min(256, Math.max(5, Math.round(size.x))),
    y: Math.min(256, Math.max(5, Math.round(size.z))),
    z: Math.min(256, Math.max(5, Math.round(size.y))),
  };

  const volumeCm3 = Math.max(2, Number((solidVolumeMm3 / 1000).toFixed(1)));

  return {
    templateId,
    normalizedGeometry,
    rawMillimeterGeometry,
    boundingBoxMm,
    volumeCm3,
    overhangRatio,
    triangleCount,
    summarySpec,
  };
}

/**
 * Exports a generated parametric model as a valid CAD Z-up ASCII .STL ArrayBuffer
 * so users or admins can download or persist the exact parametric mesh.
 */
export function exportParametricModelToStlBuffer(
  templateId: ParametricTemplateId,
  params: Record<string, number>
): ArrayBuffer {
  const generated = buildParametricModel(templateId, params);
  const cadGeom = generated.rawMillimeterGeometry.clone();
  // Rotate back from Three.js Y-up to CAD Z-up
  cadGeom.rotateX(Math.PI / 2);
  cadGeom.computeBoundingBox();
  if (cadGeom.boundingBox) {
    cadGeom.translate(0, 0, -cadGeom.boundingBox.min.z);
  }

  const pos = cadGeom.getAttribute('position');
  const lines: string[] = [`solid axisforge_${templateId.toLowerCase()}`];

  if (pos) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < pos.count; i += 3) {
      p1.fromBufferAttribute(pos, i);
      p2.fromBufferAttribute(pos, i + 1);
      p3.fromBufferAttribute(pos, i + 2);
      e1.subVectors(p2, p1);
      e2.subVectors(p3, p1);
      n.crossVectors(e1, e2).normalize();

      lines.push(
        `facet normal ${n.x.toFixed(4)} ${n.y.toFixed(4)} ${n.z.toFixed(4)}`,
        '  outer loop',
        `    vertex ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} ${p1.z.toFixed(3)}`,
        `    vertex ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} ${p2.z.toFixed(3)}`,
        `    vertex ${p3.x.toFixed(3)} ${p3.y.toFixed(3)} ${p3.z.toFixed(3)}`,
        '  endloop',
        'endfacet'
      );
    }
  }

  lines.push(`endsolid axisforge_${templateId.toLowerCase()}`);
  return new TextEncoder().encode(lines.join('\n')).buffer;
}

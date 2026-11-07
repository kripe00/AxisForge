import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { unzipSync, zipSync, strToU8 } from 'three/examples/jsm/libs/fflate.module.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CatalogFileFormat, DimensionsMm } from '@/lib/schemas/forge';

export interface ParsedModelAnalysis {
  /** Normalized geometry (centered on X/Z, bottom at Y=0, scaled to 1x1x1 unit box) */
  normalizedGeometry: THREE.BufferGeometry;
  /** Original millimeter bounding box (X = width, Y = depth, Z = height) */
  boundingBoxMm: DimensionsMm;
  /** Calculated mesh volume in cm3 */
  volumeCm3: number;
  /** Number of triangles in the mesh */
  triangleCount: number;
  /** Estimated overhang ratio [0..1] based on downward-facing triangle normals */
  overhangRatio: number;
}

interface Parsed3mfComponentRef {
  objectId: string;
  targetPath: string;
  transform: THREE.Matrix4 | null;
}

interface Parsed3mfObject {
  id: string;
  modelPath: string;
  meshGeometry: THREE.BufferGeometry | null;
  components: Parsed3mfComponentRef[];
}

interface Parsed3mfBuildItem {
  objectId: string;
  targetPath: string;
  transform: THREE.Matrix4 | null;
}

function normalizeArchivePath(p: string): string {
  return p.replace(/^\/+/, '').replace(/\\/g, '/');
}

function getPathAttribute(el: Element): string | null {
  const direct = el.getAttribute('p:path') || el.getAttribute('path');
  if (direct) return normalizeArchivePath(direct);
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr && (attr.name === 'path' || attr.name.endsWith(':path'))) {
      return normalizeArchivePath(attr.value);
    }
  }
  return null;
}

function parse3mfTransform(transformStr: string | null): THREE.Matrix4 | null {
  if (!transformStr) return null;
  const parts = transformStr
    .trim()
    .split(/\s+/)
    .map((s) => parseFloat(s));
  if (parts.length < 12 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  const m = new THREE.Matrix4();
  m.set(
    parts[0]!,
    parts[3]!,
    parts[6]!,
    parts[9]!,
    parts[1]!,
    parts[4]!,
    parts[7]!,
    parts[10]!,
    parts[2]!,
    parts[5]!,
    parts[8]!,
    parts[11]!,
    0,
    0,
    0,
    1
  );
  return m;
}

function parseMeshElementToGeometry(meshEl: Element): THREE.BufferGeometry | null {
  const vertexEls = meshEl.getElementsByTagName('vertex');
  const triangleEls = meshEl.getElementsByTagName('triangle');

  if (vertexEls.length === 0 || triangleEls.length === 0) {
    return null;
  }

  const vertices = new Float32Array(vertexEls.length * 3);
  for (let i = 0; i < vertexEls.length; i++) {
    const v = vertexEls[i]!;
    vertices[i * 3] = parseFloat(v.getAttribute('x') || '0');
    vertices[i * 3 + 1] = parseFloat(v.getAttribute('y') || '0');
    vertices[i * 3 + 2] = parseFloat(v.getAttribute('z') || '0');
  }

  const positions = new Float32Array(triangleEls.length * 9);
  for (let i = 0; i < triangleEls.length; i++) {
    const t = triangleEls[i]!;
    const v1 = parseInt(t.getAttribute('v1') || '0', 10) * 3;
    const v2 = parseInt(t.getAttribute('v2') || '0', 10) * 3;
    const v3 = parseInt(t.getAttribute('v3') || '0', 10) * 3;

    const base = i * 9;
    positions[base] = vertices[v1] ?? 0;
    positions[base + 1] = vertices[v1 + 1] ?? 0;
    positions[base + 2] = vertices[v1 + 2] ?? 0;

    positions[base + 3] = vertices[v2] ?? 0;
    positions[base + 4] = vertices[v2 + 1] ?? 0;
    positions[base + 5] = vertices[v2 + 2] ?? 0;

    positions[base + 6] = vertices[v3] ?? 0;
    positions[base + 7] = vertices[v3 + 1] ?? 0;
    positions[base + 8] = vertices[v3 + 2] ?? 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Parses both standard 3MF archives and Bambu Studio / OrcaSlicer / PrusaSlicer
 * Production Extension 3MF archives (where sub-meshes live in 3D/Objects/*.model via p:path).
 */
function parse3mfArchiveToGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  const unzipped = unzipSync(new Uint8Array(buffer));
  const decoder = new TextDecoder();

  const objectsByKey = new Map<string, Parsed3mfObject>();
  const buildItems: Parsed3mfBuildItem[] = [];
  const allFallbackGeometries: THREE.BufferGeometry[] = [];

  const modelFileNames = Object.keys(unzipped).filter((name) =>
    name.toLowerCase().endsWith('.model')
  );

  if (modelFileNames.length === 0) {
    throw new Error('Fant ingen .model-data inni 3MF-filen.');
  }

  for (const rawName of modelFileNames) {
    const fileBytes = unzipped[rawName];
    if (!fileBytes) continue;

    const modelPath = normalizeArchivePath(rawName);
    const xmlText = decoder.decode(fileBytes);
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');

    const objectNodes = xmlDoc.getElementsByTagName('object');
    for (let i = 0; i < objectNodes.length; i++) {
      const objEl = objectNodes[i]!;
      const id = objEl.getAttribute('id') || String(i + 1);

      const meshEls = objEl.getElementsByTagName('mesh');
      const meshGeometry = meshEls[0] ? parseMeshElementToGeometry(meshEls[0]) : null;
      if (meshGeometry) {
        allFallbackGeometries.push(meshGeometry);
      }

      const components: Parsed3mfComponentRef[] = [];
      const compEls = objEl.getElementsByTagName('component');
      for (let c = 0; c < compEls.length; c++) {
        const compEl = compEls[c]!;
        const compObjId = compEl.getAttribute('objectid');
        if (!compObjId) continue;
        const externalPath = getPathAttribute(compEl);
        components.push({
          objectId: compObjId,
          targetPath: externalPath || modelPath,
          transform: parse3mfTransform(compEl.getAttribute('transform')),
        });
      }

      objectsByKey.set(`${modelPath}#${id}`, {
        id,
        modelPath,
        meshGeometry,
        components,
      });
    }

    const itemNodes = xmlDoc.getElementsByTagName('item');
    for (let i = 0; i < itemNodes.length; i++) {
      const itemEl = itemNodes[i]!;
      const objectId = itemEl.getAttribute('objectid');
      if (!objectId) continue;
      const externalPath = getPathAttribute(itemEl);
      buildItems.push({
        objectId,
        targetPath: externalPath || modelPath,
        transform: parse3mfTransform(itemEl.getAttribute('transform')),
      });
    }
  }

  const resolvedGeometries: THREE.BufferGeometry[] = [];

  function collectObjectGeometries(
    targetPath: string,
    objectId: string,
    parentMatrix: THREE.Matrix4,
    depth: number
  ) {
    if (depth > 12) return;
    let obj = objectsByKey.get(`${targetPath}#${objectId}`);
    if (!obj) {
      // Fallback: search any model file with matching objectId
      const entries = Array.from(objectsByKey.values());
      obj = entries.find((candidate) => candidate.id === objectId);
    }
    if (!obj) return;

    if (obj.meshGeometry) {
      const transformed = obj.meshGeometry.clone();
      transformed.applyMatrix4(parentMatrix);
      resolvedGeometries.push(transformed);
    }

    for (const comp of obj.components) {
      const nextMatrix = parentMatrix.clone();
      if (comp.transform) {
        nextMatrix.multiply(comp.transform);
      }
      collectObjectGeometries(comp.targetPath, comp.objectId, nextMatrix, depth + 1);
    }
  }

  for (const item of buildItems) {
    const rootMatrix = item.transform ? item.transform.clone() : new THREE.Matrix4();
    collectObjectGeometries(item.targetPath, item.objectId, rootMatrix, 0);
  }

  const finalList = resolvedGeometries.length > 0 ? resolvedGeometries : allFallbackGeometries;

  if (finalList.length === 0) {
    throw new Error('Fant ingen gyldige 3D-triangler i 3MF-filen.');
  }

  if (finalList.length === 1) {
    return finalList[0]!;
  }

  const merged = BufferGeometryUtils.mergeGeometries(finalList, false);
  if (!merged) {
    return finalList[0]!;
  }
  return merged;
}

/**
 * Parses an ArrayBuffer containing either a binary/ASCII .stl or a .3mf archive.
 * Converts from CAD Z-up to Three.js Y-up, computes real millimeter dimensions,
 * tetrahedral volume (cm3), and overhang ratio, and returns a normalized 1x1x1 BufferGeometry.
 */
export function parseCadModelBuffer(
  buffer: ArrayBuffer,
  format: CatalogFileFormat
): ParsedModelAnalysis {
  let rawGeometry: THREE.BufferGeometry;

  if (format === '3mf') {
    rawGeometry = parse3mfArchiveToGeometry(buffer);
  } else {
    const loader = new STLLoader();
    const parsed = loader.parse(buffer);
    rawGeometry = parsed.index ? parsed.toNonIndexed() : parsed;
  }

  // Convert CAD Z-up to Three.js Y-up (so CAD X -> X, CAD Y -> -Z, CAD Z -> Y height)
  rawGeometry.rotateX(-Math.PI / 2);
  rawGeometry.computeVertexNormals();
  rawGeometry.computeBoundingBox();

  const box = rawGeometry.boundingBox ?? new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Measure signed tetrahedral volume and downward-facing overhang area
  const pos = rawGeometry.getAttribute('position');
  let signedVolumeMm3 = 0;
  let totalArea = 0;
  let overhangArea = 0;

  if (pos) {
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const edge1 = new THREE.Vector3();
    const edge2 = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let i = 0; i < pos.count; i += 3) {
      p1.fromBufferAttribute(pos, i);
      p2.fromBufferAttribute(pos, i + 1);
      p3.fromBufferAttribute(pos, i + 2);

      // Signed volume contribution
      edge1.copy(p2).cross(p3);
      signedVolumeMm3 += p1.dot(edge1) / 6.0;

      // Triangle area & overhang check (faces > 45 deg downward above the first 1mm layer)
      edge1.subVectors(p2, p1);
      edge2.subVectors(p3, p1);
      normal.crossVectors(edge1, edge2);
      const triArea = normal.length() * 0.5;
      totalArea += triArea;

      if (triArea > 0.0001) {
        normal.normalize();
        const avgY = (p1.y + p2.y + p3.y) / 3;
        if (avgY - box.min.y > 1.2 && normal.y < -0.65) {
          overhangArea += triArea;
        }
      }
    }
  }

  const triangleCount = pos ? Math.floor(pos.count / 3) : 0;

  // In Three.js Y-up: size.x = Width (X), size.z = Depth (Y on bed), size.y = Height (Z on printer)
  let rawWidthMm = size.x || 60;
  let rawDepthMm = size.z || 60;
  let rawHeightMm = size.y || 60;

  // If the file was exported in meters or centimeters (tiny numbers < 3mm), auto-scale to mm
  if (Math.max(rawWidthMm, rawDepthMm, rawHeightMm) < 3) {
    rawWidthMm *= 100;
    rawDepthMm *= 100;
    rawHeightMm *= 100;
    signedVolumeMm3 *= 1_000_000;
  }

  // Clamp to Bambu Lab 256x256x256 mm build volume while preserving aspect ratio
  const maxDim = Math.max(rawWidthMm, rawDepthMm, rawHeightMm);
  const clampScale = maxDim > 250 ? 250 / maxDim : 1;

  const boundingBoxMm: DimensionsMm = {
    x: Math.min(256, Math.max(2, Math.round(rawWidthMm * clampScale))),
    y: Math.min(256, Math.max(2, Math.round(rawDepthMm * clampScale))),
    z: Math.min(256, Math.max(2, Math.round(rawHeightMm * clampScale))),
  };

  // Fallback to bounding-box fill estimate if mesh is non-closed/surface-only
  const rawVolumeCm3 = Math.abs(signedVolumeMm3) / 1000;
  const fallbackBoxVolumeCm3 =
    ((boundingBoxMm.x * boundingBoxMm.y * boundingBoxMm.z) / 1000) * 0.32;
  const volumeCm3 = Math.max(
    1.5,
    Number(
      (
        (rawVolumeCm3 > 0.5 ? rawVolumeCm3 : fallbackBoxVolumeCm3) * Math.pow(clampScale, 3)
      ).toFixed(1)
    )
  );

  const overhangRatio =
    totalArea > 0 ? Number(Math.min(0.65, overhangArea / totalArea).toFixed(2)) : 0.15;

  // Normalize geometry to a [1 x 1 x 1] unit box centered at X=0, Z=0 and resting flat on Y=0
  const normalizedGeometry = rawGeometry.clone();
  normalizedGeometry.translate(-center.x, -box.min.y, -center.z);
  const sx = size.x > 0.00001 ? 1 / size.x : 1;
  const sy = size.y > 0.00001 ? 1 / size.y : 1;
  const sz = size.z > 0.00001 ? 1 / size.z : 1;
  normalizedGeometry.scale(sx, sy, sz);
  normalizedGeometry.computeVertexNormals();

  return {
    normalizedGeometry,
    boundingBoxMm,
    volumeCm3,
    triangleCount,
    overhangRatio,
  };
}

/**
 * Decodes a base64 string into an ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const raw = base64.includes(',') ? base64.split(',')[1]! : base64;
  const binaryString = window.atob(raw);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a real, spec-compliant .3MF archive (ZIP with [Content_Types].xml, _rels/.rels,
 * and 3D/3dmodel.model) of a Nordic fluted vase / cable organizer cup for one-click testing.
 */
export function generateSample3mfArchive(radiusMm = 42, heightMm = 95): ArrayBuffer {
  const segments = 24;
  const verticesXml: string[] = [];
  const trianglesXml: string[] = [];

  // Index 0: bottom center (0, 0, 0), Index 1: top center (0, 0, heightMm)
  verticesXml.push(`<vertex x="0" y="0" z="0" />`);
  verticesXml.push(`<vertex x="0" y="0" z="${heightMm}" />`);

  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    // Star/fluted rib modulation for a distinct architectural silhouette
    const flute = i % 2 === 0 ? 1.0 : 0.86;
    const xBottom = (Math.cos(angle) * radiusMm * flute).toFixed(3);
    const yBottom = (Math.sin(angle) * radiusMm * flute).toFixed(3);
    const xTop = (Math.cos(angle) * radiusMm * 1.08 * flute).toFixed(3);
    const yTop = (Math.sin(angle) * radiusMm * 1.08 * flute).toFixed(3);

    // Bottom ring vertex: 2 + i * 2
    verticesXml.push(`<vertex x="${xBottom}" y="${yBottom}" z="0" />`);
    // Top ring vertex: 2 + i * 2 + 1
    verticesXml.push(`<vertex x="${xTop}" y="${yTop}" z="${heightMm}" />`);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    const b1 = 2 + i * 2;
    const t1 = 2 + i * 2 + 1;
    const b2 = 2 + next * 2;
    const t2 = 2 + next * 2 + 1;

    // Bottom cap
    trianglesXml.push(`<triangle v1="0" v2="${b2}" v3="${b1}" />`);
    // Outer wall (2 triangles)
    trianglesXml.push(`<triangle v1="${b1}" v2="${b2}" v3="${t2}" />`);
    trianglesXml.push(`<triangle v1="${b1}" v2="${t2}" v3="${t1}" />`);
    // Top cap
    trianglesXml.push(`<triangle v1="1" v2="${t1}" v3="${t2}" />`);
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model" name="Nordic_Fluted_Holder">
      <mesh>
        <vertices>
          ${verticesXml.join('\n          ')}
        </vertices>
        <triangles>
          ${trianglesXml.join('\n          ')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
  </build>
</model>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    '3D/3dmodel.model': strToU8(modelXml),
  });

  return zipped.buffer as ArrayBuffer;
}

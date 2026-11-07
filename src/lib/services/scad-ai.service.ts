import fs from 'node:fs';
import path from 'node:path';
import { SCAD_LIBRARY_TEMPLATES } from '@/lib/three/scad-templates';

function resolveServerEnvKey(varName: string): string | undefined {
  const fromEnv = process.env[varName]?.trim();
  if (fromEnv && !fromEnv.startsWith('your-')) {
    return fromEnv;
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^\\s*${varName}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, 'm');
      const match = content.match(regex);
      if (match?.[1]?.trim() && !match[1].trim().startsWith('your-')) {
        process.env[varName] = match[1].trim();
        return match[1].trim();
      }
    }
  } catch {
    // Ignore fs read errors
  }
  return undefined;
}

export type ScadAiModelTier = 'flash' | 'pro';

export interface GeneratedScadOutput {
  title: string;
  fileName: string;
  description: string;
  category: string;
  scadSource: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'axisforge-cad-synth';
  usedModel?: string;
}

interface ExtractedDimensions {
  nums: number[];
  explicitWidth: number | null;
  explicitDepth: number | null;
  explicitHeight: number | null;
  compartments: number | null;
  customText: string | null;
  diameter: number | null;
  holeDia: number | null;
  wall: number | null;
  teeth: number | null;
}

/**
 * Extracts explicit millimeter dimensions, M-thread sizes (M3..M10), diameters (Ø),
 * wall thicknesses, compartments, custom text, and tooth counts from a Norwegian or English prompt.
 */
function parseDimensionsFromPrompt(prompt: string): ExtractedDimensions {
  const lower = prompt.toLowerCase();

  // Check for M-screw sizes like M3, M4, M5, M6, M8, M10
  let holeDia: number | null = null;
  const mMatch = lower.match(/\bm(3|4|5|6|8|10)\b/);
  if (mMatch && mMatch[1]) {
    const nominal = Number(mMatch[1]);
    holeDia = nominal + 0.5; // clearance hole
  }
  const holeExplicit = lower.match(/\b(?:hull|hole|skruehull|boring)\D{0,12}?(\d+(?:[.,]\d+)?)/);
  if (!holeDia && holeExplicit && holeExplicit[1]) {
    holeDia = Number(holeExplicit[1].replace(',', '.'));
  }

  // Check for diameter (Ø, dia, diameter, rørdiameter) - must NOT match 'ø' inside 'høyde' or 'større'!
  let diameter: number | null = null;
  const diaMatch = lower.match(
    /(?:(?:^|[\s(])ø|\bdiameter\b|\bdia\b|\brørdiameter\b|\baksel\b)\D{0,10}?(\d+(?:[.,]\d+)?)/
  );
  if (diaMatch && diaMatch[1]) {
    diameter = Number(diaMatch[1].replace(',', '.'));
  }

  // Check for wall thickness
  let wall: number | null = null;
  const wallMatch = lower.match(
    /\b(?:vegg|veggtykkelse|tykkelse|wall|gods)\D{0,12}?(\d+(?:[.,]\d+)?)/
  );
  if (wallMatch && wallMatch[1]) {
    wall = Number(wallMatch[1].replace(',', '.'));
  }

  // Check for explicit width, depth/length, height
  const widthMatch = lower.match(/\b(?:bredde|width)\D{0,12}?(\d+(?:[.,]\d+)?)/);
  const explicitWidth = widthMatch?.[1] ? Number(widthMatch[1].replace(',', '.')) : null;

  const depthMatch = lower.match(/\b(?:dybde|lengde|depth|length)\D{0,12}?(\d+(?:[.,]\d+)?)/);
  const explicitDepth = depthMatch?.[1] ? Number(depthMatch[1].replace(',', '.')) : null;

  const heightMatch = lower.match(/\b(?:høyde|høy|height)\D{0,12}?(\d+(?:[.,]\d+)?)/);
  const explicitHeight = heightMatch?.[1] ? Number(heightMatch[1].replace(',', '.')) : null;

  // Check for compartments / dividers
  const compMatch = lower.match(/(\d+)\s*(?:rom\b|skillevegg(?:er)?|ruter|avdeling(?:er)?)/);
  const compartments = compMatch?.[1] ? clamp(Math.round(Number(compMatch[1])), 1, 8) : null;

  // Check for custom 3D text
  const quotedMatch =
    prompt.match(/["'«»]([a-zA-ZæøåÆØÅ0-9 _.-]{1,16})["'«»]/) ||
    prompt.match(
      /\b(?:tekst(?:en)?|navn(?:et)?|graver(?:ing)?)\s+([a-zA-ZæøåÆØÅ0-9_-]{2,14})\b/i
    );
  const customText = quotedMatch?.[1] ? quotedMatch[1].trim().toUpperCase() : null;

  // Check for gear teeth
  let teeth: number | null = null;
  const teethMatch = lower.match(/(\d+)\s*(?:tenner|tann|teeth|tooth)/);
  if (teethMatch && teethMatch[1]) {
    teeth = Math.min(80, Math.max(8, Math.round(Number(teethMatch[1]))));
  }

  // Check for WxDxH triplet or pair (e.g. 120x80x45 or 80 x 60)
  const tripletMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?/
  );
  const nums: number[] = [];
  if (tripletMatch) {
    if (tripletMatch[1]) nums.push(Number(tripletMatch[1].replace(',', '.')));
    if (tripletMatch[2]) nums.push(Number(tripletMatch[2].replace(',', '.')));
    if (tripletMatch[3]) nums.push(Number(tripletMatch[3].replace(',', '.')));
  } else {
    const allMmMatches = Array.from(lower.matchAll(/(\d+(?:[.,]\d+)?)\s*mm\b/g));
    for (const m of allMmMatches) {
      if (m[1]) {
        const val = Number(m[1].replace(',', '.'));
        // Do not treat wall thickness (e.g. 4.2 mm) as outer width
        if (wall !== null && Math.abs(val - wall) < 0.01) continue;
        nums.push(val);
      }
    }
  }

  return {
    nums,
    explicitWidth,
    explicitDepth,
    explicitHeight,
    compartments,
    customText,
    diameter,
    holeDia,
    wall,
    teeth,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

interface DetectedShapeMotif {
  shapeId: number;
  shapeLabel: string;
  pointCount?: number;
  waveDepth?: number;
}

/**
 * Detects 2D silhouette / figure shapes (Katt, Hjerte, Juletre, Pepperkakemann, Hund, Kanin,
 * Dinosaur, Bamse, Krone, Sommerfugl, Fisk, Halvmåne, Lyn, Stjerne, Blomst, Sirkel) from Norwegian/English prompts.
 */
export function detectShapeMotifFromPrompt(prompt: string): DetectedShapeMotif | null {
  const lower = prompt.toLowerCase();
  if (/\b(?:pikachu|pika|raichu|pokemon|pokémon)\b/.test(lower)) {
    return { shapeId: 14, shapeLabel: 'Pikachu' };
  }
  if (/\b(?:pokeball|pokéball|pokekule)\b/.test(lower)) {
    return { shapeId: 15, shapeLabel: 'Pokéball' };
  }
  if (/\b(?:flaggermus(?:en)?|batman|bat|vampyr)\b/.test(lower)) {
    return { shapeId: 16, shapeLabel: 'Flaggermus / Batman' };
  }
  if (/\b(?:spøkels(?:e|et|er)|spokels(?:e|et)|ghost|pacman|boo)\b/.test(lower)) {
    return { shapeId: 17, shapeLabel: 'Spøkelse' };
  }
  if (/\b(?:snømann(?:en)?|snomann(?:en)?|olaf|snowman)\b/.test(lower)) {
    return { shapeId: 18, shapeLabel: 'Snømann' };
  }
  if (/\b(?:enhjørning(?:en)?|enhjorning(?:en)?|unicorn|hest(?:en)?|ponni(?:en)?|horse|pony)\b/.test(lower)) {
    return { shapeId: 19, shapeLabel: 'Enhjørning / Hest' };
  }
  if (/\b(?:bil(?:en)?|racerbil|personbil|lastebil|car|truck)\b/.test(lower)) {
    return { shapeId: 20, shapeLabel: 'Bil' };
  }
  if (/\b(?:rakett(?:en)?|romskip(?:et)?|astronaut|rocket|spaceship)\b/.test(lower)) {
    return { shapeId: 21, shapeLabel: 'Rakett' };
  }
  if (/\b(?:sopp(?:en)?|mario|paddehatt|mushroom|toad)\b/.test(lower)) {
    return { shapeId: 22, shapeLabel: 'Sopp (Mario)' };
  }
  if (/\b(?:katt(?:en|er|unge)?|pus(?:en)?|cat|kitty|kitten)\b/.test(lower)) {
    return { shapeId: 1, shapeLabel: 'Katt' };
  }
  if (/\b(?:hjert(?:e|et|er)|kjærlighet|heart)\b/.test(lower)) {
    return { shapeId: 2, shapeLabel: 'Hjerte' };
  }
  if (/\b(?:juletre(?:et)?|grantre(?:et)?|gran|tree|pine|julegran)\b/.test(lower)) {
    return { shapeId: 3, shapeLabel: 'Juletre' };
  }
  if (/\b(?:pepperkakemann(?:en)?|kakemann(?:en)?|gingerbread|mann(?:en)?)\b/.test(lower)) {
    return { shapeId: 4, shapeLabel: 'Pepperkakemann' };
  }
  if (/\b(?:hund(?:en|er)?|valp(?:en)?|bikkj(?:a|e)|dog|puppy)\b/.test(lower)) {
    return { shapeId: 5, shapeLabel: 'Hund' };
  }
  if (/\b(?:kanin(?:en|er)?|har(?:e|en)|påskehare|bunny|rabbit)\b/.test(lower)) {
    return { shapeId: 6, shapeLabel: 'Kanin' };
  }
  if (/\b(?:dinosaur(?:en|er)?|dino|t-rex|trex|drage(?:n)?)\b/.test(lower)) {
    return { shapeId: 7, shapeLabel: 'Dinosaur' };
  }
  if (/\b(?:bams(?:e|en)|bjørn(?:en)?|teddy(?:bjørn)?|bear)\b/.test(lower)) {
    return { shapeId: 8, shapeLabel: 'Bamse' };
  }
  if (/\b(?:kron(?:e|en|a)|kongekrone|prinsessekrone|crown)\b/.test(lower)) {
    return { shapeId: 9, shapeLabel: 'Krone' };
  }
  if (/\b(?:sommerfugl(?:en|er)?|butterfly)\b/.test(lower)) {
    return { shapeId: 10, shapeLabel: 'Sommerfugl' };
  }
  if (/\b(?:fisk(?:en|er)?|hai(?:en)?|hval(?:en)?|delfin(?:en)?|fish)\b/.test(lower)) {
    return { shapeId: 11, shapeLabel: 'Fisk' };
  }
  if (/\b(?:mån(?:e|en)|halvmån(?:e|en)|månesigd|moon|crescent)\b/.test(lower)) {
    return { shapeId: 12, shapeLabel: 'Halvmåne' };
  }
  if (/\b(?:lyn(?:et)?|torden|flash|lightning)\b/.test(lower)) {
    return { shapeId: 13, shapeLabel: 'Lyn' };
  }
  if (/\b(?:stjern(?:e|en|a|er)|star)\b/.test(lower)) {
    return { shapeId: 0, shapeLabel: 'Stjerne (5 spisser)', pointCount: 5, waveDepth: 12 };
  }
  if (/\b(?:blomst(?:en|er)?|solsik(?:ke|ka)|flower)\b/.test(lower)) {
    return { shapeId: 0, shapeLabel: 'Blomst (8 kronblader)', pointCount: 8, waveDepth: 7 };
  }
  if (/\b(?:sirkel|rund(?:ing)?|circle)\b/.test(lower)) {
    return { shapeId: 0, shapeLabel: 'Rund Sirkel', pointCount: 1, waveDepth: 0 };
  }
  return null;
}

function applyTemplateOverrides(
  templateId: string,
  prompt: string,
  overrides: Record<string, number>,
  customTitleSuffix?: string,
  customTextOverride?: string
): GeneratedScadOutput {
  const tpl = SCAD_LIBRARY_TEMPLATES.find((t) => t.id === templateId) ?? SCAD_LIBRARY_TEMPLATES[0]!;
  let source = tpl.scadSource;

  for (const [key, val] of Object.entries(overrides)) {
    const regex = new RegExp(`(^\\s*${key}\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`, 'm');
    source = source.replace(regex, `$1${val}`);
  }

  const quotedMatch =
    prompt.match(/["'«»]([a-zA-ZæøåÆØÅ0-9 _.-]{1,16})["'«»]/) ||
    prompt.match(/(?:tekst(?:en)?|navn(?:et)?|graver(?:ing)?)\s+([a-zA-ZæøåÆØÅ0-9_-]{2,14})/i);
  const resolvedText = customTextOverride ?? quotedMatch?.[1]?.toUpperCase();
  if (resolvedText && /CUSTOM_TEXT\s*=/.test(source)) {
    source = source.replace(
      /(^\s*CUSTOM_TEXT\s*=\s*)"[^"]*"/m,
      `$1"${resolvedText.slice(0, 12)}"`
    );
  }

  return {
    title: customTitleSuffix ? `AI ${tpl.shortTitle}: ${customTitleSuffix}` : `AI ${tpl.title}`,
    fileName: tpl.fileName,
    description: `AI-tilpasset ${tpl.shortTitle.toLowerCase()} basert på: «${prompt}».`,
    category: tpl.category,
    provider: 'axisforge-cad-synth',
    scadSource: source,
  };
}

/**
 * Deterministic parametric OpenSCAD (.scad) synthesizer that turns natural-language
 * prompts into clean, well-structured, 100% manifold OpenSCAD code with Customizer sliders.
 */
function synthesizeParametricScadFromPrompt(prompt: string): GeneratedScadOutput {
  const lower = prompt.toLowerCase();
  const dims = parseDimensionsFromPrompt(prompt);

  // A. GRIDFINITY BIN
  if (lower.includes('gridfinity') || lower.includes('grid-boks') || lower.includes('42mm')) {
    const gx = clamp(Math.round(dims.nums[0] && dims.nums[0] <= 8 ? dims.nums[0] : 2), 1, 5);
    const gy = clamp(Math.round(dims.nums[1] && dims.nums[1] <= 8 ? dims.nums[1] : 3), 1, 5);
    const hu = clamp(Math.round(dims.nums[2] && dims.nums[2] <= 14 ? dims.nums[2] : 6), 2, 14);
    return applyTemplateOverrides('cat_scad_gridfinity_bin', prompt, {
      GRID_X: gx,
      GRID_Y: gy,
      HEIGHT_UNITS: hu,
      COMPARTMENTS_X: gx,
      COMPARTMENTS_Y: gy,
    });
  }

  // B. RUGGED BOX / VANNTETT VERKTØYKASSE
  if (
    lower.includes('rugged') ||
    lower.includes('verktøykasse') ||
    lower.includes('vanntett') ||
    lower.includes('pakning') ||
    lower.includes('hengsel') ||
    lower.includes('latch')
  ) {
    return applyTemplateOverrides('cat_scad_rugged_box', prompt, {
      INNER_WIDTH: clamp(dims.nums[0] ?? 115, 50, 220),
      INNER_LENGTH: clamp(dims.nums[1] ?? 80, 40, 200),
      INNER_HEIGHT: clamp(dims.nums[2] ?? 48, 25, 140),
      WALL_THICKNESS: clamp(dims.wall ?? 3.2, 2.0, 6.0),
    });
  }

  // C. SD / MICROSD / USB HOLDER
  if (
    lower.includes('sd-kort') ||
    lower.includes('microsd') ||
    lower.includes('minnepenn') ||
    lower.includes('usb') ||
    lower.includes('minnekort')
  ) {
    const count = clamp(Math.round(dims.nums[0] ?? 5), 1, 12);
    return applyTemplateOverrides('cat_scad_sd_usb_holder', prompt, {
      SD_SLOTS: count,
      MICRO_SD_SLOTS: clamp(count + 1, 1, 14),
    });
  }

  // D. DRAWER ORGANIZER / SKUFFEOPPDELER
  if (lower.includes('skuff') || lower.includes('drawer') || lower.includes('oppdeler')) {
    return applyTemplateOverrides('cat_scad_drawer_organizer', prompt, {
      INNER_WIDTH: clamp(dims.nums[0] ?? 140, 50, 240),
      INNER_LENGTH: clamp(dims.nums[1] ?? 100, 50, 240),
      INNER_HEIGHT: clamp(dims.nums[2] ?? 42, 20, 120),
    });
  }

  // E. COOKIE CUTTER / KAKEFORM / PEPPERKAKEFORM / SILHUETT-MOTIV
  const detectedMotif = detectShapeMotifFromPrompt(prompt);
  if (
    lower.includes('kakeform') ||
    lower.includes('pepperkake') ||
    lower.includes('cookie') ||
    lower.includes('utstikker') ||
    (detectedMotif !== null &&
      !lower.includes('boks') &&
      !lower.includes('kasse') &&
      !lower.includes('skuff') &&
      !lower.includes('ring') &&
      !lower.includes('vase') &&
      !lower.includes('krukke'))
  ) {
    return applyTemplateOverrides(
      'cat_scad_cookie_cutter',
      prompt,
      {
        SHAPE_TYPE: detectedMotif?.shapeId ?? 0,
        OUTER_DIAMETER_MM: clamp(dims.diameter ?? dims.explicitWidth ?? dims.nums[0] ?? 85, 45, 160),
        CUTTER_HEIGHT_MM: clamp(dims.explicitHeight ?? dims.nums[1] ?? 18, 10, 35),
        BLADE_WALL_MM: clamp(dims.wall ?? 1.2, 0.8, 2.0),
        ...(detectedMotif?.pointCount !== undefined ? { POINT_COUNT: detectedMotif.pointCount } : {}),
        ...(detectedMotif?.waveDepth !== undefined ? { WAVE_DEPTH_MM: detectedMotif.waveDepth } : {}),
      },
      detectedMotif?.shapeLabel
    );
  }

  // F. FUNNEL / TRAKT
  if (lower.includes('trakt') || lower.includes('funnel')) {
    return applyTemplateOverrides('cat_scad_threaded_funnel', prompt, {
      TOP_DIAMETER_MM: clamp(dims.nums[0] ?? dims.diameter ?? 96, 40, 200),
      SPOUT_DIAMETER_MM: clamp(dims.nums[1] ?? 24, 10, 60),
      CONE_HEIGHT_MM: clamp(dims.nums[2] ?? 55, 25, 130),
    });
  }

  // G. THREADED JAR / SKRULOKK-KRUKKE
  if (
    lower.includes('krukke') ||
    lower.includes('skrulokk') ||
    lower.includes('jar') ||
    lower.includes('beholder med lokk')
  ) {
    return applyTemplateOverrides('cat_scad_threaded_jar', prompt, {
      JAR_DIAMETER_MM: clamp(dims.diameter ?? dims.nums[0] ?? 66, 35, 115),
      JAR_HEIGHT_MM: clamp(dims.nums[1] ?? 62, 30, 140),
    });
  }

  // H. SOAP MOLD / SÅPEFORM / STEMPEL
  if (
    lower.includes('såpe') ||
    lower.includes('stempel') ||
    lower.includes('isterning') ||
    lower.includes('soap') ||
    lower.includes('støpeform')
  ) {
    return applyTemplateOverrides('cat_scad_soap_mold', prompt, {
      INNER_WIDTH: clamp(dims.nums[0] ?? 82, 45, 150),
      INNER_LENGTH: clamp(dims.nums[1] ?? 58, 35, 120),
      INNER_HEIGHT: clamp(dims.nums[2] ?? 28, 15, 60),
    });
  }

  // I. RING / SIGNETRING
  if (
    /\bring(?:en|er)?\b/.test(lower) ||
    lower.includes('signet') ||
    lower.includes('fingerring')
  ) {
    return applyTemplateOverrides('cat_scad_signet_ring', prompt, {
      RING_DIAMETER_MM: clamp(dims.diameter ?? dims.nums[0] ?? 19, 14, 24),
      BAND_WIDTH_MM: clamp(dims.nums[1] ?? 9, 4, 16),
    });
  }

  // J. VORONOI BRACELET / ARMBÅND
  if (lower.includes('armbånd') || lower.includes('bracelet') || lower.includes('voronoi')) {
    return applyTemplateOverrides('cat_scad_voronoi_bracelet', prompt, {
      WRIST_DIAMETER_MM: clamp(dims.diameter ?? dims.nums[0] ?? 64, 48, 85),
      CUFF_WIDTH_MM: clamp(dims.nums[1] ?? 30, 15, 60),
    });
  }

  // K0. NAMEPLATE / DØRSKILT / NAVNESKILT
  if (lower.includes('navneskilt') || lower.includes('dørskilt') || lower.includes('skilt')) {
    return applyTemplateOverrides('cat_scad_nameplate', prompt, {
      LETTER_SIZE_MM: clamp(dims.nums[0] ?? 14, 8, 28),
    });
  }

  // K. SHOELACE TAG / SKOLISSE / NØKKELRING
  if (
    lower.includes('skolisse') ||
    lower.includes('nøkkelring') ||
    lower.includes('keychain') ||
    lower.includes('tag')
  ) {
    const isKeychain = lower.includes('nøkkelring') || lower.includes('keychain');
    return applyTemplateOverrides('cat_scad_shoelace_tag', prompt, {
      TAG_LENGTH_MM: clamp(dims.nums[0] ?? 48, 28, 95),
      TAG_WIDTH_MM: clamp(dims.nums[1] ?? 18, 10, 35),
      HOLE_COUNT: isKeychain ? 1 : 2,
    });
  }

  // L0. LITHOPHANE BOX / LITOFANI / LYSBOKS
  if (lower.includes('litofani') || lower.includes('lithophane') || lower.includes('lysboks')) {
    return applyTemplateOverrides('cat_scad_lithophane_box', prompt, {
      BOX_SIZE_MM: clamp(dims.nums[0] ?? 105, 70, 180),
      BOX_HEIGHT_MM: clamp(dims.nums[1] ?? 115, 70, 200),
    });
  }

  // L. WAVE VASE / VASE
  if (lower.includes('vase') || lower.includes('blomsterpotte') || lower.includes('urne')) {
    return applyTemplateOverrides('cat_scad_wave_vase', prompt, {
      BASE_DIAMETER_MM: clamp(dims.diameter ?? dims.nums[0] ?? 92, 50, 180),
      VASE_HEIGHT_MM: clamp(dims.nums[1] ?? 145, 60, 240),
    });
  }

  // M. GEOMETRIC LAMPSHADE / LAMPESKJERM
  if (
    lower.includes('lampe') ||
    lower.includes('lampeskjerm') ||
    lower.includes('e27') ||
    lower.includes('e14') ||
    lower.includes('lykt')
  ) {
    const socketDia = lower.includes('e14') ? 28 : 40;
    return applyTemplateOverrides('cat_scad_geometric_lampshade', prompt, {
      SHADE_DIAMETER_MM: clamp(dims.diameter ?? dims.nums[0] ?? 140, 80, 220),
      SHADE_HEIGHT_MM: clamp(dims.nums[1] ?? 130, 70, 220),
      SOCKET_DIAMETER_MM: socketDia,
    });
  }

  // N. PICTURE FRAME / BILDERAMME
  if (lower.includes('bilderamme') || lower.includes('ramme') || lower.includes('frame')) {
    return applyTemplateOverrides('cat_scad_picture_frame', prompt, {
      PHOTO_WIDTH_MM: clamp(dims.nums[0] ?? 100, 50, 200),
      PHOTO_HEIGHT_MM: clamp(dims.nums[1] ?? 140, 50, 220),
    });
  }

  // 1. SPUR GEAR / TANNHJUL
  if (
    lower.includes('tannhjul') ||
    lower.includes('gear') ||
    lower.includes('tenner') ||
    lower.includes('remskive') ||
    lower.includes('pulley') ||
    lower.includes('gir')
  ) {
    const teeth = dims.teeth ?? 24;
    const bore = clamp(dims.diameter ?? dims.holeDia ?? 8, 3, 30);
    const thickness = clamp(dims.wall ?? dims.nums[0] ?? 12, 4, 40);

    return {
      title: `AI Parametrisk Tannhjul (${teeth}T)`,
      fileName: `ai_parametric_gear_${teeth}t.scad`,
      description: `AI-generert parametrisk tannhjul basert på: «${prompt}». Juster antall tenner, modul, senterhull og nav i sanntid.`,
      category: 'Mekanikk & Maskindeler',
      provider: 'axisforge-cad-synth',
      scadSource: `// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Tannhjul & Geometri] */
// Antall tenner rundt ytterkanten
teeth_count = ${teeth}; // [10:1:64]

// Modul (størrelse per tann i mm)
module_mm = 2.2; // [1.0:0.2:4.5]

// Tykkelse på selve tannhjulet (mm)
gear_thickness_mm = ${thickness}; // [4:1:40]

/* [Nav & Senterhull] */
// Diameter på senterhull for aksling (mm)
bore_diameter_mm = ${bore}; // [3.0:0.5:30.0]

// Ytterdiameter på forsterket senternav (mm)
hub_diameter_mm = ${Math.max(bore + 10, 22)}; // [12:1:55]

// Total høyde inkludert nav (mm)
hub_total_height_mm = ${Math.round(thickness + 6)}; // [6:1:55]

// Antall lettelseshull i skiven
lightening_holes = 6; // [0:1:8]

$fn = 48;

module parametric_spur_gear() {
  pitch_radius = (teeth_count * module_mm) / 2;
  root_radius = max(hub_diameter_mm / 2 + 1, pitch_radius - 1.25 * module_mm);
  outer_radius = pitch_radius + module_mm;
  tooth_width = (3.14159 * module_mm) / 2;

  difference() {
    union() {
      // Rot-sylinder
      cylinder(r = root_radius, h = gear_thickness_mm);

      // Tenner med trapesformet evolvent-profil
      for (i = [0 : teeth_count - 1]) {
        rotate([0, 0, i * (360 / teeth_count)])
          hull() {
            translate([root_radius - 0.5, 0, gear_thickness_mm / 2])
              cube([1.0, tooth_width * 1.15, gear_thickness_mm], center = true);
            translate([outer_radius - 0.4, 0, gear_thickness_mm / 2])
              cube([0.8, tooth_width * 0.58, gear_thickness_mm], center = true);
          }
      }

      // Forsterket senternav
      cylinder(d = min(hub_diameter_mm, root_radius * 1.6), h = max(gear_thickness_mm, hub_total_height_mm));
    }

    // Gjennomgående akselhull
    translate([0, 0, -1])
      cylinder(d = bore_diameter_mm, h = max(gear_thickness_mm, hub_total_height_mm) + 2);

    // Lettelseshull mellom nav og tannkrans
    hole_ring_r = (root_radius + min(hub_diameter_mm, root_radius * 1.4) / 2) / 2;
    hole_r = (root_radius - min(hub_diameter_mm, root_radius * 1.4) / 2) * 0.32;
    if (lightening_holes > 0 && hole_r >= 2.2) {
      for (j = [0 : lightening_holes - 1]) {
        rotate([0, 0, j * (360 / lightening_holes)])
          translate([hole_ring_r, 0, -1])
            cylinder(r = hole_r, h = gear_thickness_mm + 2);
      }
    }
  }
}

parametric_spur_gear();
`,
    };
  }

  // 2. PIPE CLAMP / RØRKLEMME / KABELKLIPS
  if (
    lower.includes('klemme') ||
    lower.includes('clamp') ||
    lower.includes('klips') ||
    lower.includes('clip') ||
    lower.includes('rørholder') ||
    lower.includes('kabelholder')
  ) {
    const pipeDia = clamp(dims.diameter ?? dims.nums[0] ?? 32, 8, 110);
    const width = clamp(dims.nums[1] ?? 24, 10, 60);
    const wall = clamp(dims.wall ?? 4, 2.5, 10);
    const screw = clamp(dims.holeDia ?? 4.5, 2.5, 10);

    return {
      title: `AI Parametrisk Rørklemme (Ø${pipeDia} mm)`,
      fileName: `ai_pipe_clamp_d${pipeDia}.scad`,
      description: `AI-generert parametrisk rør- og kabelklemme basert på: «${prompt}».`,
      category: 'Beslag & Fester',
      provider: 'axisforge-cad-synth',
      scadSource: `// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Rør & Klemme] */
// Diameter på rør eller kabel (mm)
pipe_diameter_mm = ${pipeDia}; // [8:1:110]

// Bredde på klemmen (mm)
clamp_width_mm = ${width}; // [10:2:60]

// Godstykkelse rundt røret (mm)
wall_thickness_mm = ${wall}; // [2.5:0.5:10.0]

// Åpningsbredde i front for klikk-montering (% av rørdiameter)
snap_opening_ratio = 0.72; // [0.40:0.05:0.95]

/* [Festeører & Skruer] */
// Lengde på festeører på hver side (mm)
flange_ear_mm = 16; // [10:1:35]

// Tykkelse på bunnplate (mm)
base_thickness_mm = 5; // [3:0.5:12]

// Skruehulldiameter (mm)
screw_hole_dia_mm = ${screw}; // [3.0:0.5:10.5]

$fn = 48;

module parametric_pipe_clamp() {
  outer_r = pipe_diameter_mm / 2 + wall_thickness_mm;
  inner_r = pipe_diameter_mm / 2;
  center_z = outer_r + base_thickness_mm - wall_thickness_mm * 0.4;
  total_span = outer_r * 2 + flange_ear_mm * 2;
  opening_w = pipe_diameter_mm * snap_opening_ratio;

  difference() {
    union() {
      // Bunnflens med avrundede hjørner
      hull() {
        for (sx = [-1, 1])
          for (sy = [-1, 1])
            translate([sx * (total_span / 2 - 4), sy * (clamp_width_mm / 2 - 4), 0])
              cylinder(r = 4, h = base_thickness_mm);
      }

      // Rørsadel og støttevegger ned til flensen
      hull() {
        translate([0, clamp_width_mm / 2, center_z])
          rotate([90, 0, 0])
            cylinder(r = outer_r, h = clamp_width_mm);
        translate([-outer_r, -clamp_width_mm / 2, 0])
          cube([outer_r * 2, clamp_width_mm, base_thickness_mm]);
      }
    }

    // Rørhull gjennom klemmen
    translate([0, clamp_width_mm / 2 + 1, center_z])
      rotate([90, 0, 0])
        cylinder(r = inner_r, h = clamp_width_mm + 2);

    // Snap-åpning i toppen
    translate([-opening_w / 2, -clamp_width_mm / 2 - 1, center_z])
      cube([opening_w, clamp_width_mm + 2, outer_r + 5]);

    // Monteringshull på begge sider
    for (sx = [-1, 1]) {
      translate([sx * (outer_r + flange_ear_mm * 0.52), 0, -1])
        cylinder(d = screw_hole_dia_mm, h = base_thickness_mm + 10);
    }
  }
}

parametric_pipe_clamp();
`,
    };
  }

  // 3. L-BRACKET / VINKELBRAKETT / HYLLEKNEKT / FESTE
  if (
    lower.includes('brakett') ||
    lower.includes('bracket') ||
    lower.includes('vinkel') ||
    lower.includes('hylle') ||
    lower.includes('veggfeste') ||
    lower.includes('hjørnejern')
  ) {
    const armA = clamp(dims.nums[0] ?? 80, 25, 220);
    const armB = clamp(dims.nums[1] ?? 65, 25, 220);
    const width = clamp(dims.nums[2] ?? 42, 16, 140);
    const wall = clamp(dims.wall ?? 6, 3, 16);
    const screw = clamp(dims.holeDia ?? 5.5, 3, 12);

    return {
      title: `AI Parametrisk Forsterket Vinkelbrakett (${armA}×${armB} mm)`,
      fileName: `ai_reinforced_bracket_${armA}x${armB}.scad`,
      description: `AI-generert parametrisk vinkelbrakett med avstivningsribber basert på: «${prompt}».`,
      category: 'Beslag & Fester',
      provider: 'axisforge-cad-synth',
      scadSource: `// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Hovedmål] */
// Lengde på bunnarm (mm)
base_arm_mm = ${armA}; // [25:5:220]

// Høyde på veggarm (mm)
vertical_arm_mm = ${armB}; // [25:5:220]

// Bredde på braketten (mm)
bracket_width_mm = ${width}; // [16:2:140]

// Godstykkelse på plater (mm)
plate_thickness_mm = ${wall}; // [3.0:0.5:16.0]

/* [Forsterkning & Skruehull] */
// Tykkelse på skrå avstivningsribber på sidene (mm)
rib_thickness_mm = 4.5; // [2.0:0.5:12.0]

// Diameter på skruehull (mm)
screw_hole_dia_mm = ${screw}; // [3.0:0.5:12.0]

// Forsenkingsdiameter for skruehode (mm)
countersink_dia_mm = ${Math.round(screw * 1.9)}; // [6.0:0.5:22.0]

$fn = 40;

module parametric_reinforced_bracket() {
  difference() {
    union() {
      // Horisontal bunnplate med avrundede fronthjørner
      hull() {
        translate([-bracket_width_mm / 2, 0, 0])
          cube([bracket_width_mm, 6, plate_thickness_mm]);
        for (sx = [-1, 1])
          translate([sx * (bracket_width_mm / 2 - 5), base_arm_mm - 5, 0])
            cylinder(r = 5, h = plate_thickness_mm);
      }

      // Vertikal bakplate med avrundede topphjørner
      hull() {
        translate([-bracket_width_mm / 2, 0, 0])
          cube([bracket_width_mm, plate_thickness_mm, 6]);
        for (sx = [-1, 1])
          translate([sx * (bracket_width_mm / 2 - 5), 0, vertical_arm_mm - 5])
            rotate([-90, 0, 0])
              cylinder(r = 5, h = plate_thickness_mm);
      }

      // To trekantede avstivningsribber (gussets) langs ytterkantene
      for (sx = [-1, 1]) {
        rib_x = sx > 0 ? bracket_width_mm / 2 - rib_thickness_mm : -bracket_width_mm / 2;
        translate([rib_x, plate_thickness_mm - 0.5, plate_thickness_mm - 0.5])
          rotate([90, 0, 90])
            linear_extrude(height = rib_thickness_mm)
              polygon(points = [
                [0, 0],
                [base_arm_mm * 0.72, 0],
                [0, vertical_arm_mm * 0.72]
              ]);
      }
    }

    // Skruehull i bunnplate (2 stk)
    for (py = [base_arm_mm * 0.42, base_arm_mm * 0.78]) {
      translate([0, py, -1])
        cylinder(d = screw_hole_dia_mm, h = plate_thickness_mm + 2);
      translate([0, py, plate_thickness_mm - 2.0])
        cylinder(d1 = screw_hole_dia_mm, d2 = countersink_dia_mm, h = 2.2);
    }

    // Skruehull i vertikal plate (2 stk)
    for (pz = [vertical_arm_mm * 0.42, vertical_arm_mm * 0.78]) {
      translate([0, -1, pz])
        rotate([-90, 0, 0])
          cylinder(d = screw_hole_dia_mm, h = plate_thickness_mm + 2);
      translate([0, plate_thickness_mm - 2.0, pz])
        rotate([-90, 0, 0])
          cylinder(d1 = screw_hole_dia_mm, d2 = countersink_dia_mm, h = 2.2);
    }
  }
}

parametric_reinforced_bracket();
`,
    };
  }

  // 4. STAND / STATIV / MOBILHOLDER / NETTBRETTHOLDER
  if (
    lower.includes('stativ') ||
    lower.includes('stand') ||
    lower.includes('mobil') ||
    lower.includes('telefon') ||
    lower.includes('iphone') ||
    lower.includes('ipad') ||
    lower.includes('nettbrett') ||
    lower.includes('laptop')
  ) {
    const width = clamp(dims.nums[0] ?? 82, 45, 200);
    const depth = clamp(dims.nums[1] ?? 95, 55, 180);
    const height = clamp(dims.nums[2] ?? 88, 45, 180);
    const slotW = clamp(dims.wall ?? 14, 8, 32);

    return {
      title: `AI Parametrisk Bordstativ (${width}×${depth} mm)`,
      fileName: `ai_desk_stand_${width}x${depth}.scad`,
      description: `AI-generert parametrisk bordstativ med kabelgjennomføring basert på: «${prompt}».`,
      category: 'Design & Kontor',
      provider: 'axisforge-cad-synth',
      scadSource: `// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Stativets Dimensjoner] */
// Total bredde på stativet (mm)
stand_width_mm = ${width}; // [45:5:200]

// Dybde på foten (mm)
base_depth_mm = ${depth}; // [55:5:180]

// Høyde på ryggstøtten (mm)
back_height_mm = ${height}; // [45:5:180]

/* [Spor & Vinkel] */
// Bredde på sporet til enheten (mm)
device_slot_mm = ${slotW}; // [8:1:32]

// Høyde på fremre stoppekant (mm)
front_lip_height_mm = 18; // [10:2:36]

// Godstykkelse på rammen (mm)
frame_thickness_mm = 6.5; // [4.0:0.5:12.0]

// Bredde på ladekabel-åpning i midten (mm)
cable_cutout_mm = 26; // [0:2:50]

$fn = 36;

module parametric_desk_stand() {
  difference() {
    union() {
      // Bunnplate
      hull() {
        for (sx = [-1, 1])
          for (sy = [-1, 1])
            translate([sx * (stand_width_mm / 2 - 5), sy * (base_depth_mm / 2 - 5), 0])
              cylinder(r = 5, h = frame_thickness_mm);
      }

      // Fremre hvilespor / vugge
      hull() {
        translate([-stand_width_mm / 2, -base_depth_mm / 2 + 4, 0])
          cube([stand_width_mm, frame_thickness_mm, front_lip_height_mm]);
        translate([-stand_width_mm / 2, -base_depth_mm / 2, 0])
          cube([stand_width_mm, frame_thickness_mm + device_slot_mm + 6, frame_thickness_mm]);
      }

      // Skrå ryggstøtte med trekantede sidevanger
      hull() {
        translate([-stand_width_mm / 2, -base_depth_mm / 2 + device_slot_mm + 6, 0])
          cube([stand_width_mm, frame_thickness_mm, frame_thickness_mm]);
        translate([-stand_width_mm / 2, base_depth_mm * 0.18, back_height_mm - 4])
          cube([stand_width_mm, frame_thickness_mm, 4]);
      }

      // To avstivende sidevanger bak ryggstøtten
      for (sx = [-1, 1]) {
        side_x = sx > 0 ? stand_width_mm / 2 - frame_thickness_mm : -stand_width_mm / 2;
        hull() {
          translate([side_x, base_depth_mm * 0.18, back_height_mm * 0.65])
            cube([frame_thickness_mm, frame_thickness_mm, 4]);
          translate([side_x, base_depth_mm / 2 - 8, 0])
            cube([frame_thickness_mm, 8, frame_thickness_mm]);
        }
      }
    }

    // Ladekabel-utsparing i midten foran
    if (cable_cutout_mm > 0) {
      translate([-cable_cutout_mm / 2, -base_depth_mm / 2 - 2, -1])
        cube([cable_cutout_mm, device_slot_mm + 16, front_lip_height_mm + 4]);
    }
  }
}

parametric_desk_stand();
`,
    };
  }

  // 5. FLANGE / ADAPTER / SLANGEOVERGANG / RØRFESTE
  if (
    lower.includes('flens') ||
    lower.includes('flange') ||
    lower.includes('adapter') ||
    lower.includes('overgang') ||
    lower.includes('stuss') ||
    lower.includes('kobling') ||
    lower.includes('foring') ||
    lower.includes('bøssing') ||
    lower.includes('spacer')
  ) {
    const outerDia = clamp(dims.nums[0] ?? dims.diameter ?? 85, 25, 220);
    const boreDia = clamp(dims.nums[1] ?? Math.round(outerDia * 0.42), 8, outerDia - 14);
    const height = clamp(dims.nums[2] ?? 48, 15, 160);
    const screw = clamp(dims.holeDia ?? 5.5, 3, 12);

    return {
      title: `AI Parametrisk Flens & Røradapter (Ø${outerDia} mm)`,
      fileName: `ai_flange_adapter_d${outerDia}.scad`,
      description: `AI-generert parametrisk flens og røradapter basert på: «${prompt}».`,
      category: 'Beslag & Fester',
      provider: 'axisforge-cad-synth',
      scadSource: `// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Flens & Rørstuss] */
// Ytterdiameter på bunnflens (mm)
flange_diameter_mm = ${outerDia}; // [30:5:220]

// Innvendig gjennomgående hulldiameter (mm)
inner_bore_mm = ${boreDia}; // [8:1:150]

// Total høyde på adapteren (mm)
total_height_mm = ${height}; // [15:2:160]

// Tykkelse på bunnflensen (mm)
flange_thickness_mm = 7; // [3:1:20]

// Veggtjukkelse på rørstussen (mm)
wall_thickness_mm = ${clamp(dims.wall ?? 4.5, 2.5, 12)}; // [2.5:0.5:12.0]

/* [Festehull] */
// Antall skruehull i flensen
screw_count = 4; // [0:1:8]

// Diameter på skruehull (mm)
screw_hole_dia_mm = ${screw}; // [3.0:0.5:12.0]

$fn = 48;

module parametric_flange_adapter() {
  collar_od = inner_bore_mm + wall_thickness_mm * 2;
  bolt_circle_r = (flange_diameter_mm / 2 + collar_od / 2) / 2;

  difference() {
    union() {
      // Bunnflens
      cylinder(d = flange_diameter_mm, h = flange_thickness_mm);

      // Konisk forsterkningsovergang + sylinderstuss
      cylinder(d1 = min(flange_diameter_mm * 0.85, collar_od + 12), d2 = collar_od, h = min(total_height_mm, flange_thickness_mm + 12));
      cylinder(d = collar_od, h = total_height_mm);
    }

    // Gjennomgående senterhull
    translate([0, 0, -1])
      cylinder(d = inner_bore_mm, h = total_height_mm + 2);

    // Skruehull rundt boltsirkelen
    if (screw_count > 0 && bolt_circle_r > collar_od / 2 + screw_hole_dia_mm / 2) {
      for (i = [0 : screw_count - 1]) {
        rotate([0, 0, i * (360 / screw_count)])
          translate([bolt_circle_r, 0, -1])
            cylinder(d = screw_hole_dia_mm, h = flange_thickness_mm + 10);
      }
    }
  }
}

parametric_flange_adapter();
`,
    };
  }

  // 6. DEFAULT / ORGANIZER BOX / ENCLOSURE / TRAY / CUSTOM PART
  const width = clamp(dims.explicitWidth ?? dims.nums[0] ?? 135, 30, 240);
  const depth = clamp(dims.explicitDepth ?? dims.nums[1] ?? 95, 30, 240);
  const height = clamp(dims.explicitHeight ?? dims.nums[2] ?? 52, 15, 180);
  const wall = clamp(dims.wall ?? 3.2, 1.8, 8);
  const compX = clamp(dims.compartments ?? 3, 1, 6);
  const customTxt = dims.customText ?? 'AXIS';

  return {
    title: `AI Parametrisk Oppbevaringsboks (${width}×${depth}×${height} mm, ${compX} rom)`,
    fileName: `ai_parametric_box_${width}x${depth}x${height}.scad`,
    description: `AI-generert parametrisk boks/kabinett med ${compX} rom og 3D-tekst basert på: «${prompt}».`,
    category: 'Bokser & Organisering',
    provider: 'axisforge-cad-synth',
    scadSource: `include <BOSL2/std.scad>

// ============================================================================
// AxisForge AI OpenSCAD Generator
// Prompt: ${prompt.replace(/\r?\n/g, ' ')}
// ============================================================================

/* [Ytre Dimensjoner] */
// Ytre bredde i X-retning (mm)
width_mm = ${width}; // [30:5:240]

// Ytre dybde i Y-retning (mm)
depth_mm = ${depth}; // [30:5:240]

// Total høyde i Z-retning (mm)
height_mm = ${height}; // [15:5:180]

/* [Vegger, Rom & 3D-Tekst] */
// Vegg- og bunntykkelse (mm)
wall_thickness_mm = ${wall}; // [1.8:0.2:8.0]

// Hjørneradius (mm)
corner_radius_mm = 6; // [2:1:20]

// Antall rom i bredden (X)
compartments_x = ${compX}; // [1:1:6]

// Antall rom i dybden (Y)
compartments_y = 2; // [1:1:4]

// Egendefinert 3D-tekst i front (maks 12 tegn)
CUSTOM_TEXT = "${customTxt}"; // [12]

/* [Monteringsører] */
// Vis festeører på sidene (0 = nei, 1 = ja)
enable_mounting_ears = 0; // [0:Uten festeører, 1:Med festeører]

// Skruehulldiameter i festeører (mm)
ear_hole_dia_mm = ${dims.holeDia ?? 4.5}; // [3.0:0.5:8.0]

/* [Hidden] */
$fn = 36;

module rounded_rect_prism(w, d, h, r) {
  safe_r = min(r, min(w, d) / 2 - 0.5);
  hull() {
    for (sx = [-1, 1])
      for (sy = [-1, 1])
        translate([sx * (w / 2 - safe_r), sy * (d / 2 - safe_r), 0])
          cylinder(r = safe_r, h = h);
  }
}

module parametric_organizer_box() {
  inner_w = width_mm - wall_thickness_mm * 2;
  inner_d = depth_mm - wall_thickness_mm * 2;
  inner_r = max(1.5, corner_radius_mm - wall_thickness_mm);

  union() {
    // Ytre skall minus innvendig hulrom
    difference() {
      rounded_rect_prism(width_mm, depth_mm, height_mm, corner_radius_mm);
      translate([0, 0, wall_thickness_mm])
        rounded_rect_prism(inner_w, inner_d, height_mm, inner_r);
    }

    // Skillevegger i X-retning
    if (compartments_x > 1) {
      for (ix = [1 : compartments_x - 1]) {
        pos_x = -inner_w / 2 + ix * (inner_w / compartments_x);
        translate([pos_x - wall_thickness_mm * 0.4, -inner_d / 2, wall_thickness_mm])
          cube([wall_thickness_mm * 0.8, inner_d, height_mm - wall_thickness_mm - 1.5]);
      }
    }

    // Skillevegger i Y-retning
    if (compartments_y > 1) {
      for (iy = [1 : compartments_y - 1]) {
        pos_y = -inner_d / 2 + iy * (inner_d / compartments_y);
        translate([-inner_w / 2, pos_y - wall_thickness_mm * 0.4, wall_thickness_mm])
          cube([inner_w, wall_thickness_mm * 0.8, height_mm - wall_thickness_mm - 1.5]);
      }
    }

    // 3D-tekstmerke på forsiden av boksen
    translate([0, -depth_mm / 2 - 0.6, height_mm * 0.5])
      rotate([90, 0, 0])
        extrude_text(CUSTOM_TEXT, size = min(9, height_mm * 0.25), h = 1.6);

    // Valgfrie festeører i bunnen
    if (enable_mounting_ears > 0) {
      for (sx = [-1, 1]) {
        difference() {
          hull() {
            translate([sx * (width_mm / 2 - 2), -12, 0])
              cube([2, 24, wall_thickness_mm * 1.4]);
            translate([sx * (width_mm / 2 + 8), 0, 0])
              cylinder(r = 8, h = wall_thickness_mm * 1.4);
          }
          translate([sx * (width_mm / 2 + 8), 0, -1])
            cylinder(d = ear_hole_dia_mm, h = wall_thickness_mm * 2 + 2);
        }
      }
    }
  }
}

parametric_organizer_box();
`,
  };
}

const SYSTEM_PROMPT = `You are an expert, high-precision OpenSCAD code generator for the AxisForge 3D Print-on-Demand platform.
Your job is to output structurally sound, syntactically correct, and 100% manifold OpenSCAD (.scad) code based on the user's request.

[CRITICAL INSTRUCTIONS]
1. Return ONLY valid JSON with keys:
   - "title" (Norwegian title of the part, e.g. "Pikachu Kakeform (85 mm)")
   - "fileName" (lowercase snake_case ending in .scad)
   - "description" (concise Norwegian description explaining the design and changes)
   - "category" (Norwegian category: "Bokser & Organisering", "Former & Verktøy", "Smykker & Mote", "Pynt & Interiør", or "Mekanikk & Beslag")
   - "scadSource" (raw OpenSCAD code ONLY, no markdown backticks)
2. AVAILABLE LIBRARIES & PRIMITIVES:
   Always start "scadSource" with:
   include <BOSL2/std.scad>
   You may also include <BOSL2/screws.scad> when threads are needed.
   ONLY use standard OpenSCAD builtins (cube, cylinder, sphere, circle, square, polygon, hull, offset, linear_extrude, rotate_extrude, union, difference, intersection, translate, rotate, scale, mirror) AND these pre-mounted BOSL2 modules:
   - Constants: BOTTOM, TOP, CENTER, LEFT, RIGHT, FRONT, FWD, BACK
   - Transforms & copies: up(z), down(z), left(x), right(x), fwd(y), back(y), xrot(a), yrot(a), zrot(a), zrot_copies(n, r), line_copies(spacing, n), grid_copies(spacing, n)
   - 3D Primitives: cuboid(size, rounding, chamfer, anchor), cyl(d, r, d1, d2, h, l, rounding, chamfer, anchor), tube(od, id, wall, h, anchor), rect_tube(size, wall, h, rounding, anchor), prismoid(size1, size2, h, rounding, anchor), torus(d_maj, d_min, r_maj, r_min, anchor), pie_slice(ang, l, r, d, anchor)
   - 2D Primitives: rect(size, rounding, center), oval(d, r), star(n, r, ir, d, id)
   - 3D Text: extrude_text(txt, size, h)  <-- ALWAYS use extrude_text() for 3D text; NEVER call native text() because system fonts are not mounted in WebAssembly.
   - Threads (<BOSL2/screws.scad>): threaded_rod(d, l, h, pitch, internal, anchor), threaded_nut(od, id, h, pitch, anchor)
   NEVER call unmounted functions like stroke(), path_sweep(), skin(), vnf_vertex_array(), teardrop(), or regular_ngon().
3. PARAMETRIC VARIABLE BLOCK: Place 4 to 7 adjustable numeric variables at the very top of "scadSource" using clear UPPERCASE names (e.g. OUTER_DIAMETER_MM, CUTTER_HEIGHT_MM, INNER_WIDTH, WALL_THICKNESS) with Norwegian Customizer comments and [min:step:max] ranges so our frontend automatically builds HTML sliders:
   /* [Global] */
   // Ytterstørrelse på modellen (mm)
   OUTER_DIAMETER_MM = 85; // [45:5:160]
   // Veggtykkelse (mm)
   BLADE_WALL_MM = 1.2; // [0.8:0.1:2.4]
4. COOKIE CUTTERS, SILHOUETTES & CHARACTERS:
   When the user asks for a cookie cutter (kakeform/pepperkakeform) or asks to change a model into a character/animal/symbol/silhouette (e.g. Pikachu, cat, dog, dinosaur, heart, Batman, car, snowman, etc.):
   - Write a dedicated 2D module (e.g. module custom_motif_2d(r)) using overlapping 2D shapes (circle, oval, polygon, rect, hull, translate, rotate, scale, union, difference) that forms a clear, unmistakable, single-piece connected 2D silhouette of that exact character/object scaled to radius r = OUTER_DIAMETER_MM / 2.
   - Extrude the sharp cutting wall:
     linear_extrude(height = CUTTER_HEIGHT_MM)
       difference() {
         custom_motif_2d(r_outer);
         offset(r = -BLADE_WALL_MM) custom_motif_2d(r_outer);
       }
   - Extrude the ergonomic top press flange at Z = 0:
     linear_extrude(height = HANDLE_THICKNESS_MM)
       difference() {
         offset(r = HANDLE_FLANGE_MM) custom_motif_2d(r_outer);
         offset(r = -BLADE_WALL_MM) custom_motif_2d(r_outer);
       }
5. 3D PRINT OPTIMIZATION: Keep code concise (60 to 130 lines), 100% manifold (watertight), resting on Z >= 0. Set $fn = 48;. Never use import() or surface().`;

const GEMINI_FLASH_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
] as const;
const GEMINI_PRO_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-4-argon',
  'gemini-3.5-flash-lite',
] as const;

function modifyExistingScadDeterministically(
  baseScadSource: string,
  prompt: string
): GeneratedScadOutput {
  const lower = prompt.toLowerCase();
  const dims = parseDimensionsFromPrompt(prompt);
  const detectedMotif = detectShapeMotifFromPrompt(prompt);
  let updated = baseScadSource;

  // 0. If the active model is the Cookie Cutter (or user asks for a silhouette motif on a cutter),
  // update or upgrade the Cookie Cutter template with the requested SHAPE_TYPE (Katt, Pikachu, Hjerte, etc.)
  if (baseScadSource.includes('CUTTER_HEIGHT_MM')) {
    const existingDia = Number(
      baseScadSource.match(/OUTER_DIAMETER_MM\s*=\s*(\d+(?:\.\d+)?)/)?.[1] ?? 85
    );
    const existingH = Number(
      baseScadSource.match(/CUTTER_HEIGHT_MM\s*=\s*(\d+(?:\.\d+)?)/)?.[1] ?? 18
    );
    const existingWall = Number(
      baseScadSource.match(/BLADE_WALL_MM\s*=\s*(\d+(?:\.\d+)?)/)?.[1] ?? 1.2
    );

    if (detectedMotif !== null) {
      return applyTemplateOverrides(
        'cat_scad_cookie_cutter',
        prompt,
        {
          SHAPE_TYPE: detectedMotif.shapeId,
          OUTER_DIAMETER_MM: clamp(
            dims.diameter ?? dims.explicitWidth ?? dims.nums[0] ?? existingDia,
            45,
            160
          ),
          CUTTER_HEIGHT_MM: clamp(dims.explicitHeight ?? dims.nums[1] ?? existingH, 10, 35),
          BLADE_WALL_MM: clamp(dims.wall ?? existingWall, 0.8, 2.0),
          ...(detectedMotif.pointCount !== undefined
            ? { POINT_COUNT: detectedMotif.pointCount }
            : {}),
          ...(detectedMotif.waveDepth !== undefined
            ? { WAVE_DEPTH_MM: detectedMotif.waveDepth }
            : {}),
        },
        detectedMotif.shapeLabel
      );
    }

    // If user typed a custom name/character on the cookie cutter without numeric dimensions,
    // switch to 3D-Stempel Medaljong (SHAPE_TYPE = 23) with that word embossed in 3D!
    const hasDimensionRequest =
      dims.nums.length > 0 ||
      dims.explicitWidth !== null ||
      dims.explicitDepth !== null ||
      dims.explicitHeight !== null ||
      dims.diameter !== null ||
      dims.wall !== null;

    if (!hasDimensionRequest) {
      const cleanedSubject = prompt
        .replace(
          /\b(?:endre|gjør|bytt|sett|tilpass|lag|form|som|det|den|til|en|ei|et|kakeform(?:en)?|pepperkakeform(?:en)?|med|tekst(?:en)?|graver(?:ing)?)\b/gi,
          ' '
        )
        .replace(/[^a-zA-ZæøåÆØÅ0-9 -]/g, '')
        .trim()
        .toUpperCase();

      const stampWord = (dims.customText || cleanedSubject || 'AXIS').slice(0, 12);
      return applyTemplateOverrides(
        'cat_scad_cookie_cutter',
        prompt,
        {
          SHAPE_TYPE: 23,
          OUTER_DIAMETER_MM: existingDia,
          CUTTER_HEIGHT_MM: existingH,
          BLADE_WALL_MM: existingWall,
        },
        `3D-Stempel «${stampWord}»`,
        stampWord
      );
    }
  }

  // If the prompt explicitly requests a specific model category that isn't in baseScadSource,
  // synthesize the matching parametric template directly.
  const asksForCompartments = /(\d+)\s*(?:rom|skillevegg|rute|avdeling)/i.test(prompt);
  const hasCompartmentVars = /(?:COMPARTMENTS_X|COLS|GRID_X|compartments_x)/.test(baseScadSource);
  const isDefaultFlangeOrBoxRequest =
    baseScadSource.includes('collar_height') ||
    lower.includes('boks') ||
    lower.includes('kasse') ||
    lower.includes('skuff');

  const asksForNewModelType =
    (lower.includes('gridfinity') && !baseScadSource.includes('GRID_X')) ||
    ((lower.includes('rugged') || lower.includes('verktøykasse')) &&
      !baseScadSource.includes('LATCH_COUNT')) ||
    ((lower.includes('krukke') || lower.includes('skrulokk')) &&
      !baseScadSource.includes('JAR_DIAMETER_MM')) ||
    (lower.includes('signet') && !baseScadSource.includes('RING_DIAMETER_MM')) ||
    (lower.includes('vase') && !baseScadSource.includes('VASE_HEIGHT_MM')) ||
    ((lower.includes('lampeskjerm') || lower.includes('e27')) &&
      !baseScadSource.includes('SHADE_DIAMETER_MM')) ||
    (lower.includes('trakt') && !baseScadSource.includes('SPOUT_DIAMETER_MM')) ||
    ((lower.includes('kakeform') || lower.includes('pepperkake')) &&
      !baseScadSource.includes('CUTTER_HEIGHT_MM')) ||
    (lower.includes('navneskilt') && !baseScadSource.includes('LETTER_SIZE_MM')) ||
    (lower.includes('litofani') && !baseScadSource.includes('SLIT_THICKNESS_MM')) ||
    (asksForCompartments && !hasCompartmentVars && isDefaultFlangeOrBoxRequest);

  if (asksForNewModelType) {
    return synthesizeParametricScadFromPrompt(prompt);
  }

  // 1. Custom text engraving/embossing (either in quotes or after tekst/navn/graver)
  if (dims.customText) {
    if (/CUSTOM_TEXT\s*=/.test(updated)) {
      updated = updated.replace(
        /(^\s*CUSTOM_TEXT\s*=\s*)"[^"]*"/m,
        `$1"${dims.customText}"`
      );
    } else {
      if (!updated.includes('BOSL2/std.scad')) {
        updated = `include <BOSL2/std.scad>\n\n${updated}`;
      }
      const injectTarget = updated.match(/^(\/\*\s*\[Hidden\]\s*\*\/|\$fn\s*=)/m);
      const customTextBlock = `/* [AI 3D-Tekst] */\n// 3D-tekst lagt til av AI (maks 12 tegn)\nCUSTOM_TEXT = "${dims.customText}"; // [12]\n\n`;
      if (injectTarget && injectTarget.index !== undefined) {
        updated =
          updated.slice(0, injectTarget.index) +
          customTextBlock +
          updated.slice(injectTarget.index);
      } else {
        updated = customTextBlock + updated;
      }
      updated = `${updated}\n// AI-påført 3D-tekstrelieff\ntranslate([0, 0, 0])\n  extrude_text(CUSTOM_TEXT, size = 10, h = 6);\n`;
    }
  }

  // 2. Compartments / dividers (e.g. "3 rom", "4 skillevegger")
  if (dims.compartments !== null) {
    for (const v of ['COMPARTMENTS_X', 'COLS', 'GRID_X', 'compartments_x']) {
      const re = new RegExp(`(^\\s*${v}\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`, 'm');
      if (re.test(updated)) {
        updated = updated.replace(re, `$1${dims.compartments}`);
        break;
      }
    }
  }

  const replaceFirstMatchingVar = (vars: string[], val: number) => {
    for (const v of vars) {
      const re = new RegExp(`(^\\s*${v}\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`, 'm');
      if (re.test(updated)) {
        updated = updated.replace(re, `$1${val}`);
        return true;
      }
    }
    return false;
  };

  const widthVars = [
    'INNER_WIDTH',
    'OUTER_DIAMETER_MM',
    'TOP_DIAMETER_MM',
    'JAR_DIAMETER_MM',
    'RING_DIAMETER_MM',
    'WRIST_DIAMETER_MM',
    'TAG_LENGTH_MM',
    'BASE_DIAMETER_MM',
    'SHADE_DIAMETER_MM',
    'PHOTO_WIDTH_MM',
    'BOX_SIZE_MM',
    'width_mm',
    'plate_length',
    'outer_diameter',
    'flange_diameter_mm',
    'base_arm_mm',
    'stand_width_mm',
  ];
  const lenVars = [
    'INNER_LENGTH',
    'CUTTER_HEIGHT_MM',
    'SPOUT_DIAMETER_MM',
    'JAR_HEIGHT_MM',
    'BAND_WIDTH_MM',
    'CUFF_WIDTH_MM',
    'TAG_WIDTH_MM',
    'VASE_HEIGHT_MM',
    'SHADE_HEIGHT_MM',
    'PHOTO_HEIGHT_MM',
    'BOX_HEIGHT_MM',
    'depth_mm',
    'plate_width',
    'inner_bore',
    'inner_bore_mm',
    'vertical_arm_mm',
    'base_depth_mm',
  ];
  const heightVars = [
    'INNER_HEIGHT',
    'HEIGHT_UNITS',
    'CONE_HEIGHT_MM',
    'JAR_HEIGHT_MM',
    'VASE_HEIGHT_MM',
    'SHADE_HEIGHT_MM',
    'BOX_HEIGHT_MM',
    'height_mm',
    'collar_height',
    'total_height_mm',
    'back_height_mm',
  ];

  if (dims.explicitWidth !== null) {
    replaceFirstMatchingVar(widthVars, dims.explicitWidth);
  }
  if (dims.explicitDepth !== null) {
    replaceFirstMatchingVar(lenVars, dims.explicitDepth);
  }
  if (dims.explicitHeight !== null) {
    replaceFirstMatchingVar(heightVars, dims.explicitHeight);
  }
  if (dims.diameter !== null) {
    replaceFirstMatchingVar(widthVars, dims.diameter);
  }

  // If no explicit keyword matched, apply positional numbers from prompt
  if (dims.explicitWidth === null && dims.explicitDepth === null && dims.explicitHeight === null) {
    if (dims.nums[0] !== undefined) replaceFirstMatchingVar(widthVars, dims.nums[0]);
    if (dims.nums[1] !== undefined) replaceFirstMatchingVar(lenVars, dims.nums[1]);
    if (dims.nums[2] !== undefined) replaceFirstMatchingVar(heightVars, dims.nums[2]);
  }

  if (dims.wall !== null) {
    updated = updated.replace(
      /(^\s*(?:WALL_THICKNESS|wall_thickness_mm|BLADE_WALL_MM|collar_wall|plate_thickness|flange_thickness|plate_thickness_mm)\s*=\s*)(-?\d+(?:\.\d+)?)/m,
      `$1${Math.max(1.2, dims.wall)}`
    );
  }

  // Guarantee visible change if no specific variable name matched yet
  if (updated === baseScadSource) {
    const firstVarMatch = updated.match(
      /(^\s*[A-Z_a-z][A-Z_a-z0-9]*\s*=\s*)(-?\d+(?:\.\d+)?)(\s*;\s*\/\/\s*\[(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?):(-?\d+(?:\.\d+)?)\])/m
    );
    if (firstVarMatch) {
      const currentVal = Number(firstVarMatch[2]);
      const minVal = Number(firstVarMatch[4]);
      const maxVal = Number(firstVarMatch[6]);
      const targetVal =
        dims.nums[0] !== undefined
          ? clamp(dims.nums[0], minVal, maxVal)
          : clamp(Math.round(currentVal * 1.25), minVal, maxVal);
      const nextVal = targetVal === currentVal ? clamp(minVal + (maxVal - minVal) * 0.7, minVal, maxVal) : targetVal;
      updated = updated.replace(firstVarMatch[0], `${firstVarMatch[1]}${nextVal}${firstVarMatch[3]}`);
    }
  }

  return {
    title: `AI-tilpasset: ${prompt.slice(0, 38)}`,
    fileName: 'ai_modified_template.scad',
    description: `Eksisterende .scad-mal oppdatert etter ønske: «${prompt}».`,
    category: 'AI Kode-fikser (.SCAD)',
    scadSource: updated,
    provider: 'axisforge-cad-synth',
  };
}

function summarizeBaseScadForPrompt(baseScadSource: string, prompt: string): string {
  const lines = baseScadSource.split(/\r?\n/);
  // If baseScadSource is our large multi-shape Cookie Cutter template, extract only the
  // header + Customizer parameters + outer cutter extrusion pattern so Gemini writes a
  // dedicated, custom 2D silhouette module for the user's prompt instead of echoing 350 lines.
  if (baseScadSource.includes('CUTTER_HEIGHT_MM') && lines.length > 100) {
    const fnIndex = lines.findIndex((l) => /^\s*\$fn\s*=/.test(l));
    const headerBlock = lines.slice(0, fnIndex > 0 ? fnIndex + 1 : 40).join('\n');
    return `Eksisterende basismal er en parametrisk Kakeform / Utstikker med disse Customizer-parametrene:\n\n${headerBlock}\n\nKundens ønske: "${prompt}"\nSkriv en komplett, skreddersydd OpenSCAD (.scad) kakeform/utstikker som oppfyller kundens ønske (f.eks. lag en egen module custom_motif_2d(r) med tydelig, gjenkjennelig 2D-silhuett for motivet kunden ber om, ekstruder skjærebladet i høyden CUTTER_HEIGHT_MM med veggtykkelse BLADE_WALL_MM, og ekstruder presskanten/flensen i høyden HANDLE_THICKNESS_MM med bredde HANDLE_FLANGE_MM ved Z=0). Behold relevante UPPERCASE Customizer-variabler i toppen.`;
  }

  return `Her er vår eksisterende OpenSCAD (.scad) basismal:\n\n${baseScadSource}\n\nKundens ønske til endring/tilpasning: "${prompt}"\nModifiser basismalen slik at den oppfyller kundens ønske, behold eksisterende UPPERCASE Customizer-variabler i toppen (og legg til nye ved behov), og returner kun gyldig JSON med den oppdaterte koden i "scadSource".`;
}

export class ScadAiGeneratorService {
  static hasConfiguredAiProvider(): boolean {
    return Boolean(
      resolveServerEnvKey('GEMINI_API_KEY') ||
        resolveServerEnvKey('OPENAI_API_KEY') ||
        resolveServerEnvKey('ANTHROPIC_API_KEY')
    );
  }

  static async generateScadFromPrompt(
    prompt: string,
    modelTier: ScadAiModelTier = 'flash',
    baseScadSource?: string
  ): Promise<GeneratedScadOutput> {
    const effectiveUserPrompt = baseScadSource
      ? summarizeBaseScadForPrompt(baseScadSource, prompt)
      : prompt;

    const geminiKey = resolveServerEnvKey('GEMINI_API_KEY');
    if (geminiKey) {
      const candidateModels = modelTier === 'pro' ? GEMINI_PRO_CHAIN : GEMINI_FLASH_CHAIN;
      for (const modelName of candidateModels) {
        try {
          const timeoutMs = modelName === 'gemini-4-argon' ? 35000 : 25000;
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(timeoutMs),
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: effectiveUserPrompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.15,
                },
              }),
            }
          );

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson) as Partial<GeneratedScadOutput>;
              if (parsed.scadSource && parsed.scadSource.length > 30) {
                return {
                  title: parsed.title || 'AI-generert OpenSCAD-modell',
                  fileName: (parsed.fileName || 'ai_model.scad').endsWith('.scad')
                    ? parsed.fileName || 'ai_model.scad'
                    : `${parsed.fileName}.scad`,
                  description: parsed.description || `AI-generert .scad fra: ${prompt}`,
                  category: parsed.category || 'AI Parametrisk .SCAD',
                  scadSource: parsed.scadSource,
                  provider: 'gemini',
                  usedModel: modelName,
                };
              }
            }
          }
        } catch {
          // Try next Gemini model or fall back below
        }
      }
    }

    const openAiKey = resolveServerEnvKey('OPENAI_API_KEY');
    if (openAiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: effectiveUserPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const rawJson = data.choices?.[0]?.message?.content;
          if (rawJson) {
            const parsed = JSON.parse(rawJson) as Partial<GeneratedScadOutput>;
            if (parsed.scadSource && parsed.scadSource.length > 30) {
              return {
                title: parsed.title || 'AI-generert OpenSCAD-modell',
                fileName: (parsed.fileName || 'ai_model.scad').endsWith('.scad')
                  ? parsed.fileName || 'ai_model.scad'
                  : `${parsed.fileName}.scad`,
                description: parsed.description || `AI-generert .scad fra: ${prompt}`,
                category: parsed.category || 'AI Parametrisk .SCAD',
                scadSource: parsed.scadSource,
                provider: 'openai',
                usedModel: 'gpt-4o-mini',
              };
            }
          }
        }
      } catch {
        // Fall back to next provider
      }
    }

    const anthropicKey = resolveServerEnvKey('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-latest',
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: effectiveUserPrompt }],
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            content?: { type: string; text?: string }[];
          };
          const rawText = data.content?.find((c) => c.type === 'text')?.text;
          if (rawText) {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedScadOutput>;
              if (parsed.scadSource && parsed.scadSource.length > 30) {
                return {
                  title: parsed.title || 'AI-generert OpenSCAD-modell',
                  fileName: (parsed.fileName || 'ai_model.scad').endsWith('.scad')
                    ? parsed.fileName || 'ai_model.scad'
                    : `${parsed.fileName}.scad`,
                  description: parsed.description || `AI-generert .scad fra: ${prompt}`,
                  category: parsed.category || 'AI Parametrisk .SCAD',
                  scadSource: parsed.scadSource,
                  provider: 'anthropic',
                  usedModel: 'claude-3-5-sonnet',
                };
              }
            }
          }
        }
      } catch {
        // Fall back to deterministic CAD synthesizer below
      }
    }

    if (baseScadSource) {
      return modifyExistingScadDeterministically(baseScadSource, prompt);
    }

    return synthesizeParametricScadFromPrompt(prompt);
  }

  static async repairScadWithGemini(
    brokenOutput: GeneratedScadOutput,
    compilerError: string,
    originalPrompt: string
  ): Promise<GeneratedScadOutput | null> {
    const geminiKey = resolveServerEnvKey('GEMINI_API_KEY');
    if (!geminiKey) return null;

    const repairPrompt = `Følgende OpenSCAD (.scad) kode ble generert for brukerens ønske "${originalPrompt}", men OpenSCAD WebAssembly-kompilatoren feilet med meldingen:\n\nKOMPILATORFEIL:\n${compilerError}\n\nFEILENDE SCAD-KODE:\n${brokenOutput.scadSource}\n\nRett opp syntaks- eller geometrifeilen slik at koden kompilerer 100% feilfritt i OpenSCAD (bruk kun innebygde OpenSCAD-primitiver som circle, polygon, square, cube, cylinder, sphere, hull, offset, linear_extrude, rotate_extrude, union, difference, intersection, translate, rotate, scale, mirror samt <BOSL2/std.scad>-modulene cuboid, cyl, tube, rect_tube, prismoid, torus, pie_slice, extrude_text). Returner kun gyldig JSON med samme struktur.`;

    for (const modelName of GEMINI_FLASH_CHAIN) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
          }
        );

        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsed = JSON.parse(rawJson) as Partial<GeneratedScadOutput>;
            if (parsed.scadSource && parsed.scadSource.length > 30) {
              return {
                title: parsed.title || brokenOutput.title,
                fileName: brokenOutput.fileName,
                description: parsed.description || brokenOutput.description,
                category: parsed.category || brokenOutput.category,
                scadSource: parsed.scadSource,
                provider: 'gemini',
                usedModel: modelName,
              };
            }
          }
        }
      } catch {
        // Try next model in repair chain
      }
    }
    return null;
  }

  static synthesizeFallback(prompt: string, baseScadSource?: string): GeneratedScadOutput {
    if (baseScadSource) {
      return modifyExistingScadDeterministically(baseScadSource, prompt);
    }
    return synthesizeParametricScadFromPrompt(prompt);
  }
}

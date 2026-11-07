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
  diameter: number | null;
  holeDia: number | null;
  wall: number | null;
  teeth: number | null;
}

/**
 * Extracts explicit millimeter dimensions, M-thread sizes (M3..M10), diameters (Ø),
 * wall thicknesses, and tooth counts from a Norwegian or English natural-language prompt.
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
  const holeExplicit = lower.match(/(?:hull|hole|skruehull|boring)\D{0,12}?(\d+(?:[.,]\d+)?)/);
  if (!holeDia && holeExplicit && holeExplicit[1]) {
    holeDia = Number(holeExplicit[1].replace(',', '.'));
  }

  // Check for diameter (Ø, dia, diameter, rør)
  let diameter: number | null = null;
  const diaMatch = lower.match(/(?:ø|diameter|dia|rør|aksel)\D{0,10}?(\d+(?:[.,]\d+)?)/);
  if (diaMatch && diaMatch[1]) {
    diameter = Number(diaMatch[1].replace(',', '.'));
  }

  // Check for wall thickness
  let wall: number | null = null;
  const wallMatch = lower.match(
    /(?:vegg|veggtykkelse|tykkelse|wall|gods)\D{0,10}?(\d+(?:[.,]\d+)?)/
  );
  if (wallMatch && wallMatch[1]) {
    wall = Number(wallMatch[1].replace(',', '.'));
  }

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
      if (m[1]) nums.push(Number(m[1].replace(',', '.')));
    }
  }

  return { nums, diameter, holeDia, wall, teeth };
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Deterministic parametric OpenSCAD (.scad) synthesizer that turns natural-language
 * prompts into clean, well-structured, 100% manifold OpenSCAD code with Customizer sliders.
 */
function synthesizeParametricScadFromPrompt(prompt: string): GeneratedScadOutput {
  const lower = prompt.toLowerCase();
  const dims = parseDimensionsFromPrompt(prompt);

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
  const width = clamp(dims.nums[0] ?? 110, 30, 240);
  const depth = clamp(dims.nums[1] ?? 80, 30, 240);
  const height = clamp(dims.nums[2] ?? 45, 15, 180);
  const wall = clamp(dims.wall ?? 3.2, 1.8, 8);

  return {
    title: `AI Parametrisk Oppbevaringsboks (${width}×${depth}×${height} mm)`,
    fileName: `ai_parametric_box_${width}x${depth}x${height}.scad`,
    description: `AI-generert parametrisk boks/kabinett med justerbare skillevegger og festeører basert på: «${prompt}».`,
    category: 'Oppbevaring & Kabinett',
    provider: 'axisforge-cad-synth',
    scadSource: `// ============================================================================
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

/* [Vegger & Indeling] */
// Vegg- og bunntykkelse (mm)
wall_thickness_mm = ${wall}; // [1.8:0.2:8.0]

// Hjørneradius (mm)
corner_radius_mm = 6; // [2:1:20]

// Antall rom i bredden (X)
compartments_x = 2; // [1:1:6]

// Antall rom i dybden (Y)
compartments_y = 2; // [1:1:4]

/* [Monteringsører] */
// Vis festeører på sidene (0 = nei, 1 = ja)
enable_mounting_ears = 0; // [0:Uten festeører, 1:Med festeører]

// Skruehulldiameter i festeører (mm)
ear_hole_dia_mm = ${dims.holeDia ?? 4.5}; // [3.0:0.5:8.0]

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

const SYSTEM_PROMPT = `You are a Principal CAD & OpenSCAD Engineer for AxisForge 3D Printing Studio.
Write a complete, 100% valid, watertight OpenSCAD (.scad) script for the user's request.
Strict rules:
1. Return ONLY valid JSON with keys: "title" (Norwegian), "fileName" (lowercase snake_case ending in .scad), "description" (Norwegian), "category" (Norwegian), "scadSource" (complete OpenSCAD script).
2. At the top of "scadSource", define 4 to 8 user-customizable numeric parameters using OpenSCAD Customizer syntax:
   /* [Dimensjoner] */
   // Beskrivelse av parameter på norsk
   width_mm = 80; // [20:5:200]
3. Every customizable variable MUST be a plain number assignment (e.g. width_mm = 80; // [20:5:200]) before any modules are defined.
4. Set $fn = 36; and make sure the geometry rests on the build plate (Z >= 0) and uses only standard OpenSCAD primitives (cylinder, cube, sphere, polygon, linear_extrude, rotate_extrude, hull, difference, union, translate, rotate, scale, mirror). Never use import(), surface(), or text() that requires system fonts.`;

const GEMINI_FLASH_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
] as const;
const GEMINI_PRO_CHAIN = [
  'gemini-3.1-pro-preview',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
] as const;

export class ScadAiGeneratorService {
  static async generateScadFromPrompt(
    prompt: string,
    modelTier: ScadAiModelTier = 'flash'
  ): Promise<GeneratedScadOutput> {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey !== 'your-gemini-api-key') {
      const candidateModels = modelTier === 'pro' ? GEMINI_PRO_CHAIN : GEMINI_FLASH_CHAIN;
      for (const modelName of candidateModels) {
        try {
          const timeoutMs = modelName === 'gemini-3.8-flash' ? 10000 : 25000;
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(timeoutMs),
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.2,
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

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey && openAiKey !== 'your-openai-api-key') {
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
              { role: 'user', content: prompt },
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
              };
            }
          }
        }
      } catch {
        // Fall back to next provider
      }
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey !== 'your-anthropic-api-key') {
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
            messages: [{ role: 'user', content: prompt }],
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
                };
              }
            }
          }
        }
      } catch {
        // Fall back to deterministic CAD synthesizer below
      }
    }

    return synthesizeParametricScadFromPrompt(prompt);
  }

  static synthesizeFallback(prompt: string): GeneratedScadOutput {
    return synthesizeParametricScadFromPrompt(prompt);
  }
}

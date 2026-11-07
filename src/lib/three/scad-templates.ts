import type { DimensionsMm, FilamentMaterialCode, ProceduralPreset } from '@/lib/schemas/forge';

export type ScadLibraryCategory =
  | 'Bokser & Organisering'
  | 'Former & Verktøy'
  | 'Smykker & Mote'
  | 'Pynt & Interiør';

export interface ScadTemplateEntry {
  id: string;
  title: string;
  shortTitle: string;
  category: ScadLibraryCategory;
  fileName: string;
  description: string;
  defaultMaterial: FilamentMaterialCode;
  defaultColorHex: string;
  proceduralPreset: ProceduralPreset;
  boundingBoxMm: DimensionsMm;
  volumeCm3: number;
  overhangRatio: number;
  scadSource: string;
}

export const SCAD_LIBRARY_TEMPLATES: ScadTemplateEntry[] = [
  // ==========================================================================
  // 1. BOKSER & ORGANISERING
  // ==========================================================================
  {
    id: 'cat_scad_gridfinity_bin',
    title: 'Gridfinity Oppbevaringsboks (42 mm Standard)',
    shortTitle: 'Gridfinity-boks',
    category: 'Bokser & Organisering',
    fileName: 'gridfinity_bin_master.scad',
    description:
      'Ekte parametrisk Gridfinity-modul (42×42 mm rutenett) med stabelbar toppleppe, valgfrie magnethull i føttene og tilpassbare skillevegger.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#FF5500',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 84, y: 126, z: 42 },
    volumeCm3: 68.0,
    overhangRatio: 0.06,
    scadSource: `include <BOSL2/std.scad>

/* [Gridfinity Rutenett (42mm Standard)] */
// Antall ruter i bredden (1 rute = 42 mm)
GRID_X = 2; // [1:1:5]

// Antall ruter i dybden (1 rute = 42 mm)
GRID_Y = 3; // [1:1:5]

// Høyde-enheter (1 enhet = 7 mm, f.eks. 6 = 42 mm)
HEIGHT_UNITS = 6; // [2:1:14]

/* [Rom & Veggtykkelse] */
// Antall rom på tvers (X)
COMPARTMENTS_X = 2; // [1:1:6]

// Antall rom i lengden (Y)
COMPARTMENTS_Y = 3; // [1:1:6]

// Veggtykkelse i millimeter (min 1.2 mm)
WALL_THICKNESS = 1.8; // [1.2:0.2:3.6]

// Magnethull (Ø6.5 mm) i bunnføttene
MAGNET_HOLES = 1; // [0:Uten magnethull, 1:Med Ø6.5mm magnethull]

/* [Hidden] */
$fn = 36;

UNIT_PITCH = 42.0;
CLEARANCE = 0.5;
OUTER_W = GRID_X * UNIT_PITCH - CLEARANCE;
OUTER_D = GRID_Y * UNIT_PITCH - CLEARANCE;
TOTAL_H = HEIGHT_UNITS * 7.0;
BASE_H = 4.75;
CORNER_R = 3.75;

module gridfinity_foot() {
  foot_w = UNIT_PITCH - CLEARANCE;
  hull() {
    cuboid([foot_w - 4.4, foot_w - 4.4, 0.8], rounding = 1.6, anchor = BOTTOM);
    up(BASE_H - 0.8)
      cuboid([foot_w, foot_w, 0.8], rounding = CORNER_R, anchor = BOTTOM);
  }
}

difference() {
  union() {
    // Gridfinity-føtter (42x42mm matrise)
    for (gx = [0 : GRID_X - 1])
      for (gy = [0 : GRID_Y - 1]) {
        pos_x = -OUTER_W / 2 + (UNIT_PITCH - CLEARANCE) / 2 + gx * UNIT_PITCH;
        pos_y = -OUTER_D / 2 + (UNIT_PITCH - CLEARANCE) / 2 + gy * UNIT_PITCH;
        translate([pos_x, pos_y, 0])
          gridfinity_foot();
      }

    // Hovedkropp + stabelbar toppleppe
    up(BASE_H - 0.02)
      cuboid([OUTER_W, OUTER_D, TOTAL_H - BASE_H + 0.02], rounding = CORNER_R, anchor = BOTTOM);
  }

  // Innvendig hulrom for hvert rom
  inner_total_w = OUTER_W - WALL_THICKNESS * 2;
  inner_total_d = OUTER_D - WALL_THICKNESS * 2;
  cell_w = (inner_total_w - (COMPARTMENTS_X - 1) * WALL_THICKNESS) / COMPARTMENTS_X;
  cell_d = (inner_total_d - (COMPARTMENTS_Y - 1) * WALL_THICKNESS) / COMPARTMENTS_Y;
  floor_z = BASE_H + 1.8;

  for (cx = [0 : COMPARTMENTS_X - 1])
    for (cy = [0 : COMPARTMENTS_Y - 1]) {
      px = -inner_total_w / 2 + cell_w / 2 + cx * (cell_w + WALL_THICKNESS);
      py = -inner_total_d / 2 + cell_d / 2 + cy * (cell_d + WALL_THICKNESS);
      translate([px, py, floor_z])
        cuboid(
          [max(4, cell_w), max(4, cell_d), TOTAL_H - floor_z + 0.05],
          rounding = max(1, CORNER_R - WALL_THICKNESS),
          anchor = BOTTOM
        );
    }

  // Valgfrie Ø6.5x2.4mm magnethull i hjørnene på hver fot
  if (MAGNET_HOLES > 0) {
    for (gx = [0 : GRID_X - 1])
      for (gy = [0 : GRID_Y - 1]) {
        pos_x = -OUTER_W / 2 + (UNIT_PITCH - CLEARANCE) / 2 + gx * UNIT_PITCH;
        pos_y = -OUTER_D / 2 + (UNIT_PITCH - CLEARANCE) / 2 + gy * UNIT_PITCH;
        for (mx = [-1, 1])
          for (my = [-1, 1])
            translate([pos_x + mx * 13, pos_y + my * 13, -0.05])
              cylinder(d = 6.5, h = 2.45);
      }
  }
}
`,
  },

  {
    id: 'cat_scad_rugged_box',
    title: 'Rugged Box / Vanntett Verktøykasse',
    shortTitle: 'Rugged Box',
    category: 'Bokser & Organisering',
    fileName: 'rugged_equipment_box.scad',
    description:
      'Ekstra solid utstyrsboks med utvendige forsterkningsribber, integrerte hengselsøyler bak, låseklemmer i front og pakningsspor i kanten.',
    defaultMaterial: 'PETG_INDUSTRIAL',
    defaultColorHex: '#111111',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 132, y: 98, z: 54 },
    volumeCm3: 94.0,
    overhangRatio: 0.1,
    scadSource: `include <BOSL2/std.scad>

/* [Global] */
// Innvendig bredde (X) i mm
INNER_WIDTH = 115; // [50:5:220]

// Innvendig lengde (Y) i mm
INNER_LENGTH = 80; // [40:5:200]

// Innvendig høyde (Z) i mm
INNER_HEIGHT = 48; // [25:5:140]

// Veggtykkelse (mm)
WALL_THICKNESS = 3.2; // [2.0:0.4:6.0]

/* [Pakning, Hengsler & Klemmer] */
// Bredde på O-ring / pakningsspor i toppen (mm)
SEAL_GROOVE_MM = 2.0; // [1.2:0.2:3.2]

// Antall låseklemmer i front
LATCH_COUNT = 2; // [1:1:3]

// Antall vertikale forsterkningsribber på sidene
RIB_COUNT = 4; // [2:1:6]

/* [Hidden] */
$fn = 36;

OUTER_W = INNER_WIDTH + WALL_THICKNESS * 2 + 4;
OUTER_L = INNER_LENGTH + WALL_THICKNESS * 2 + 4;
TOTAL_H = INNER_HEIGHT + WALL_THICKNESS;

difference() {
  union() {
    // Hovedskall med avrundede hjørner
    cuboid([OUTER_W, OUTER_L, TOTAL_H], rounding = 6, anchor = BOTTOM);

    // Øvre flens/krage for pakning og klemmer
    up(TOTAL_H - 7)
      cuboid([OUTER_W + 5, OUTER_L + 5, 7], rounding = 7, anchor = BOTTOM);

    // Forsterkningsribber langs langsidene
    for (sy = [-1, 1]) {
      for (i = [0 : RIB_COUNT - 1]) {
        rx = -OUTER_W * 0.34 + i * ((OUTER_W * 0.68) / max(1, RIB_COUNT - 1));
        translate([rx, sy * (OUTER_L / 2 + 1.2), 0])
          cuboid([4.5, 3.2, TOTAL_H - 2], rounding = 1.2, anchor = BOTTOM);
      }
    }

    // Låsefester (Latch mounts) i front (Y-)
    for (li = [0 : LATCH_COUNT - 1]) {
      lx = LATCH_COUNT == 1 ? 0 : -OUTER_W * 0.25 + li * (OUTER_W * 0.5 / (LATCH_COUNT - 1));
      translate([lx, -OUTER_L / 2 - 4, TOTAL_H - 14])
        cuboid([18, 6, 14], rounding = 2, anchor = BOTTOM);
    }

    // Hengselknoker (Hinge knuckles) på baksiden (Y+)
    for (hx = [-OUTER_W * 0.28, OUTER_W * 0.28]) {
      translate([hx, OUTER_L / 2 + 4, TOTAL_H - 10])
        cuboid([20, 6, 10], rounding = 2, anchor = BOTTOM);
    }
  }

  // Innvendig hovedrom (+0.02 overlap)
  up(WALL_THICKNESS)
    cuboid([INNER_WIDTH, INNER_LENGTH, INNER_HEIGHT + 0.5], rounding = 3.5, anchor = BOTTOM);

  // Pakningsspor i toppkanten
  up(TOTAL_H - 1.6)
    difference() {
      cuboid(
        [INNER_WIDTH + SEAL_GROOVE_MM * 3, INNER_LENGTH + SEAL_GROOVE_MM * 3, 2.0],
        rounding = 4,
        anchor = BOTTOM
      );
      down(0.05)
        cuboid(
          [INNER_WIDTH + SEAL_GROOVE_MM, INNER_LENGTH + SEAL_GROOVE_MM, 2.2],
          rounding = 3.5,
          anchor = BOTTOM
        );
    }

  // M3 bolt-hull gjennom hengsel og låseklemmer
  for (sy = [-1, 1]) {
    translate([-OUTER_W / 2 - 10, sy * (OUTER_L / 2 + 4.2), TOTAL_H - 5])
      rotate([0, 90, 0])
        cylinder(d = 3.4, h = OUTER_W + 20);
  }
}
`,
  },

  {
    id: 'cat_scad_drawer_organizer',
    title: 'Skuffeoppdeler med Klikk-skjøter',
    shortTitle: 'Skuffeoppdeler',
    category: 'Bokser & Organisering',
    fileName: 'interlocking_drawer_organizer.scad',
    description:
      'Skreddersydd skuffeinnsats med svalehale-klikkfester på sidene slik at flere moduler kan låses sammen i kjøkken- eller kontorskuffen.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#F4F0EA',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 148, y: 108, z: 45 },
    volumeCm3: 62.0,
    overhangRatio: 0.05,
    scadSource: `include <BOSL2/std.scad>

/* [Global] */
// Innvendig bredde (X) i mm
INNER_WIDTH = 140; // [50:5:240]

// Innvendig lengde (Y) i mm
INNER_LENGTH = 100; // [50:5:240]

// Innvendig høyde (Z) i mm
INNER_HEIGHT = 42; // [20:5:120]

// Veggtykkelse (mm)
WALL_THICKNESS = 2.2; // [1.4:0.2:4.0]

/* [Skillevegger & Klikk-skjøt] */
// Antall rom i bredden (X)
DIVIDERS_X = 2; // [1:1:5]

// Antall rom i dybden (Y)
DIVIDERS_Y = 2; // [1:1:4]

// Klikk-ører på utsiden (0 = av, 1 = på)
INTERLOCK_TABS = 1; // [0:Uten klikk-skjøt, 1:Med klikk-skjøter]

/* [Hidden] */
$fn = 36;

OUTER_W = INNER_WIDTH + WALL_THICKNESS * 2;
OUTER_L = INNER_LENGTH + WALL_THICKNESS * 2;
TOTAL_H = INNER_HEIGHT + WALL_THICKNESS;

difference() {
  union() {
    cuboid([OUTER_W, OUTER_L, TOTAL_H], rounding = 4, anchor = BOTTOM);

    // Hann-klikkskjøter på høyre og bakre side
    if (INTERLOCK_TABS > 0) {
      translate([OUTER_W / 2 + 2.5, 0, 0])
        cuboid([5, 18, TOTAL_H * 0.75], rounding = 1.5, anchor = BOTTOM);
      translate([0, OUTER_L / 2 + 2.5, 0])
        cuboid([18, 5, TOTAL_H * 0.75], rounding = 1.5, anchor = BOTTOM);
    }
  }

  // Utsparinger for hvert rom
  cell_w = (INNER_WIDTH - (DIVIDERS_X - 1) * WALL_THICKNESS) / DIVIDERS_X;
  cell_l = (INNER_LENGTH - (DIVIDERS_Y - 1) * WALL_THICKNESS) / DIVIDERS_Y;

  for (ix = [0 : DIVIDERS_X - 1])
    for (iy = [0 : DIVIDERS_Y - 1]) {
      px = -INNER_WIDTH / 2 + cell_w / 2 + ix * (cell_w + WALL_THICKNESS);
      py = -INNER_LENGTH / 2 + cell_l / 2 + iy * (cell_l + WALL_THICKNESS);
      translate([px, py, WALL_THICKNESS])
        cuboid([max(4, cell_w), max(4, cell_l), INNER_HEIGHT + 0.05], rounding = 2, anchor = BOTTOM);
    }
}
`,
  },

  {
    id: 'cat_scad_sd_usb_holder',
    title: 'SD-kort, MicroSD & USB-C Bordorganisator',
    shortTitle: 'SD & USB-holder',
    category: 'Bokser & Organisering',
    fileName: 'sd_usb_media_dock.scad',
    description:
      'Kompakt skrivebordsstasjon med presise spor for SD-kort, MicroSD-kort, vanlige USB-A-minnepinner og USB-C-adaptere.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#111111',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 105, y: 62, z: 22 },
    volumeCm3: 38.0,
    overhangRatio: 0.03,
    scadSource: `include <BOSL2/std.scad>

/* [Antall Spor] */
// Antall spor for store SD-kort (24.5 × 2.5 mm)
SD_SLOTS = 5; // [1:1:12]

// Antall spor for MicroSD-kort (11.6 × 1.4 mm)
MICRO_SD_SLOTS = 6; // [1:1:14]

// Antall spor for USB-A minnepinner (12.6 × 5.0 mm)
USB_A_SLOTS = 4; // [1:1:10]

// Antall spor for USB-C plugger (8.8 × 3.0 mm)
USB_C_SLOTS = 4; // [1:1:10]

/* [Blokkens Dimensjoner] */
// Høyde på basen (mm)
BASE_HEIGHT_MM = 22; // [14:2:36]

// Hjørneradius (mm)
CORNER_RADIUS_MM = 6; // [2:1:12]

/* [Hidden] */
$fn = 36;

MAX_SLOTS = max(SD_SLOTS, max(MICRO_SD_SLOTS, USB_A_SLOTS + USB_C_SLOTS));
INNER_WIDTH = max(75, MAX_SLOTS * 9 + 24);
INNER_LENGTH = 64;

difference() {
  // Avfaset baseblokk
  hull() {
    cuboid([INNER_WIDTH, INNER_LENGTH, BASE_HEIGHT_MM - 3], rounding = CORNER_RADIUS_MM, anchor = BOTTOM);
    up(BASE_HEIGHT_MM - 3)
      cuboid([INNER_WIDTH - 4, INNER_LENGTH - 4, 3], rounding = max(2, CORNER_RADIUS_MM - 1), anchor = BOTTOM);
  }

  // Rad 1 (Bak): USB-A spor (12.6 x 5.0 x 14 mm)
  for (i = [0 : USB_A_SLOTS - 1]) {
    pos_x = -INNER_WIDTH / 2 + 16 + i * 16;
    if (pos_x + 8 < INNER_WIDTH / 2 - 4)
      translate([pos_x, 18, BASE_HEIGHT_MM - 14])
        cuboid([12.6, 5.0, 15], rounding = 0.8, anchor = BOTTOM);
  }

  // Rad 2 (Midt-bak): USB-C spor (8.8 x 3.0 x 11 mm)
  for (i = [0 : USB_C_SLOTS - 1]) {
    pos_x = -INNER_WIDTH / 2 + 14 + i * 13;
    if (pos_x + 6 < INNER_WIDTH / 2 - 4)
      translate([pos_x, 6, BASE_HEIGHT_MM - 11])
        cuboid([8.8, 3.0, 12], rounding = 1.0, anchor = BOTTOM);
  }

  // Rad 3 (Midt-foran): SD-kort spor (24.6 x 2.5 x 14 mm)
  for (i = [0 : SD_SLOTS - 1]) {
    pos_x = -((SD_SLOTS - 1) * 6.5) / 2 + i * 6.5;
    translate([0, -5 - i * 4.2, BASE_HEIGHT_MM - 14])
      if (-5 - i * 4.2 > -INNER_LENGTH / 2 + 12)
        cuboid([24.6, 2.5, 15], rounding = 0.5, anchor = BOTTOM);
  }

  // Rad 4 (Foran høyre/venstre): MicroSD spor (11.6 x 1.5 x 9 mm)
  for (i = [0 : MICRO_SD_SLOTS - 1]) {
    pos_x = -INNER_WIDTH / 2 + 14 + i * 13.5;
    if (pos_x + 6 < INNER_WIDTH / 2 - 4)
      translate([pos_x, -INNER_LENGTH / 2 + 8, BASE_HEIGHT_MM - 9])
        cuboid([11.6, 1.5, 10], rounding = 0.4, anchor = BOTTOM);
  }
}
`,
  },

  // ==========================================================================
  // 2. FORMER & VERKTØY
  // ==========================================================================
  {
    id: 'cat_scad_cookie_cutter',
    title: 'Parametrisk Kakeform / Pepperkakeform (Cookie Cutter)',
    shortTitle: 'Kakeform',
    category: 'Former & Verktøy',
    fileName: 'parametric_cookie_cutter.scad',
    description:
      'Skarp 0.8–1.2 mm skjærekant kombinert med en bred 5 mm ergonomisk trykkflens. Velg mellom 14 silhuetter (Katt, Hjerte, Juletre, Pepperkakemann, Hund, Dinosaur, Kanin, Bamse, Krone, Stjerne m.fl.).',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#FF5500',
    proceduralPreset: 'PLANETARY_GEAR',
    boundingBoxMm: { x: 90, y: 90, z: 18 },
    volumeCm3: 18.0,
    overhangRatio: 0.04,
    scadSource: `include <BOSL2/std.scad>

/* [Form & Motiv] */
// Velg form / silhuett på kakeformen
SHAPE_TYPE = 0; // [0:Stjerne / Bølge, 1:Katt, 2:Hjerte, 3:Juletre, 4:Pepperkakemann, 5:Hund, 6:Kanin, 7:Dinosaur, 8:Bamse, 9:Krone, 10:Sommerfugl, 11:Fisk, 12:Halvmåne, 13:Lyn, 14:Pikachu, 15:Pokéball, 16:Flaggermus, 17:Spøkelse, 18:Snømann, 19:Enhjørning, 20:Bil, 21:Rakett, 22:Sopp, 23:3D-Stempel]

// Ytre størrelse / diameter på kakeformen (mm)
OUTER_DIAMETER_MM = 85; // [45:5:160]

// Total kuttehøyde (mm)
CUTTER_HEIGHT_MM = 18; // [10:2:35]

// Egendefinert 3D-stempeltekst (brukes når 3D-Stempel er valgt, maks 12 tegn)
CUSTOM_TEXT = "AXIS"; // [12]

// Antall tagger / spisser rundt profilen (kun for Stjerne / Bølge)
POINT_COUNT = 6; // [1:1:16]

// Dybde på bølge / stjernetagg (kun for Stjerne / Bølge, mm)
WAVE_DEPTH_MM = 8; // [0:1:22]

/* [Skjærevegg & Trykkkant] */
// Tykkelse på selve skjæreveggen (mm)
BLADE_WALL_MM = 1.2; // [0.8:0.1:2.0]

// Bredde på avstivende trykkflens i bunnen (mm)
HANDLE_FLANGE_MM = 5.0; // [3.0:0.5:9.0]

// Tykkelse på trykkflensen (mm)
HANDLE_THICKNESS_MM = 2.8; // [2.0:0.2:5.0]

/* [Hidden] */
$fn = 48;

module star_wave_2d(base_r, points, amp) {
  steps = 96;
  pts = [
    for (i = [0 : steps - 1])
      let (
        ang = i * (360 / steps),
        r = base_r + (points > 1 ? amp * cos(ang * points) : 0)
      )
      [r * cos(ang), r * sin(ang)]
  ];
  polygon(pts);
}

module cookie_motif_2d(shape_id, d) {
  s = d / 85;
  scale([s, s]) {
    if (shape_id == 1) {
      // 1: KATT (Hode med spisse katteører, værhår-kinn, sittende kropp og krøllet hale)
      union() {
        translate([0, 13]) scale([1.12, 0.96]) circle(r = 16);
        for (sx = [-1, 1]) {
          polygon(points = [
            [sx * 4, 24],
            [sx * 18, 17],
            [sx * 15, 39]
          ]);
        }
        hull() {
          translate([0, 2]) circle(r = 11);
          translate([0, -17]) scale([1.05, 1.0]) circle(r = 16);
        }
        for (sx = [-1, 1]) {
          translate([sx * 9, -31]) scale([1.1, 0.75]) circle(r = 6);
        }
        hull() {
          translate([11, -24]) circle(r = 4.2);
          translate([24, -14]) circle(r = 4.0);
        }
        hull() {
          translate([24, -14]) circle(r = 4.0);
          translate([27, 2]) circle(r = 4.2);
        }
        translate([24, 5]) circle(r = 4.8);
      }
    } else if (shape_id == 2) {
      // 2: HJERTE
      union() {
        for (sx = [-1, 1])
          translate([sx * 14.5, 10]) circle(r = 18.5);
        polygon(points = [
          [-31.5, 3],
          [31.5, 3],
          [0, -36]
        ]);
      }
    } else if (shape_id == 3) {
      // 3: JULETRE
      union() {
        polygon(points = [[0, 39], [-18, 15], [18, 15]]);
        polygon(points = [[0, 23], [-25, -4], [25, -4]]);
        polygon(points = [[0, 6], [-32, -24], [32, -24]]);
        translate([-7, -38]) square([14, 16]);
      }
    } else if (shape_id == 4) {
      // 4: PEPPERKAKEMANN
      union() {
        translate([0, 24]) circle(r = 12.5);
        hull() {
          translate([-26, 7]) circle(r = 6);
          translate([26, 7]) circle(r = 6);
        }
        hull() {
          translate([0, 14]) circle(r = 10);
          translate([0, -8]) circle(r = 12);
        }
        for (sx = [-1, 1]) {
          hull() {
            translate([sx * 6, -8]) circle(r = 7);
            translate([sx * 14, -31]) circle(r = 6.5);
          }
        }
      }
    } else if (shape_id == 5) {
      // 5: HUND
      union() {
        translate([-14, 14]) circle(r = 12);
        hull() {
          translate([-18, 13]) circle(r = 7);
          translate([-30, 11]) circle(r = 6);
        }
        hull() {
          translate([-9, 22]) circle(r = 5);
          translate([-4, 8]) circle(r = 5.5);
        }
        hull() {
          translate([-10, 2]) circle(r = 11);
          translate([14, -2]) circle(r = 12);
        }
        for (px = [-12, 13]) {
          hull() {
            translate([px, -8]) circle(r = 5.5);
            translate([px, -28]) circle(r = 5);
          }
        }
        hull() {
          translate([21, 3]) circle(r = 4);
          translate([31, 18]) circle(r = 4.2);
        }
      }
    } else if (shape_id == 6) {
      // 6: KANIN
      union() {
        for (sx = [-1, 1]) {
          hull() {
            translate([sx * 6, 12]) circle(r = 5);
            translate([sx * 10, 35]) circle(r = 4.8);
          }
        }
        translate([0, 5]) circle(r = 13.5);
        translate([0, -17]) scale([1.15, 1.0]) circle(r = 16.5);
        translate([17, -20]) circle(r = 6.5);
      }
    } else if (shape_id == 7) {
      // 7: DINOSAUR
      union() {
        hull() {
          translate([-22, 26]) circle(r = 8);
          translate([-11, 24]) circle(r = 9);
        }
        hull() {
          translate([-12, 22]) circle(r = 6.5);
          translate([-6, 0]) circle(r = 9);
        }
        translate([4, -6]) scale([1.3, 0.95]) circle(r = 14);
        for (px = [-6, 11]) {
          hull() {
            translate([px, -14]) circle(r = 6);
            translate([px, -31]) circle(r = 5.5);
          }
        }
        hull() {
          translate([15, -6]) circle(r = 8);
          translate([34, 6]) circle(r = 4);
        }
      }
    } else if (shape_id == 8) {
      // 8: BAMSE
      union() {
        for (sx = [-1, 1]) {
          translate([sx * 13, 27]) circle(r = 7.5);
          hull() {
            translate([sx * 10, 0]) circle(r = 6.5);
            translate([sx * 24, -4]) circle(r = 6.5);
          }
          hull() {
            translate([sx * 8, -16]) circle(r = 7);
            translate([sx * 14, -30]) circle(r = 7);
          }
        }
        translate([0, 15]) circle(r = 14.5);
        translate([0, -9]) scale([1.1, 1.0]) circle(r = 16);
      }
    } else if (shape_id == 9) {
      // 9: KRONE
      union() {
        polygon(points = [
          [-28, -22], [28, -22],
          [34, 14], [17, -2],
          [0, 22], [-17, -2],
          [-34, 14]
        ]);
        for (pt = [[-34, 14], [0, 22], [34, 14]])
          translate(pt) circle(r = 5.5);
      }
    } else if (shape_id == 10) {
      // 10: SOMMERFUGL
      union() {
        hull() {
          translate([0, 24]) circle(r = 4.5);
          translate([0, -24]) circle(r = 4);
        }
        for (sx = [-1, 1]) {
          hull() {
            translate([sx * 4, 6]) circle(r = 8);
            translate([sx * 25, 17]) circle(r = 13);
            translate([sx * 22, 1]) circle(r = 10);
          }
          hull() {
            translate([sx * 4, -6]) circle(r = 7);
            translate([sx * 20, -16]) circle(r = 11);
          }
        }
      }
    } else if (shape_id == 11) {
      // 11: FISK
      union() {
        translate([-6, 0]) scale([1.45, 0.95]) circle(r = 18);
        polygon(points = [
          [14, 0],
          [35, 19],
          [29, 0],
          [35, -19]
        ]);
        polygon(points = [[-12, 14], [4, 26], [8, 12]]);
      }
    } else if (shape_id == 12) {
      // 12: HALVMÅNE
      difference() {
        circle(r = 34);
        translate([14, 6]) circle(r = 27);
      }
    } else if (shape_id == 13) {
      // 13: LYN
      polygon(points = [
        [6, 38],
        [-22, 2],
        [-2, 2],
        [-10, -38],
        [22, 0],
        [2, 0]
      ]);
    } else if (shape_id == 14) {
      // 14: PIKACHU (Lange skrå ører, runde kinn, sittende kropp og ikonisk lyn-hale)
      union() {
        translate([0, 7]) scale([1.12, 0.96]) circle(r = 15);
        for (sx = [-1, 1]) {
          translate([sx * 10.5, 3]) circle(r = 8.5);
        }
        // Venstre langt spisst Pikachu-øre
        hull() {
          translate([-8, 18]) circle(r = 4.2);
          translate([-16, 33]) circle(r = 3.6);
          translate([-21, 43]) circle(r = 1.5);
        }
        // Høyre skrått Pikachu-øre
        hull() {
          translate([9, 17]) circle(r = 4.2);
          translate([23, 27]) circle(r = 3.6);
          translate([34, 33]) circle(r = 1.5);
        }
        // Kropp
        hull() {
          translate([0, -1]) circle(r = 12);
          translate([0, -18]) scale([1.1, 1.0]) circle(r = 15);
        }
        // Føtter
        for (sx = [-1, 1]) {
          translate([sx * 10, -31]) scale([1.2, 0.72]) circle(r = 6);
        }
        // Lyn-hale på høyre side
        polygon(points = [
          [10, -21],
          [22, -13],
          [18, -6],
          [31, 4],
          [25, 10],
          [39, 21],
          [27, 25],
          [17, 10],
          [22, 4],
          [11, -5],
          [15, -11],
          [6, -16]
        ]);
      }
    } else if (shape_id == 15) {
      // 15: POKÉBALL
      circle(r = 36);
    } else if (shape_id == 16) {
      // 16: FLAGGERMUS / BATMAN
      union() {
        translate([0, 4]) circle(r = 9);
        for (sx = [-1, 1]) {
          polygon(points = [
            [sx * 2, 10],
            [sx * 8, 10],
            [sx * 6, 23]
          ]);
          polygon(points = [
            [sx * 5, 10],
            [sx * 38, 16],
            [sx * 33, -6],
            [sx * 22, -2],
            [sx * 16, -12],
            [sx * 8, -6],
            [0, -18]
          ]);
        }
      }
    } else if (shape_id == 17) {
      // 17: SPØKELSE
      union() {
        translate([0, 10]) circle(r = 24);
        translate([-24, -18]) square([48, 28]);
        for (px = [-18, -6, 6, 18]) {
          translate([px, -18]) circle(r = 6);
        }
      }
    } else if (shape_id == 18) {
      // 18: SNØMANN
      union() {
        translate([0, -19]) circle(r = 18);
        translate([0, 3]) circle(r = 13.5);
        translate([0, 20]) circle(r = 10);
        translate([-13, 27]) square([26, 3.5]);
        translate([-8, 30]) square([16, 10]);
      }
    } else if (shape_id == 19) {
      // 19: ENHJØRNING
      union() {
        translate([-4, 4]) circle(r = 15);
        hull() {
          translate([-12, 4]) circle(r = 9);
          translate([-28, -2]) circle(r = 7.5);
        }
        // Enhjørningshorn i pannen
        polygon(points = [
          [-10, 16],
          [-2, 14],
          [-24, 39]
        ]);
        // Øre
        polygon(points = [
          [2, 16],
          [10, 14],
          [8, 30]
        ]);
        // Hals og bølget man
        hull() {
          translate([-2, -4]) circle(r = 12);
          translate([4, -28]) circle(r = 14);
        }
        for (py = [10, 0, -10, -20]) {
          translate([13, py]) circle(r = 7);
        }
      }
    } else if (shape_id == 20) {
      // 20: BIL
      union() {
        hull() {
          translate([-30, -6]) circle(r = 8);
          translate([30, -6]) circle(r = 8);
          translate([-28, 4]) circle(r = 6);
          translate([28, 4]) circle(r = 6);
        }
        hull() {
          translate([-14, 6]) circle(r = 8);
          translate([10, 6]) circle(r = 8);
          translate([-8, 18]) circle(r = 6);
          translate([6, 18]) circle(r = 6);
        }
        for (wx = [-19, 19]) {
          translate([wx, -13]) circle(r = 9);
        }
      }
    } else if (shape_id == 21) {
      // 21: RAKETT
      union() {
        hull() {
          translate([0, 36]) circle(r = 2);
          translate([0, 14]) circle(r = 13);
          translate([0, -20]) circle(r = 11);
        }
        for (sx = [-1, 1]) {
          polygon(points = [
            [sx * 9, -6],
            [sx * 26, -24],
            [sx * 24, -34],
            [sx * 8, -22]
          ]);
        }
        translate([-6, -28]) square([12, 10]);
      }
    } else if (shape_id == 22) {
      // 22: SOPP (SUPER MARIO)
      union() {
        translate([0, 8]) scale([1.22, 0.95]) circle(r = 24);
        hull() {
          translate([-13, 0]) circle(r = 5);
          translate([13, 0]) circle(r = 5);
          translate([-11, -24]) circle(r = 6);
          translate([11, -24]) circle(r = 6);
        }
      }
    } else if (shape_id == 23) {
      // 23: EGENDEFINERT 3D-STEMPEL MEDALJONG
      star_wave_2d(36, 12, 2.5);
    } else {
      // 0: STJERNE / BØLGE
      base_rad = max(12, 42.5 - WAVE_DEPTH_MM * (85 / max(45, d)));
      star_wave_2d(base_rad, POINT_COUNT, WAVE_DEPTH_MM);
    }
  }
}

union() {
  // Ergonomisk trykkflens på byggeplaten (Z = 0..HANDLE_THICKNESS_MM)
  linear_extrude(height = HANDLE_THICKNESS_MM)
    difference() {
      offset(r = HANDLE_FLANGE_MM) cookie_motif_2d(SHAPE_TYPE, OUTER_DIAMETER_MM);
      offset(r = -BLADE_WALL_MM) cookie_motif_2d(SHAPE_TYPE, OUTER_DIAMETER_MM);
    }

  // Skarp skjærevegg opp til toppen
  linear_extrude(height = CUTTER_HEIGHT_MM)
    difference() {
      cookie_motif_2d(SHAPE_TYPE, OUTER_DIAMETER_MM);
      offset(r = -BLADE_WALL_MM) cookie_motif_2d(SHAPE_TYPE, OUTER_DIAMETER_MM);
    }

  // Pokéball midtbånd og senterknapp (når SHAPE_TYPE == 15)
  if (SHAPE_TYPE == 15) {
    s_pb = OUTER_DIAMETER_MM / 85;
    linear_extrude(height = CUTTER_HEIGHT_MM * 0.78)
      scale([s_pb, s_pb])
        union() {
          translate([-35, -2.2]) square([70, 4.4]);
          difference() {
            circle(r = 12);
            circle(r = 7.5);
          }
        }
  }

  // Egendefinert 3D-tekststempel i midten (når SHAPE_TYPE == 23)
  if (SHAPE_TYPE == 23) {
    translate([0, 0, 0])
      cuboid([OUTER_DIAMETER_MM * 0.82, 14, HANDLE_THICKNESS_MM], anchor = BOTTOM);
    up(HANDLE_THICKNESS_MM - 0.1)
      extrude_text(CUSTOM_TEXT, size = max(7, OUTER_DIAMETER_MM * 0.11), h = max(4, CUTTER_HEIGHT_MM * 0.55));
  }
}
`,
  },

  {
    id: 'cat_scad_threaded_funnel',
    title: 'Gjenget Trakt & Slangeadapter',
    shortTitle: 'Gjenget Trakt',
    category: 'Former & Verktøy',
    fileName: 'threaded_funnel_adapter.scad',
    description:
      'Parametrisk trakt med luftekanal, opphengsøre og valgfrie skrugjenger i bunnen som passer standard flasker eller slanger.',
    defaultMaterial: 'PETG_INDUSTRIAL',
    defaultColorHex: '#FF5500',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 110, y: 100, z: 95 },
    volumeCm3: 34.0,
    overhangRatio: 0.18,
    scadSource: `include <BOSL2/std.scad>
include <BOSL2/screws.scad>

/* [Traktens Dimensjoner] */
// Ytre toppdiameter på trakten (mm)
TOP_DIAMETER_MM = 96; // [40:5:200]

// Ytre diameter på tuten / stussen (mm)
SPOUT_DIAMETER_MM = 24; // [10:2:60]

// Høyde på kjegledelen (mm)
CONE_HEIGHT_MM = 55; // [25:5:130]

// Lengde på rørstussen (mm)
SPOUT_LENGTH_MM = 32; // [12:2:80]

// Veggtykkelse (min 1.2 mm)
WALL_THICKNESS = 2.0; // [1.2:0.2:4.0]

/* [Skrugjenger & Krage] */
// Skrugjenger på stussen (0 = glatt slangeadapter, 1 = gjenget)
ENABLE_THREADS = 1; // [0:Glatt rørstuss, 1:Med utvendige skrugjenger]

// Gjengestigning (mm)
THREAD_PITCH_MM = 2.5; // [1.5:0.5:4.0]

/* [Hidden] */
$fn = 56;

// Printes opp-ned (med den brede åpningen mot byggeplaten for 0 støttemateriale!)
difference() {
  union() {
    // Forsterket brem + opphengsøre ved byggeplaten
    cylinder(d = TOP_DIAMETER_MM + 4, h = 3);
    hull() {
      translate([TOP_DIAMETER_MM / 2, 0, 0])
        cylinder(d = 16, h = 3);
      translate([TOP_DIAMETER_MM / 2 + 10, 0, 0])
        cylinder(d = 14, h = 3);
    }

    // Konisk traktkropp
    cylinder(d1 = TOP_DIAMETER_MM, d2 = SPOUT_DIAMETER_MM, h = CONE_HEIGHT_MM);

    // Sylinderstuss øverst
    up(CONE_HEIGHT_MM - 0.1) {
      if (ENABLE_THREADS > 0) {
        up(SPOUT_LENGTH_MM / 2)
          threaded_rod(d = SPOUT_DIAMETER_MM, l = SPOUT_LENGTH_MM, pitch = THREAD_PITCH_MM);
      } else {
        cylinder(d = SPOUT_DIAMETER_MM, h = SPOUT_LENGTH_MM);
      }
    }
  }

  // Innvendig konisk løp
  down(0.05)
    cylinder(
      d1 = TOP_DIAMETER_MM - WALL_THICKNESS * 2,
      d2 = SPOUT_DIAMETER_MM - WALL_THICKNESS * 2,
      h = CONE_HEIGHT_MM + 0.1
    );

  // Innvendig stusshull
  up(CONE_HEIGHT_MM - 0.1)
    cylinder(d = max(4, SPOUT_DIAMETER_MM - WALL_THICKNESS * 2.4), h = SPOUT_LENGTH_MM + 2);

  // Hull i opphengsøre
  translate([TOP_DIAMETER_MM / 2 + 10, 0, -0.5])
    cylinder(d = 6, h = 5);
}
`,
  },

  {
    id: 'cat_scad_threaded_jar',
    title: 'Skrulokk-krukke med Riflet Lokk (Threaded Jar)',
    shortTitle: 'Skrulokk-krukke',
    category: 'Former & Verktøy',
    fileName: 'threaded_storage_jar.scad',
    description:
      'Sylindrisk oppbevaringskrukke med presise skrugjenger og riflet skrulokk plassert ved siden av hverandre på byggeplaten.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#555555',
    proceduralPreset: 'PLANETARY_GEAR',
    boundingBoxMm: { x: 145, y: 72, z: 65 },
    volumeCm3: 58.0,
    overhangRatio: 0.08,
    scadSource: `include <BOSL2/std.scad>
include <BOSL2/screws.scad>

/* [Krukke & Dimensjoner] */
// Ytre diameter på krukken (mm)
JAR_DIAMETER_MM = 66; // [35:5:115]

// Høyde på selve krukken (mm)
JAR_HEIGHT_MM = 62; // [30:5:140]

// Veggtykkelse (mm)
WALL_THICKNESS = 2.4; // [1.6:0.2:4.5]

/* [Gjenger & Lokk] */
// Gjengestigning (mm)
THREAD_PITCH_MM = 3.0; // [2.0:0.5:4.0]

// Antall griperiller rundt lokket
LID_KNURL_COUNT = 24; // [12:4:40]

// Vis skrulokket ved siden av krukken (1 = ja, 0 = kun krukke)
INCLUDE_LID = 1; // [0:Kun krukke, 1:Krukke + skrulokk]

/* [Hidden] */
$fn = 56;

NECK_H = 12;
NECK_D = JAR_DIAMETER_MM - 4;
JAR_X = INCLUDE_LID > 0 ? -(JAR_DIAMETER_MM * 0.55) : 0;
LID_X = JAR_DIAMETER_MM * 0.58;

// 1. Krukke
translate([JAR_X, 0, 0]) {
  difference() {
    union() {
      cyl(d = JAR_DIAMETER_MM, h = JAR_HEIGHT_MM - NECK_H, rounding = 2.5, anchor = BOTTOM);
      up(JAR_HEIGHT_MM - NECK_H - 0.1 + NECK_H / 2)
        threaded_rod(d = NECK_D, l = NECK_H, pitch = THREAD_PITCH_MM);
    }

    up(WALL_THICKNESS)
      cylinder(d = NECK_D - WALL_THICKNESS * 2.2, h = JAR_HEIGHT_MM + 1);
  }
}

// 2. Riflet Skrulokk (ligger opp-ned på byggeplaten)
if (INCLUDE_LID > 0) {
  lid_od = JAR_DIAMETER_MM + 2;
  lid_h = NECK_H + WALL_THICKNESS + 1;

  translate([LID_X, 0, 0]) {
    difference() {
      union() {
        cyl(d = lid_od, h = lid_h, rounding = 2.0, anchor = BOTTOM);
        for (k = [0 : LID_KNURL_COUNT - 1]) {
          rotate([0, 0, k * (360 / LID_KNURL_COUNT)])
            translate([lid_od / 2, 0, 1.5])
              cylinder(d = 2.6, h = lid_h - 3, $fn = 12);
        }
      }

      up(WALL_THICKNESS + NECK_H / 2 + 0.5)
        threaded_rod(d = NECK_D + 0.6, l = NECK_H + 1.5, pitch = THREAD_PITCH_MM, internal = true);
    }
  }
}
`,
  },

  {
    id: 'cat_scad_soap_mold',
    title: 'Tilpasset Såpe- og Stempelform med Relieff',
    shortTitle: 'Såpe-/Stempelform',
    category: 'Former & Verktøy',
    fileName: 'custom_soap_stamp_mold.scad',
    description:
      'Støpeform for hjemmelaget såpe, voks eller is med avrundede innerkanter, slippvinkel og opphøyd geometrisk medaljong-stempel i bunnen.',
    defaultMaterial: 'PETG_INDUSTRIAL',
    defaultColorHex: '#F4F0EA',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 96, y: 72, z: 34 },
    volumeCm3: 44.0,
    overhangRatio: 0.04,
    scadSource: `include <BOSL2/std.scad>

/* [Global] */
// Innvendig bredde på såpestykket (mm)
INNER_WIDTH = 82; // [45:5:150]

// Innvendig lengde på såpestykket (mm)
INNER_LENGTH = 58; // [35:5:120]

// Innvendig dybde på formen (mm)
INNER_HEIGHT = 28; // [15:2:60]

// Veggtykkelse på formen (mm)
WALL_THICKNESS = 4.0; // [2.4:0.4:8.0]

/* [Stempel-relieff & Tekst i bunnen] */
// Tekst eller ord som preges inn i såpen (maks 10 tegn)
CUSTOM_TEXT = "AXIS"; // [10]

// Høyde på opphøyd stempelmønster i bunnen (mm)
EMBOSS_HEIGHT_MM = 2.4; // [0.8:0.4:5.0]

// Diameter på medaljong-relieff (mm)
MEDALLION_DIA_MM = 38; // [18:2:70]

/* [Hidden] */
$fn = 48;

OUTER_W = INNER_WIDTH + WALL_THICKNESS * 2;
OUTER_L = INNER_LENGTH + WALL_THICKNESS * 2;
TOTAL_H = INNER_HEIGHT + WALL_THICKNESS;

union() {
  difference() {
    union() {
      cuboid([OUTER_W, OUTER_L, TOTAL_H], rounding = 6, anchor = BOTTOM);
      // Gripekant øverst for enklere avforming
      up(TOTAL_H - 4)
        cuboid([OUTER_W + 6, OUTER_L + 6, 4], rounding = 7, anchor = BOTTOM);
    }

    // Konisk hulrom med 2 mm slippvinkel så såpen slipper lett
    up(WALL_THICKNESS)
      hull() {
        cuboid([INNER_WIDTH - 2, INNER_LENGTH - 2, 1], rounding = 5, anchor = BOTTOM);
        up(INNER_HEIGHT)
          cuboid([INNER_WIDTH + 1, INNER_LENGTH + 1, 1], rounding = 6, anchor = BOTTOM);
      }
  }

  // Opphøyd relieff-ramme + 3D-tekst i bunnen av formen
  up(WALL_THICKNESS - 0.02) {
    difference() {
      cylinder(d = min(MEDALLION_DIA_MM, min(INNER_WIDTH, INNER_LENGTH) - 10), h = EMBOSS_HEIGHT_MM);
      down(0.05)
        cylinder(d = min(MEDALLION_DIA_MM, min(INNER_WIDTH, INNER_LENGTH) - 10) - 5, h = EMBOSS_HEIGHT_MM + 0.1);
    }
    extrude_text(CUSTOM_TEXT, size = min(10, (INNER_WIDTH - 22) / max(3, len(CUSTOM_TEXT))), h = EMBOSS_HEIGHT_MM);
  }
}
`,
  },

  // ==========================================================================
  // 3. SMYKKER & MOTE
  // ==========================================================================
  {
    id: 'cat_scad_signet_ring',
    title: 'Parametrisk Signetring & Mønsterring',
    shortTitle: 'Signetring',
    category: 'Smykker & Mote',
    fileName: 'parametric_signet_ring.scad',
    description:
      'Tilpass eksakt indre fingerdiameter i millimeter (14–24 mm), båndbredde, signet-toppplate og fasettert mønster rundt utsiden.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#111111',
    proceduralPreset: 'CYBER_HELMET',
    boundingBoxMm: { x: 26, y: 26, z: 10 },
    volumeCm3: 4.5,
    overhangRatio: 0.12,
    scadSource: `include <BOSL2/std.scad>

/* [Ringstørrelse & Bånd] */
// Indre fingerdiameter i millimeter (f.eks. 17 = str 53, 19 = str 60, 21 = str 66)
RING_DIAMETER_MM = 19.0; // [14.0:0.5:24.0]

// Bredde på ringbåndet (mm)
BAND_WIDTH_MM = 9.0; // [4.0:0.5:16.0]

// Tykkelse på ringveggen (mm)
BAND_THICKNESS_MM = 2.4; // [1.6:0.2:4.0]

/* [Signet-plate, Initialer & Fasetter] */
// Initialer som preges på signet-toppen (1–3 bokstaver)
CUSTOM_TEXT = "KP"; // [3]

// Bredde på flat signet-topp (0 = jevn ring uten signet)
SIGNET_FACE_MM = 12.0; // [0:1:18]

// Antall utvendige mønster-groper rundt ringen
PATTERN_FACETS = 12; // [0:2:24]

/* [Hidden] */
$fn = 72;

OUTER_D = RING_DIAMETER_MM + BAND_THICKNESS_MM * 2;

difference() {
  union() {
    // Avrundet komfort-ringkropp
    cyl(d = OUTER_D, h = BAND_WIDTH_MM, rounding = 1.0, anchor = BOTTOM);

    // Signet-toppplate på forsiden (Y+)
    if (SIGNET_FACE_MM > 0) {
      hull() {
        translate([0, OUTER_D / 2 - 1.5, BAND_WIDTH_MM / 2])
          cuboid([SIGNET_FACE_MM, 2.5, min(BAND_WIDTH_MM, SIGNET_FACE_MM)], rounding = 1.5, anchor = CENTER);
        translate([0, 0, BAND_WIDTH_MM / 2])
          cylinder(d = OUTER_D - 1, h = BAND_WIDTH_MM * 0.75, center = true);
      }

      // Opphøyde 3D-initialer på signet-platen
      if (len(CUSTOM_TEXT) > 0) {
        translate([0, OUTER_D / 2 - 0.35, BAND_WIDTH_MM / 2])
          rotate([-90, 0, 0])
            extrude_text(CUSTOM_TEXT, size = min(BAND_WIDTH_MM * 0.52, SIGNET_FACE_MM * 0.42), h = 0.9);
      }
    }
  }

  // Indre fingerhull med myk kant
  down(0.05)
    cylinder(d = RING_DIAMETER_MM, h = BAND_WIDTH_MM + 0.1);

  // Utvendige geometriske fasett-utsparinger
  if (PATTERN_FACETS > 0) {
    for (i = [0 : PATTERN_FACETS - 1]) {
      ang = i * (360 / PATTERN_FACETS);
      if (SIGNET_FACE_MM == 0 || abs(ang - 90) > 38) {
        rotate([0, 0, ang])
          translate([OUTER_D / 2 + 0.4, 0, BAND_WIDTH_MM / 2])
            rotate([0, 90, 0])
              cylinder(d = BAND_WIDTH_MM * 0.45, h = 1.6, center = true, $fn = 6);
      }
    }
  }
}
`,
  },

  {
    id: 'cat_scad_voronoi_bracelet',
    title: 'Parametrisk Voronoi- & Bikube-armbånd',
    shortTitle: 'Voronoi-armbånd',
    category: 'Smykker & Mote',
    fileName: 'parametric_voronoi_cuff.scad',
    description:
      'Moderne mansjett-armbånd (Cuff) med gjennombrutt geometrisk cellemønster, justerbar håndleddsdiameter og åpning for enkel påsetting.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#FF5500',
    proceduralPreset: 'CYBER_HELMET',
    boundingBoxMm: { x: 74, y: 74, z: 32 },
    volumeCm3: 24.0,
    overhangRatio: 0.14,
    scadSource: `include <BOSL2/std.scad>

/* [Håndledd & Bredde] */
// Indre håndleddsdiameter (mm)
WRIST_DIAMETER_MM = 64; // [48:2:85]

// Høyde / bredde på armbåndet (mm)
CUFF_WIDTH_MM = 30; // [15:5:60]

// Veggtykkelse (mm)
WALL_THICKNESS = 2.8; // [1.8:0.2:4.5]

// Åpning på undersiden av håndleddet (0 = lukket ring)
CUFF_OPENING_MM = 26; // [0:2:42]

/* [Mønstertetthet] */
// Antall celler rundt omkretsen
CELL_COLUMNS = 16; // [8:2:28]

// Antall rader i høyden
CELL_ROWS = 3; // [1:1:5]

/* [Hidden] */
$fn = 64;

OUTER_D = WRIST_DIAMETER_MM + WALL_THICKNESS * 2;

difference() {
  // Ytre mansjettkropp med avrundet topp/bunn
  cyl(d = OUTER_D, h = CUFF_WIDTH_MM, rounding = 1.2, anchor = BOTTOM);

  // Indre håndleddshull
  down(0.05)
    cylinder(d = WRIST_DIAMETER_MM, h = CUFF_WIDTH_MM + 0.1);

  // Åpning for håndledd (Y-)
  if (CUFF_OPENING_MM > 0) {
    translate([0, -OUTER_D / 2, CUFF_WIDTH_MM / 2])
      cuboid([CUFF_OPENING_MM, OUTER_D * 0.6, CUFF_WIDTH_MM + 2], rounding = 2, anchor = CENTER);
  }

  // Forskjøvede sekskant-/Voronoi-hull rundt mansjetten
  row_spacing = (CUFF_WIDTH_MM - 8) / max(1, CELL_ROWS);
  cell_dia = min(row_spacing * 0.78, (3.14159 * WRIST_DIAMETER_MM / CELL_COLUMNS) * 0.68);

  for (r = [0 : CELL_ROWS - 1]) {
    z_pos = 4 + row_spacing / 2 + r * row_spacing;
    ang_offset = (r % 2) * (180 / CELL_COLUMNS);
    for (c = [0 : CELL_COLUMNS - 1]) {
      ang = c * (360 / CELL_COLUMNS) + ang_offset;
      rotate([0, 0, ang])
        translate([WRIST_DIAMETER_MM / 2 - 1, 0, z_pos])
          rotate([0, 90, 0])
            cylinder(d = cell_dia, h = WALL_THICKNESS + 4, $fn = 6);
    }
  }
}
`,
  },

  {
    id: 'cat_scad_shoelace_tag',
    title: 'Skolisse-spenne (Shoe Lace Tag) & Nøkkelring',
    shortTitle: 'Skolisse-tag',
    category: 'Smykker & Mote',
    fileName: 'parametric_shoelace_tag.scad',
    description:
      'Tilpassbar brikke med hevet ramme og glatte lissehull i hver ende – kan også svitsjes til nøkkelring med ett festehull.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#FF5500',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 42, y: 16, z: 3.6 },
    volumeCm3: 3.2,
    overhangRatio: 0.02,
    scadSource: `include <BOSL2/std.scad>

/* [Tekst & Brikke-mål] */
// Tekst eller navn på brikken (maks 12 tegn)
CUSTOM_TEXT = "SINDRE"; // [12]

// Total lengde på brikken (mm)
TAG_LENGTH_MM = 48; // [28:2:95]

// Bredde på brikken (mm)
TAG_WIDTH_MM = 18; // [10:1:35]

// Tykkelse på grunnplaten (mm)
TAG_THICKNESS_MM = 2.6; // [1.6:0.2:5.0]

// Høyde på opphøyd kantramme og 3D-tekst (mm)
RAISED_RELIEF_MM = 1.2; // [0.4:0.2:2.4]

/* [Festehull] */
// Modus (2 = Skolisse med 2 hull, 1 = Nøkkelring med 1 hull)
HOLE_COUNT = 2; // [1:Nøkkelring (1 hull), 2:Skolisse-spenne (2 hull)]

// Diameter på lisse-/nøkkelringhull (mm)
HOLE_DIAMETER_MM = 4.5; // [3.0:0.5:8.0]

/* [Hidden] */
$fn = 48;

EFF_LENGTH = max(TAG_LENGTH_MM, len(CUSTOM_TEXT) * 6.5 + 18);

difference() {
  union() {
    // Bunnplate
    cuboid([EFF_LENGTH, TAG_WIDTH_MM, TAG_THICKNESS_MM], rounding = TAG_WIDTH_MM * 0.35, anchor = BOTTOM);

    // Hevet kantramme
    up(TAG_THICKNESS_MM - 0.02)
      rect_tube(
        size = [EFF_LENGTH, TAG_WIDTH_MM],
        wall = 1.6,
        h = RAISED_RELIEF_MM,
        rounding = TAG_WIDTH_MM * 0.35,
        anchor = BOTTOM
      );

    // Opphøyd 3D-tekst i midten
    up(TAG_THICKNESS_MM - 0.02)
      translate([HOLE_COUNT == 1 ? 2.5 : 0, 0, 0])
        extrude_text(
          CUSTOM_TEXT,
          size = min(TAG_WIDTH_MM * 0.46, (EFF_LENGTH - 18) / max(1, len(CUSTOM_TEXT) * 0.82)),
          h = RAISED_RELIEF_MM
        );
  }

  // Lissehull / Nøkkelringhull
  if (HOLE_COUNT == 1) {
    translate([-EFF_LENGTH / 2 + HOLE_DIAMETER_MM + 3.5, 0, -0.5])
      cylinder(d = HOLE_DIAMETER_MM, h = TAG_THICKNESS_MM + RAISED_RELIEF_MM + 1);
  } else {
    for (sx = [-1, 1]) {
      translate([sx * (EFF_LENGTH / 2 - HOLE_DIAMETER_MM - 3.2), 0, -0.5])
        cylinder(d = HOLE_DIAMETER_MM, h = TAG_THICKNESS_MM + RAISED_RELIEF_MM + 1);
    }
  }
}
`,
  },

  // ==========================================================================
  // 4. PYNT, INTERIØR & KUNST
  // ==========================================================================
  {
    id: 'cat_scad_wave_vase',
    title: 'Parametrisk Bølge-vase (Spiral / Vase Mode)',
    shortTitle: 'Bølge-vase',
    category: 'Pynt & Interiør',
    fileName: 'parametric_twisted_wave_vase.scad',
    description:
      'Skulpturell designvase der du styrer antall bølger, bølgedybde, høyde, diameter og spiral-vridning (twist) i grader.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#F4F0EA',
    proceduralPreset: 'CYBER_HELMET',
    boundingBoxMm: { x: 96, y: 96, z: 145 },
    volumeCm3: 112.0,
    overhangRatio: 0.1,
    scadSource: `include <BOSL2/std.scad>

/* [Vase-dimensjoner] */
// Ytre diameter på vasen (mm)
BASE_DIAMETER_MM = 92; // [50:5:180]

// Total høyde på vasen (mm)
VASE_HEIGHT_MM = 145; // [60:5:240]

// Veggtykkelse (mm)
WALL_THICKNESS = 2.4; // [1.2:0.2:4.5]

/* [Bølger & Spiralvridning] */
// Antall bølger / ribber rundt vasen
WAVE_COUNT = 12; // [4:1:24]

// Dybde på bølgene (mm)
WAVE_AMPLITUDE_MM = 4.5; // [1.0:0.5:12.0]

// Spiral-vridning fra bunn til topp (grader)
TWIST_DEGREES = 110; // [0:10:360]

// Skalering i toppen (% av bunndiameter)
TOP_SCALE_PERCENT = 85; // [55:5:130]

/* [Hidden] */
$fn = 64;

module wave_profile_2d(rad, waves, amp) {
  pts_count = 96;
  pts = [
    for (i = [0 : pts_count - 1])
      let (
        a = i * (360 / pts_count),
        r = rad + amp * cos(a * waves)
      )
      [r * cos(a), r * sin(a)]
  ];
  polygon(pts);
}

base_r = BASE_DIAMETER_MM / 2 - WAVE_AMPLITUDE_MM;
top_s = TOP_SCALE_PERCENT / 100;

difference() {
  // Ytre vridd bølgekropp
  linear_extrude(height = VASE_HEIGHT_MM, twist = TWIST_DEGREES, scale = top_s, slices = 48)
    wave_profile_2d(base_r, WAVE_COUNT, WAVE_AMPLITUDE_MM);

  // Innvendig hulrom (med solid bunn på WALL_THICKNESS * 1.5)
  up(WALL_THICKNESS * 1.5)
    linear_extrude(
      height = VASE_HEIGHT_MM,
      twist = TWIST_DEGREES,
      scale = top_s,
      slices = 48
    )
      wave_profile_2d(
        max(8, base_r - WALL_THICKNESS),
        WAVE_COUNT,
        max(0.5, WAVE_AMPLITUDE_MM * 0.85)
      );
}
`,
  },

  {
    id: 'cat_scad_geometric_lampshade',
    title: 'Geometrisk Lampeskjerm (E27 / E14 Sokkel)',
    shortTitle: 'Lampeskjerm E27/E14',
    category: 'Pynt & Interiør',
    fileName: 'geometric_voronoi_lampshade.scad',
    description:
      'Moderne gjennombrutt lampeskjerm som kaster dekorative skygger i rommet. Velg standard E27 (Ø40 mm) eller E14 (Ø28 mm) lampefatning.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#F4F0EA',
    proceduralPreset: 'CYBER_HELMET',
    boundingBoxMm: { x: 140, y: 140, z: 130 },
    volumeCm3: 118.0,
    overhangRatio: 0.18,
    scadSource: `include <BOSL2/std.scad>

/* [Skjermens Dimensjoner] */
// Ytre diameter på lampeskjermen (mm)
SHADE_DIAMETER_MM = 140; // [80:5:220]

// Total høyde på lampeskjermen (mm)
SHADE_HEIGHT_MM = 130; // [70:5:220]

// Veggtykkelse på skjermen (mm)
WALL_THICKNESS = 2.6; // [1.6:0.2:4.5]

/* [Lampefatning (E14 / E27)] */
// Diameter på senterhull for lampeholder (28 = E14, 40 = E27, 10 = telys/LED)
SOCKET_DIAMETER_MM = 40; // [28:E14 Fatning (28mm), 40:E27 Standard (40mm), 42:E27 Bred (42mm)]

/* [Lys-mønster] */
// Antall mønsteråpninger rundt skjermen
PATTERN_COLUMNS = 14; // [6:2:24]

// Antall rader i høyden
PATTERN_ROWS = 4; // [2:1:7]

/* [Hidden] */
$fn = 56;

union() {
  // Ytre sylinder med gjennombrutt diamant-/bikubemønster
  difference() {
    cyl(d = SHADE_DIAMETER_MM, h = SHADE_HEIGHT_MM, rounding = 2, anchor = BOTTOM);
    down(0.05)
      cylinder(d = SHADE_DIAMETER_MM - WALL_THICKNESS * 2, h = SHADE_HEIGHT_MM + 0.1);

    row_step = (SHADE_HEIGHT_MM - 22) / PATTERN_ROWS;
    hole_d = min(row_step * 0.76, (3.14159 * SHADE_DIAMETER_MM / PATTERN_COLUMNS) * 0.65);

    for (r = [0 : PATTERN_ROWS - 1]) {
      pz = 14 + row_step / 2 + r * row_step;
      a_shift = (r % 2) * (180 / PATTERN_COLUMNS);
      for (c = [0 : PATTERN_COLUMNS - 1]) {
        rotate([0, 0, c * (360 / PATTERN_COLUMNS) + a_shift])
          translate([SHADE_DIAMETER_MM / 2 - WALL_THICKNESS - 1, 0, pz])
            rotate([0, 90, 0])
              cylinder(d = hole_d, h = WALL_THICKNESS * 3, $fn = 6);
      }
    }
  }

  // Bunnring og 3 eiker inn til E27/E14 fatningsringen
  difference() {
    union() {
      cylinder(d = SOCKET_DIAMETER_MM + 14, h = 5);
      for (a = [0, 120, 240]) {
        rotate([0, 0, a])
          translate([0, -4, 0])
            cube([SHADE_DIAMETER_MM / 2 - 1, 8, 5]);
      }
    }
    down(0.05)
      cylinder(d = SOCKET_DIAMETER_MM, h = 6);
  }
}
`,
  },

  {
    id: 'cat_scad_picture_frame',
    title: 'Tilpasset Bilderamme (Bordstøtte & Veggoppheng)',
    shortTitle: 'Bilderamme',
    category: 'Pynt & Interiør',
    fileName: 'custom_photo_frame.scad',
    description:
      'Tast inn nøyaktige mål på bildet ditt i millimeter (f.eks. 100×150 eller 130×180 mm), velg profilbredde og om rammen skal ha integrert bordstøtte.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#111111',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 128, y: 168, z: 16 },
    volumeCm3: 54.0,
    overhangRatio: 0.06,
    scadSource: `include <BOSL2/std.scad>

/* [Bildemål] */
// Bredde på bildet i millimeter (f.eks. 100 for 10x15 cm)
PHOTO_WIDTH_MM = 100; // [50:5:200]

// Høyde på bildet i millimeter (f.eks. 150 for 10x15 cm)
PHOTO_HEIGHT_MM = 140; // [50:5:220]

/* [Rammeprofil] */
// Bredde på rammelisten rundt bildet (mm)
FRAME_BORDER_MM = 14; // [8:1:30]

// Dybde / tykkelse på rammen (mm)
FRAME_DEPTH_MM = 12; // [6:1:25]

// Fals-overlapp som holder bildet på plass i front (mm)
RABBET_LIP_MM = 3.5; // [2.0:0.5:7.0]

// Integrert bordstøtte på baksiden (0 = kun vegg, 1 = med bordfot)
INCLUDE_DESK_STAND = 1; // [0:Kun veggoppheng, 1:Med bordstøtte]

/* [Hidden] */
$fn = 36;

OUTER_W = PHOTO_WIDTH_MM + FRAME_BORDER_MM * 2;
OUTER_H = PHOTO_HEIGHT_MM + FRAME_BORDER_MM * 2;
WINDOW_W = PHOTO_WIDTH_MM - RABBET_LIP_MM * 2;
WINDOW_H = PHOTO_HEIGHT_MM - RABBET_LIP_MM * 2;

difference() {
  union() {
    // Hovedramme liggende flatt på byggeplaten
    cuboid([OUTER_W, OUTER_H, FRAME_DEPTH_MM], rounding = 4, anchor = BOTTOM);

    // Valgfri skrå bordstøtte nederst
    if (INCLUDE_DESK_STAND > 0) {
      translate([0, -OUTER_H / 2 + 8, FRAME_DEPTH_MM - 0.5])
        cuboid([OUTER_W * 0.45, 10, 26], rounding = 2, anchor = BOTTOM);
    }
  }

  // Gjennomgående lysåpning i front (Z = 0..FRAME_DEPTH_MM)
  down(0.05)
    cuboid([WINDOW_W, WINDOW_H, FRAME_DEPTH_MM + 0.2], rounding = 1.5, anchor = BOTTOM);

  // Fals / lomme på baksiden for selve bildet + bakplate (med 1mm klaring)
  up(2.4)
    cuboid([PHOTO_WIDTH_MM + 1.0, PHOTO_HEIGHT_MM + 1.0, FRAME_DEPTH_MM], rounding = 1.0, anchor = BOTTOM);

  // Nøkkelhull-spor for spiker/skrue øverst på baksiden
  translate([0, OUTER_H / 2 - FRAME_BORDER_MM / 2, FRAME_DEPTH_MM - 3.5])
    cylinder(d = 8, h = 4);
}
`,
  },

  {
    id: 'cat_scad_nameplate',
    title: 'Parametrisk Navneskilt & Dørskilt (Auto-lengde)',
    shortTitle: 'Navneskilt',
    category: 'Smykker & Mote',
    fileName: 'parametric_custom_nameplate.scad',
    description:
      'Skriv inn valgfritt navn eller tittel – bakplaten tilpasser automatisk bredden etter antall bokstaver, med valgfrie skruehull eller slett bakside.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#111111',
    proceduralPreset: 'INDUSTRIAL_BRACKET',
    boundingBoxMm: { x: 112, y: 34, z: 5 },
    volumeCm3: 16.0,
    overhangRatio: 0.02,
    scadSource: `include <BOSL2/std.scad>

/* [Tekst & Størrelse] */
// Navn eller tekst på skiltet (maks 16 tegn)
CUSTOM_TEXT = "FAMILIEN"; // [16]

// Bokstavhøyde i millimeter
LETTER_SIZE_MM = 14; // [8:1:28]

// Høyde på opphøyd 3D-tekst og ramme (mm)
TEXT_RELIEF_MM = 1.8; // [0.8:0.2:4.0]

/* [Bakplate & Montering] */
// Tykkelse på selve skiltplaten (mm)
PLATE_THICKNESS_MM = 3.2; // [2.0:0.4:6.0]

// Ekstra marg rundt teksten (mm)
PADDING_MM = 10; // [5:1:25]

// Festehull i sidene (0 = slett for teip, 2 = skruehull i hver ende)
MOUNT_HOLES = 2; // [0:Slett bakside (Teip), 2:Med 2 skruehull]

// Skruehulldiameter (mm)
HOLE_DIA_MM = 4.2; // [3.0:0.5:6.5]

/* [Hidden] */
$fn = 48;

CHAR_COUNT = max(2, len(CUSTOM_TEXT));
PLATE_W = CHAR_COUNT * (LETTER_SIZE_MM * 0.78) + PADDING_MM * 2 + (MOUNT_HOLES > 0 ? 16 : 0);
PLATE_H = LETTER_SIZE_MM + PADDING_MM * 1.6;

difference() {
  union() {
    // Bakplate
    cuboid([PLATE_W, PLATE_H, PLATE_THICKNESS_MM], rounding = 5, anchor = BOTTOM);

    // Kantramme
    up(PLATE_THICKNESS_MM - 0.02)
      rect_tube(
        size = [PLATE_W, PLATE_H],
        wall = 2.2,
        h = TEXT_RELIEF_MM,
        rounding = 5,
        anchor = BOTTOM
      );

    // 3D-ekstrudert tekst
    up(PLATE_THICKNESS_MM - 0.02)
      extrude_text(CUSTOM_TEXT, size = LETTER_SIZE_MM, h = TEXT_RELIEF_MM);
  }

  if (MOUNT_HOLES > 0) {
    for (sx = [-1, 1]) {
      translate([sx * (PLATE_W / 2 - 8), 0, -0.5])
        cylinder(d = HOLE_DIA_MM, h = PLATE_THICKNESS_MM + TEXT_RELIEF_MM + 1);
    }
  }
}
`,
  },

  {
    id: 'cat_scad_lithophane_box',
    title: 'Litofani-lysboks & LED-lamperamme (Lithophane Box)',
    shortTitle: 'Litofani-lysboks',
    category: 'Pynt & Interiør',
    fileName: 'lithophane_lamp_frame.scad',
    description:
      'Parametrisk lysboks-ramme med presise 3.2 mm innstikksspor for 4 utskiftbare litofani-bildeplater og holder i bunnen for LED-telys eller E14-sokkel.',
    defaultMaterial: 'PLA_MATTE',
    defaultColorHex: '#111111',
    proceduralPreset: 'CYBER_HELMET',
    boundingBoxMm: { x: 108, y: 108, z: 115 },
    volumeCm3: 76.0,
    overhangRatio: 0.14,
    scadSource: `include <BOSL2/std.scad>

/* [Lysboks & Litofani-mål] */
// Ytre bredde og dybde på lysboksen (mm)
BOX_SIZE_MM = 105; // [70:5:180]

// Total høyde på lysboksen (mm)
BOX_HEIGHT_MM = 115; // [70:5:200]

// Bredde på hjørnesøylene (mm)
PILLAR_WIDTH_MM = 10; // [7:1:18]

// Sporbredde for litofani-bildeplater (mm)
SLOT_WIDTH_MM = 3.2; // [2.4:0.2:4.5]

/* [Lyskilde i bunnen] */
// Diameter på lyskilde-holder i bunnen (39 = LED-telys, 28 = E14 sokkel, 40 = E27)
LIGHT_SOCKET_DIA_MM = 39; // [28:E14 Lampefatning (28mm), 39:Standard LED-telys (39mm), 40:E27 Fatning (40mm)]

/* [Hidden] */
$fn = 48;

WINDOW_W = BOX_SIZE_MM - PILLAR_WIDTH_MM * 2;
WINDOW_H = BOX_HEIGHT_MM - PILLAR_WIDTH_MM * 1.6;

difference() {
  union() {
    // Ytre rammeskall
    cuboid([BOX_SIZE_MM, BOX_SIZE_MM, BOX_HEIGHT_MM], rounding = 4, anchor = BOTTOM);

    // Senterkrage i bunnen for LED-telys / lampefatning
    up(3.8)
      tube(od = LIGHT_SOCKET_DIA_MM + 6, id = LIGHT_SOCKET_DIA_MM, h = 10, anchor = BOTTOM);
  }

  // Innvendig hovedkammer (åpent i toppen for å sette ned litofani-plater)
  up(4.0)
    cuboid(
      [BOX_SIZE_MM - PILLAR_WIDTH_MM * 2, BOX_SIZE_MM - PILLAR_WIDTH_MM * 2, BOX_HEIGHT_MM],
      rounding = 2,
      anchor = BOTTOM
    );

  // Innstikksspor på alle 4 sider for litofani-plater
  up(6.0) {
    for (rot_a = [0, 90]) {
      rotate([0, 0, rot_a])
        for (sy = [-1, 1]) {
          translate([0, sy * (BOX_SIZE_MM / 2 - PILLAR_WIDTH_MM / 2), 0])
            cuboid([BOX_SIZE_MM - PILLAR_WIDTH_MM, SLOT_WIDTH_MM, BOX_HEIGHT_MM], anchor = BOTTOM);
        }
    }
  }

  // Lysvinduer gjennom alle 4 sider
  translate([0, 0, PILLAR_WIDTH_MM + WINDOW_H / 2]) {
    cuboid([WINDOW_W, BOX_SIZE_MM + 4, WINDOW_H], rounding = 2, anchor = CENTER);
    cuboid([BOX_SIZE_MM + 4, WINDOW_W, WINDOW_H], rounding = 2, anchor = CENTER);
  }

  // Kabel-/luftehull i bunnen når E14/E27 er valgt
  if (LIGHT_SOCKET_DIA_MM != 39) {
    down(0.5)
      cylinder(d = LIGHT_SOCKET_DIA_MM, h = 6);
  }
}
`,
  },
];

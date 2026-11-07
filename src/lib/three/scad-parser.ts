export interface ScadParameterDef {
  name: string;
  label: string;
  group: string;
  type?: 'number' | 'string';
  defaultValue: number;
  defaultString?: string;
  maxLength?: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  options?: { label: string; value: number }[];
}

function formatIdentifierToLabel(identifier: string): string {
  return identifier
    .toLowerCase()
    .replace(/_mm$/i, '')
    .replace(/_deg$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferUnitFromNameAndLabel(name: string, label: string): string {
  const combined = `${name} ${label}`.toLowerCase();
  if (
    combined.includes('count') ||
    combined.includes('antall') ||
    combined.includes('rows') ||
    combined.includes('cols') ||
    combined.includes('columns') ||
    combined.includes('num_') ||
    combined.includes('slots') ||
    combined.includes('holes') ||
    combined.includes('grid_x') ||
    combined.includes('grid_y') ||
    combined.includes('height_units') ||
    combined.includes('compartments') ||
    combined.includes('dividers') ||
    combined.includes('latches') ||
    combined.includes('facets') ||
    combined.includes('waves') ||
    combined.includes('knurl')
  ) {
    return 'stk';
  }
  if (
    combined.includes('angle') ||
    combined.includes('vinkel') ||
    combined.includes('deg') ||
    combined.includes('twist') ||
    combined.includes('rotasjon')
  ) {
    return '°';
  }
  if (combined.includes('percent') || combined.includes('prosent') || combined.includes('%')) {
    return '%';
  }
  return 'mm';
}

function inferDefaultRange(
  _name: string,
  defaultValue: number,
  unit: string
): { min: number; max: number; step: number } {
  const isFloat = !Number.isInteger(defaultValue);

  if (defaultValue < 0) {
    const absVal = Math.abs(defaultValue);
    const min = -Math.max(Math.round(absVal * 1.8), Math.round(absVal + 25));
    const max = Math.min(0, -Math.max(1, Math.round(absVal * 0.25)));
    return {
      min,
      max,
      step: isFloat ? 0.5 : 1,
    };
  }

  if (unit === 'stk') {
    return {
      min: Math.max(0, Math.min(1, Math.floor(defaultValue))),
      max: Math.max(8, Math.ceil(defaultValue * 2.5)),
      step: 1,
    };
  }

  if (unit === '°') {
    return {
      min: 0,
      max: 180,
      step: 5,
    };
  }

  const absVal = Math.abs(defaultValue) || 10;
  if (absVal <= 6 || isFloat) {
    return {
      min: Math.max(0.2, Number((absVal * 0.4).toFixed(1))),
      max: Math.max(Number((absVal * 2.2).toFixed(1)), Number((absVal + 5).toFixed(1))),
      step: isFloat ? 0.2 : 0.5,
    };
  }

  return {
    min: Math.max(5, Math.round((absVal * 0.35) / 5) * 5),
    max: Math.min(350, Math.max(Math.round(absVal * 2.0), Math.round(absVal + 40))),
    step: absVal >= 30 ? 2 : 1,
  };
}

/**
 * Parses standard OpenSCAD (.scad) Customizer parameters from top-level variable declarations.
 * Supports:
 * - `/* [Group Name] * /`
 * - `// Description comment above variable`
 * - `var = 80; // [20:5:200]`
 * - `var = 80; // [20:200]`
 * - `var = 5.5; // [3.5:M3, 4.5:M4, 5.5:M5, 6.5:M6]`
 * - Plain `var = 80;` (automatically infers range)
 */
export function parseScadParameters(scadSource: string): ScadParameterDef[] {
  const lines = scadSource.split(/\r?\n/);
  const params: ScadParameterDef[] = [];

  let currentGroup = 'Parametere';
  let pendingComment: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      pendingComment = null;
      continue;
    }

    // Check for /* [Group] */
    const groupMatch = line.match(/^\/\*\s*\[([^\]]+)\]\s*\*\/$/);
    if (groupMatch && groupMatch[1]) {
      const grp = groupMatch[1].trim();
      if (grp.toLowerCase() === 'hidden') {
        break;
      }
      currentGroup = grp;
      pendingComment = null;
      continue;
    }

    // Stop scanning top-level customizer variables once geometry modules/primitives begin
    if (
      /^(module|function|union|difference|intersection|hull|minkowski|translate|rotate|scale|mirror|cube|cylinder|sphere|polyhedron|linear_extrude|rotate_extrude|cuboid|cyl|tube|rect_tube|up|down|left|right|fwd|back|for|if)\b/.test(
        line
      )
    ) {
      break;
    }

    // Single-line description comment before variable
    if (line.startsWith('//')) {
      const cleanComment = line.replace(/^\/\/+\s*/, '').trim();
      if (cleanComment && !cleanComment.startsWith('[')) {
        pendingComment = cleanComment;
      }
      continue;
    }

    // Skip special OpenSCAD rendering variables like $fn = 64;
    if (line.startsWith('$')) {
      pendingComment = null;
      continue;
    }

    // Match top-level string assignment: CUSTOM_TEXT = "SINDRE"; // [12]
    const stringMatch = line.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"\s*;(?:\s*\/\/\s*(.*))?$/
    );

    if (stringMatch) {
      const varName = stringMatch[1]!;
      const defaultString = stringMatch[2] ?? '';
      const inlineComment = stringMatch[3]?.trim() || '';

      if (!varName.startsWith('_')) {
        let label = pendingComment || formatIdentifierToLabel(varName);
        if (!pendingComment && inlineComment && !inlineComment.startsWith('[')) {
          label = inlineComment;
        }
        let maxLength = 16;
        const maxLenMatch = inlineComment.match(/\[(\d+)\]/);
        if (maxLenMatch && maxLenMatch[1]) {
          maxLength = Math.min(32, Math.max(1, parseInt(maxLenMatch[1], 10)));
        }

        params.push({
          name: varName,
          label,
          group: currentGroup,
          type: 'string',
          defaultValue: 0,
          defaultString,
          maxLength,
          min: 0,
          max: maxLength,
          step: 1,
          unit: 'tekst',
        });
      }

      pendingComment = null;
      continue;
    }

    // Match top-level numeric assignment: name = 123.45; // optional comment
    const assignMatch = line.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;(?:\s*\/\/\s*(.*))?$/
    );

    if (assignMatch) {
      const varName = assignMatch[1]!;
      const defaultValue = parseFloat(assignMatch[2]!);
      const inlineComment = assignMatch[3]?.trim() || '';

      if (
        Number.isNaN(defaultValue) ||
        /^(eps|epsilon|tol|tolerance|pi)$/i.test(varName) ||
        varName.startsWith('_')
      ) {
        pendingComment = null;
        continue;
      }

      // Extract label from pendingComment or non-bracket inline comment
      let label = pendingComment || formatIdentifierToLabel(varName);
      if (!pendingComment && inlineComment && !inlineComment.startsWith('[')) {
        label = inlineComment;
      }

      const unit = inferUnitFromNameAndLabel(varName, label);
      let { min, max, step } = inferDefaultRange(varName, defaultValue, unit);
      let options: { label: string; value: number }[] | undefined;

      // Parse bracketed Customizer spec: // [min:step:max] or [min:max] or [v1:L1, v2:L2]
      const bracketMatch = inlineComment.match(/\[([^\]]+)\]/);
      if (bracketMatch && bracketMatch[1]) {
        const inner = bracketMatch[1].trim();

        if (inner.includes(',')) {
          // Options list: [3.5:M3, 4.5:M4, 5.5:M5] or [3, 4, 5, 6]
          const parsedOpts: { label: string; value: number }[] = [];
          for (const part of inner.split(',')) {
            const pieces = part.split(':').map((s) => s.trim());
            const numVal = parseFloat(pieces[0] || '');
            if (!Number.isNaN(numVal)) {
              parsedOpts.push({
                value: numVal,
                label: pieces[1] ? `${pieces[1]} (${numVal})` : `${numVal} ${unit}`,
              });
            }
          }
          if (parsedOpts.length > 0) {
            options = parsedOpts;
            const vals = parsedOpts.map((o) => o.value);
            min = Math.min(...vals);
            max = Math.max(...vals);
            step = vals.some((v) => !Number.isInteger(v)) ? 0.5 : 1;
          }
        } else if (inner.includes(':')) {
          const rangeParts = inner.split(':').map((s) => parseFloat(s.trim()));
          if (rangeParts.length === 3 && rangeParts.every((n) => !Number.isNaN(n))) {
            min = rangeParts[0]!;
            step = rangeParts[1]!;
            max = rangeParts[2]!;
          } else if (rangeParts.length === 2 && rangeParts.every((n) => !Number.isNaN(n))) {
            min = rangeParts[0]!;
            max = rangeParts[1]!;
            step = !Number.isInteger(defaultValue) || !Number.isInteger(min) ? 0.2 : 1;
          }
        }
      }

      params.push({
        name: varName,
        label,
        group: currentGroup,
        type: 'number',
        defaultValue,
        min,
        max,
        step,
        unit,
        options,
      });

      pendingComment = null;
    } else {
      pendingComment = null;
    }
  }

  return params;
}

/**
 * Sample OpenSCAD (.scad) file with Customizer annotations that admins can load with one click
 * or save as a .scad file to test genuine OpenSCAD parametric compilation.
 */
export const SAMPLE_OPENSCAD_FILE_CONTENT = `/* [Hovedmål] */
// Ytre lengde på monteringsbraketten (mm)
plate_length = 110; // [50:5:220]

// Ytre bredde på monteringsbraketten (mm)
plate_width = 65; // [35:5:160]

// Basens tykkelse (mm)
plate_thickness = 6; // [3:1:14]

/* [Senterhylse & Skruehull] */
// Indre diameter på senterhull / rørgjennomføring (mm)
center_bore_dia = 26; // [8:1:80]

// Høyde på forsterket senterkrage (mm)
collar_height = 24; // [6:2:80]

// Veggtykkelse på senterkrage (mm)
collar_wall = 5; // [3:0.5:12]

// Skruehull i hjørnene (mm)
bolt_hole_dia = 5.5; // [3.5:M3, 4.5:M4, 5.5:M5, 6.5:M6, 8.5:M8]

/* [Hidden] */
$fn = 56;

difference() {
  union() {
    // Avrundet monteringsplate
    hull() {
      for (x = [-plate_length/2 + 8, plate_length/2 - 8])
        for (y = [-plate_width/2 + 8, plate_width/2 - 8])
          translate([x, y, 0])
            cylinder(r = 8, h = plate_thickness);
    }

    // Senterkrage + avstivningsflens
    cylinder(d1 = center_bore_dia + collar_wall * 3.2, d2 = center_bore_dia + collar_wall * 2, h = plate_thickness + collar_height);
  }

  // Gjennomgående senterhull
  translate([0, 0, -1])
    cylinder(d = center_bore_dia, h = plate_thickness + collar_height + 2);

  // 4 hjørne-skruehull med forsenkning
  for (x = [-plate_length/2 + 11, plate_length/2 - 11])
    for (y = [-plate_width/2 + 11, plate_width/2 - 11]) {
      translate([x, y, -1])
        cylinder(d = bolt_hole_dia, h = plate_thickness + 2);
      translate([x, y, plate_thickness - 2])
        cylinder(d = bolt_hole_dia * 1.8, h = 3);
    }
}
`;

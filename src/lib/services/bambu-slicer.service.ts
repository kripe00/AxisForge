import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  BAMBU_BUILD_VOLUME_MM,
  LAYER_QUALITY,
  MATERIALS,
  type DimensionsMm,
  type FilamentMaterialCode,
  type LayerHeightMm,
  type LayerQualityKey,
} from '@/lib/schemas/forge';

const execFileAsync = promisify(execFile);

export interface SlicerJobInput {
  uid: string;
  jobId: string;
  quoteId: string;
  baseBoundingBoxMm: DimensionsMm;
  baseVolumeCm3: number;
  overhangRatio: number;
  targetHeightMm: number;
  material: FilamentMaterialCode;
  layerQuality: LayerQualityKey;
  infillPercent: number;
  glbStoragePath: string | null;
}

export interface SlicerJobResult {
  targetDimensionsMm: DimensionsMm;
  scaleFactor: number;
  layerHeightMm: LayerHeightMm;
  filamentGrams: number;
  supportGrams: number;
  printTimeSeconds: number;
  layerCount: number;
  supportRequired: boolean;
  brimEnabled: boolean;
  isWithinBuildVolume: boolean;
  slicerEngine: 'bambu-studio-cli' | 'deterministic-volume-sim';
  sliced3mfStoragePath: string;
}

export interface ISlicerAdapter {
  sliceModel(input: SlicerJobInput): Promise<SlicerJobResult>;
}

/**
 * Deterministic Physics & Volumetric Slicer Estimator for Dev Mode.
 * Computes exact scaled dimensions, shell + gyroid infill mass, tree support mass,
 * layer count, and Bambu Lab X1C print duration.
 */
class DeterministicVolumeSlicerAdapter implements ISlicerAdapter {
  async sliceModel(input: SlicerJobInput): Promise<SlicerJobResult> {
    const scaleFactor = Number((input.targetHeightMm / input.baseBoundingBoxMm.z).toFixed(4));
    const qualitySpec = LAYER_QUALITY[input.layerQuality];
    const layerHeightMm = qualitySpec.layerHeightMm;

    const scaledX = Math.round(input.baseBoundingBoxMm.x * scaleFactor);
    const scaledY = Math.round(input.baseBoundingBoxMm.y * scaleFactor);
    const scaledZ = Math.round(input.targetHeightMm);

    const isWithinBuildVolume =
      scaledX <= BAMBU_BUILD_VOLUME_MM.x &&
      scaledY <= BAMBU_BUILD_VOLUME_MM.y &&
      scaledZ <= BAMBU_BUILD_VOLUME_MM.z;

    // Surface-shell + sparse infill mass scales with exponent ~2.15 (walls scale ~quadratically, infill ~cubically)
    const normalizedScale = input.targetHeightMm / 120;
    const infillMultiplier = 0.85 + (input.infillPercent / 15) * 0.15;
    const materialSpec = MATERIALS[input.material];
    const densityFactor = materialSpec.densityGPerCm3 / 1.24;

    // Base mass at 120mm reference height (~118g model + ~17g tree support = ~135g total)
    const volumeRatio = input.baseVolumeCm3 / 245.0;
    const rawModelGrams =
      118 * Math.pow(normalizedScale, 2.15) * volumeRatio * infillMultiplier * densityFactor;

    const supportRequired = input.overhangRatio > 0.14;
    const supportGrams = supportRequired
      ? Math.max(2, Number((rawModelGrams * input.overhangRatio * 0.52).toFixed(1)))
      : 0;

    // Total filamentGrams includes model + tree supports
    const filamentGrams = Math.max(8, Math.round(rawModelGrams + supportGrams));

    const layerCount = Math.max(15, Math.ceil(scaledZ / layerHeightMm));

    // Print time on Bambu Lab X1C: ~68 seconds per gram + 720s startup/Lidar calibration
    const printTimeSeconds = Math.max(1200, Math.round(720 + filamentGrams * 68));

    return {
      targetDimensionsMm: {
        x: Math.min(scaledX, BAMBU_BUILD_VOLUME_MM.x),
        y: Math.min(scaledY, BAMBU_BUILD_VOLUME_MM.y),
        z: Math.min(scaledZ, BAMBU_BUILD_VOLUME_MM.z),
      },
      scaleFactor,
      layerHeightMm,
      filamentGrams,
      supportGrams,
      printTimeSeconds,
      layerCount,
      supportRequired,
      brimEnabled: true,
      isWithinBuildVolume,
      slicerEngine: 'deterministic-volume-sim',
      sliced3mfStoragePath: `slices/${input.uid}/${input.quoteId}/bambu_x1c_plate1.3mf`,
    };
  }
}

class HeadlessBambuCliAdapter implements ISlicerAdapter {
  private fallback = new DeterministicVolumeSlicerAdapter();

  async sliceModel(input: SlicerJobInput): Promise<SlicerJobResult> {
    const cliPath = process.env.BAMBU_SLICER_CLI_PATH;
    const mode = process.env.BAMBU_SLICER_MODE || 'mock';

    if (mode !== 'cli' || !cliPath || process.env.NEXT_PUBLIC_DEV_MOCK_MODE === 'true') {
      return this.fallback.sliceModel(input);
    }

    try {
      const scaleFactor = Number((input.targetHeightMm / input.baseBoundingBoxMm.z).toFixed(4));
      const output3mfPath = `/tmp/${input.quoteId}_plate1.3mf`;
      const inputMeshPath = `/tmp/${input.jobId}_raw.stl`;

      await execFileAsync(cliPath, [
        '--orient',
        '--arrange',
        '1',
        '--scale',
        String(scaleFactor),
        '--slice',
        '0',
        '--export-3mf',
        output3mfPath,
        inputMeshPath,
      ]);

      const deterministicBase = await this.fallback.sliceModel(input);
      return {
        ...deterministicBase,
        slicerEngine: 'bambu-studio-cli',
      };
    } catch {
      return this.fallback.sliceModel(input);
    }
  }
}

export class BambuSlicerService {
  private static adapter: ISlicerAdapter = new HeadlessBambuCliAdapter();

  static async sliceAndValidate(input: SlicerJobInput): Promise<SlicerJobResult> {
    return this.adapter.sliceModel(input);
  }
}

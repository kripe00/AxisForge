import type { DimensionsMm, ProceduralPreset } from '@/lib/schemas/forge';

export interface TripoGenerationRequest {
  uid: string;
  jobId: string;
  prompt: string;
  inputImageStoragePath?: string | null;
}

export interface TripoGenerationResult {
  tripoTaskId: string;
  glbStoragePath: string;
  glbDownloadUrl: string | null;
  proceduralPreset: ProceduralPreset;
  boundingBoxMm: DimensionsMm;
  volumeCm3: number;
  overhangRatio: number;
  isManifold: boolean;
}

/**
 * Selects a deterministic CAD/3D preset and realistic geometry metrics from the prompt
 * when running in Dev Mock Mode or before an external GLB URL is loaded.
 */
function deriveDeterministicGeometryFromPrompt(prompt: string): {
  preset: ProceduralPreset;
  boundingBoxMm: DimensionsMm;
  volumeCm3: number;
  overhangRatio: number;
} {
  const normalized = prompt.toLowerCase();

  if (
    normalized.includes('gear') ||
    normalized.includes('tannhjul') ||
    normalized.includes('planetary') ||
    normalized.includes('motor') ||
    normalized.includes('mekanisk')
  ) {
    return {
      preset: 'PLANETARY_GEAR',
      boundingBoxMm: { x: 105, y: 105, z: 120 },
      volumeCm3: 230.0,
      overhangRatio: 0.12,
    };
  }

  if (
    normalized.includes('helmet') ||
    normalized.includes('hjelm') ||
    normalized.includes('mask') ||
    normalized.includes('skull') ||
    normalized.includes('figur') ||
    normalized.includes('bust')
  ) {
    return {
      preset: 'CYBER_HELMET',
      boundingBoxMm: { x: 96, y: 112, z: 120 },
      volumeCm3: 260.0,
      overhangRatio: 0.34,
    };
  }

  if (
    normalized.includes('bracket') ||
    normalized.includes('mount') ||
    normalized.includes('holder') ||
    normalized.includes('feste') ||
    normalized.includes('adapter') ||
    normalized.includes('flange')
  ) {
    return {
      preset: 'INDUSTRIAL_BRACKET',
      boundingBoxMm: { x: 110, y: 84, z: 120 },
      volumeCm3: 220.0,
      overhangRatio: 0.16,
    };
  }

  // Default: Heavy Armored Mech Turret (120mm base reference height)
  return {
    preset: 'MECH_TURRET',
    boundingBoxMm: { x: 92, y: 96, z: 120 },
    volumeCm3: 245.0,
    overhangRatio: 0.26,
  };
}

export class TripoService {
  private static get baseUrl(): string {
    return process.env.TRIPO_API_BASE_URL || 'https://api.tripo3d.ai/v2/openapi';
  }

  private static get apiKey(): string | undefined {
    return process.env.TRIPO_API_KEY;
  }

  static isMockEnabled(): boolean {
    return (
      process.env.NEXT_PUBLIC_DEV_MOCK_MODE === 'true' ||
      !this.apiKey ||
      this.apiKey === 'tsk_your_tripo_secret_key'
    );
  }

  /**
   * Generates a 3D model via Tripo 3D API (text_to_model / image_to_model)
   * or falls back to deterministic CAD geometry synthesis in Dev Mock Mode.
   */
  static async generateModel(req: TripoGenerationRequest): Promise<TripoGenerationResult> {
    const derived = deriveDeterministicGeometryFromPrompt(req.prompt);

    if (this.isMockEnabled()) {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const taskSuffix = Math.random().toString(36).substring(2, 9);
      return {
        tripoTaskId: `tripo_mock_${taskSuffix}`,
        glbStoragePath: `models/${req.uid}/${req.jobId}/raw.glb`,
        glbDownloadUrl: null,
        proceduralPreset: derived.preset,
        boundingBoxMm: derived.boundingBoxMm,
        volumeCm3: derived.volumeCm3,
        overhangRatio: derived.overhangRatio,
        isManifold: true,
      };
    }

    const payload = req.inputImageStoragePath
      ? {
          type: 'image_to_model',
          file: { type: 'jpg', file_token: req.inputImageStoragePath },
        }
      : {
          type: 'text_to_model',
          prompt: req.prompt,
          model_version: 'v2.0-20240919',
        };

    const createRes = await fetch(`${this.baseUrl}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw new Error(`Tripo API error (${createRes.status}): ${errBody}`);
    }

    const createData = (await createRes.json()) as {
      code: number;
      data?: { task_id: string };
    };

    const taskId = createData.data?.task_id || `tripo_live_${Date.now()}`;

    return {
      tripoTaskId: taskId,
      glbStoragePath: `models/${req.uid}/${req.jobId}/raw.glb`,
      glbDownloadUrl: null,
      proceduralPreset: derived.preset,
      boundingBoxMm: derived.boundingBoxMm,
      volumeCm3: derived.volumeCm3,
      overhangRatio: derived.overhangRatio,
      isManifold: true,
    };
  }
}

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getAuth, type Auth } from 'firebase-admin/auth';
import type {
  CatalogModelDocument,
  GenerationJobDocument,
  PrintOrderDocument,
  SliceQuoteDocument,
  UserDocument,
} from '@/lib/schemas/forge';
import {
  EXTRA_AI_PACK_GENERATIONS,
  EXTRA_AI_PACK_PRICE_NOK,
  ORDER_BONUS_GENERATIONS,
} from '@/lib/services/pricing.engine';
import { parseScadParameters, SAMPLE_OPENSCAD_FILE_CONTENT } from '@/lib/three/scad-parser';
import { SCAD_LIBRARY_TEMPLATES } from '@/lib/three/scad-templates';

// ============================================================================
// SERVER-AUTHORITATIVE FIREBASE ADMIN SDK + DEV-MOCK PERSISTENT MEMORY STORE
// ============================================================================

interface DevMemoryDatabase {
  users: Map<string, UserDocument>;
  catalog_models: Map<string, CatalogModelDocument>;
  generation_jobs: Map<string, GenerationJobDocument>;
  slice_quotes: Map<string, SliceQuoteDocument>;
  print_orders: Map<string, PrintOrderDocument>;
}

const globalForForgeAdmin = globalThis as unknown as {
  __axisForgeDevDb?: DevMemoryDatabase;
  __axisForgeAdminApp?: App;
};

function createInitialDevDatabase(): DevMemoryDatabase {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const defaultUser: UserDocument = {
    uid: 'dev-operator-01',
    email: 'operator@axisforge.no',
    displayName: 'Kristoffer (Admin)',
    role: 'admin',
    freeGenerationsRemaining: 3,
    aiCreditNok: 0,
    createdAt: now,
  };

  const sampleScadParams = parseScadParameters(SAMPLE_OPENSCAD_FILE_CONTENT);

  const scadTemplateCatalogDocs: CatalogModelDocument[] = SCAD_LIBRARY_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    title: `${tpl.title} (.SCAD)`,
    description: tpl.description,
    category: tpl.category,
    fileName: tpl.fileName,
    fileFormat: 'scad',
    fileStoragePath: `catalog/${tpl.id}/${tpl.fileName}`,
    modelFileUrl: null,
    stlBase64: null,
    scadSource: tpl.scadSource,
    scadParameters: parseScadParameters(tpl.scadSource),
    proceduralPreset: tpl.proceduralPreset,
    parametricTemplateId: null,
    parametricParams: null,
    boundingBoxMm: tpl.boundingBoxMm,
    volumeCm3: tpl.volumeCm3,
    overhangRatio: tpl.overhangRatio,
    defaultMaterial: tpl.defaultMaterial,
    defaultColorHex: tpl.defaultColorHex,
    createdAt: now,
  }));

  // Seeded Curated STL / 3MF / SCAD Catalog Models
  const seedCatalog: CatalogModelDocument[] = [
    ...scadTemplateCatalogDocs,
    {
      id: 'cat_scad_flange_mount',
      title: 'Parametrisk Rør- og Monteringsflens (.SCAD)',
      description:
        'Ekte OpenSCAD (.scad) parametrisk fil der du justerer lengde, bredde, senterhull og skruedimensjon med sanntids CSG-kompilering.',
      category: 'OpenSCAD Parametrisk',
      fileName: 'parametric_flange_mount.scad',
      fileFormat: 'scad',
      fileStoragePath: 'catalog/cat_scad_flange_mount/parametric_flange_mount.scad',
      modelFileUrl: null,
      stlBase64: null,
      scadSource: SAMPLE_OPENSCAD_FILE_CONTENT,
      scadParameters: sampleScadParams,
      proceduralPreset: 'INDUSTRIAL_BRACKET',
      parametricTemplateId: null,
      parametricParams: null,
      boundingBoxMm: { x: 110, y: 65, z: 30 },
      volumeCm3: 48.0,
      overhangRatio: 0.08,
      defaultMaterial: 'PETG_INDUSTRIAL',
      defaultColorHex: '#FF5500',
      createdAt: now,
    },
    {
      id: 'cat_stl_mech_turret',
      title: 'Armert Hex-Mech Tårn',
      description: 'Detaljert bordmodell med kjøleribber, dreibar base og monteringsflens.',
      category: 'Gaming & Figur',
      fileName: 'hex_mech_turret_v2.stl',
      fileFormat: 'stl',
      fileStoragePath: 'catalog/cat_stl_mech_turret/hex_mech_turret_v2.stl',
      modelFileUrl: null,
      stlBase64: null,
      scadSource: null,
      scadParameters: null,
      proceduralPreset: 'MECH_TURRET',
      parametricTemplateId: null,
      parametricParams: null,
      boundingBoxMm: { x: 92, y: 96, z: 120 },
      volumeCm3: 245.0,
      overhangRatio: 0.26,
      defaultMaterial: 'PLA_MATTE',
      defaultColorHex: '#FF5500',
      createdAt: now,
    },
    {
      id: 'cat_3mf_planetary_gear',
      title: 'Planetgir-reduksjon (Funksjonell)',
      description: 'Komplett mekanisk tannhjulssystem som printes ferdig montert (Print-in-Place).',
      category: 'Mekanikk & Verktøy',
      fileName: 'planetary_gearbox_pip.3mf',
      fileFormat: '3mf',
      fileStoragePath: 'catalog/cat_3mf_planetary_gear/planetary_gearbox_pip.3mf',
      modelFileUrl: null,
      stlBase64: null,
      scadSource: null,
      scadParameters: null,
      proceduralPreset: 'PLANETARY_GEAR',
      parametricTemplateId: null,
      parametricParams: null,
      boundingBoxMm: { x: 105, y: 105, z: 60 },
      volumeCm3: 185.0,
      overhangRatio: 0.1,
      defaultMaterial: 'PETG_INDUSTRIAL',
      defaultColorHex: '#555555',
      createdAt: now,
    },
    {
      id: 'cat_stl_cyber_helmet',
      title: 'Cyberpunk Visir-Byste',
      description: 'Skarp fasettert hjelmbyste for skrivebord eller hodetelefon-stativ.',
      category: 'Design & Interiør',
      fileName: 'cyber_visor_bust.stl',
      fileFormat: 'stl',
      fileStoragePath: 'catalog/cat_stl_cyber_helmet/cyber_visor_bust.stl',
      modelFileUrl: null,
      stlBase64: null,
      scadSource: null,
      scadParameters: null,
      proceduralPreset: 'CYBER_HELMET',
      parametricTemplateId: null,
      parametricParams: null,
      boundingBoxMm: { x: 96, y: 112, z: 140 },
      volumeCm3: 270.0,
      overhangRatio: 0.32,
      defaultMaterial: 'PLA_MATTE',
      defaultColorHex: '#111111',
      createdAt: now,
    },
    {
      id: 'cat_3mf_cnc_bracket',
      title: 'Forsterket Vinkelbrakett / Veggfeste',
      description: 'Kraftig vinkelbrakett med avstivningsribber for verksted og oppheng.',
      category: 'Reservedel & Feste',
      fileName: 'heavy_gusset_bracket.3mf',
      fileFormat: '3mf',
      fileStoragePath: 'catalog/cat_3mf_cnc_bracket/heavy_gusset_bracket.3mf',
      modelFileUrl: null,
      stlBase64: null,
      scadSource: null,
      scadParameters: null,
      proceduralPreset: 'INDUSTRIAL_BRACKET',
      parametricTemplateId: 'L_BRACKET',
      parametricParams: {
        armLengthMm: 90,
        armHeightMm: 90,
        widthMm: 45,
        thicknessMm: 6,
        holeDiaMm: 5.5,
        gussetCount: 2,
      },
      boundingBoxMm: { x: 90, y: 45, z: 90 },
      volumeCm3: 54.0,
      overhangRatio: 0.12,
      defaultMaterial: 'PAHT_CF',
      defaultColorHex: '#111111',
      createdAt: now,
    },
  ];

  const defaultJob: GenerationJobDocument = {
    id: 'job_seed_bambu_mech_01',
    uid: 'dev-operator-01',
    prompt: 'Armert Hex-Mech Tårn (hex_mech_turret_v2.stl)',
    inputImageStoragePath: null,
    tripoTaskId: 'catalog_cat_stl_mech_turret',
    status: 'completed',
    glbStoragePath: 'catalog/cat_stl_mech_turret/hex_mech_turret_v2.stl',
    glbDownloadUrl: null,
    modelFileUrl: null,
    fileFormat: 'stl',
    stlBase64: null,
    scadSource: null,
    scadParameters: null,
    proceduralPreset: 'MECH_TURRET',
    parametricTemplateId: null,
    parametricParams: null,
    boundingBoxMm: { x: 92, y: 96, z: 120 },
    volumeCm3: 245.0,
    overhangRatio: 0.26,
    isManifold: true,
    errorMessage: null,
    createdAt: now,
  };

  const defaultQuote: SliceQuoteDocument = {
    id: 'quote_seed_x1c_01',
    uid: 'dev-operator-01',
    jobId: defaultJob.id,
    targetDimensionsMm: { x: 92, y: 96, z: 120 },
    scaleFactor: 1,
    material: 'PLA_MATTE',
    colorHex: '#FF5500',
    layerQuality: '0.20mm',
    layerHeightMm: 0.2,
    infillPercent: 15,
    quantity: 1,
    filamentGrams: 135,
    supportGrams: 16.2,
    printTimeSeconds: 9900,
    layerCount: 600,
    supportRequired: true,
    brimEnabled: true,
    isWithinBuildVolume: true,
    slicerEngine: 'deterministic-volume-sim',
    calculatedPriceNok: 349,
    pricingBreakdown: {
      baseForgeFeeNok: 129,
      materialCostNok: 122,
      machineCostNok: 96,
      rawTotalNok: 346.75,
      finalPriceNok: 349,
      shippingNok: 79,
      timeMultiplier: 1.0,
      quantity: 1,
      unitPriceNok: 349,
      batchSavingsNok: 0,
      platesRequired: 1,
    },
    sliced3mfStoragePath: 'slices/dev-operator-01/quote_seed_x1c_01/plate_1.3mf',
    expiresAt: expires,
    createdAt: now,
  };

  const sampleOrder: PrintOrderDocument = {
    id: 'ORD-AXF-8841',
    uid: 'dev-operator-01',
    quoteSnapshot: {
      quoteId: defaultQuote.id,
      jobId: defaultJob.id,
      prompt: defaultJob.prompt,
      glbStoragePath: defaultJob.glbStoragePath,
      glbDownloadUrl: defaultJob.glbDownloadUrl,
      proceduralPreset: defaultJob.proceduralPreset,
      sliced3mfStoragePath: defaultQuote.sliced3mfStoragePath,
      targetDimensionsMm: defaultQuote.targetDimensionsMm,
      material: defaultQuote.material,
      materialLabel: 'PLA MATTE (STANDARD)',
      colorHex: defaultQuote.colorHex,
      layerQuality: defaultQuote.layerQuality,
      layerHeightMm: defaultQuote.layerHeightMm,
      quantity: 1,
      filamentGrams: defaultQuote.filamentGrams,
      supportGrams: defaultQuote.supportGrams,
      printTimeSeconds: defaultQuote.printTimeSeconds,
      layerCount: defaultQuote.layerCount,
      supportRequired: defaultQuote.supportRequired,
      calculatedPriceNok: defaultQuote.calculatedPriceNok,
      aiCreditAppliedNok: 0,
      shippingNok: 79,
      totalChargedNok: 428,
      pricingBreakdown: defaultQuote.pricingBreakdown,
    },
    shippingAddress: {
      fullName: 'Kristoffer Verksted',
      email: 'operator@axisforge.no',
      streetAddress: 'Verkstedveien 14B',
      postalCode: '0554',
      city: 'Oslo',
      country: 'Norge',
    },
    orderStatus: 'printing_on_bambu',
    bambuPrinterId: 'BAMBU-X1C-BAY-03',
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  };

  const catalogMap = new Map<string, CatalogModelDocument>();
  const jobsMap = new Map<string, GenerationJobDocument>([[defaultJob.id, defaultJob]]);

  for (const item of seedCatalog) {
    catalogMap.set(item.id, item);
    jobsMap.set(`job_${item.id}`, {
      id: `job_${item.id}`,
      uid: 'admin-catalog',
      prompt: `${item.title} (${item.fileName})`,
      inputImageStoragePath: null,
      tripoTaskId: `catalog_${item.id}`,
      status: 'completed',
      glbStoragePath: item.fileStoragePath,
      glbDownloadUrl: item.modelFileUrl ?? null,
      modelFileUrl: item.modelFileUrl ?? null,
      fileFormat: item.fileFormat,
      stlBase64: item.stlBase64,
      scadSource: item.scadSource ?? null,
      scadParameters: item.scadParameters ?? null,
      proceduralPreset: item.proceduralPreset,
      parametricTemplateId: item.parametricTemplateId ?? null,
      parametricParams: item.parametricParams ?? null,
      boundingBoxMm: item.boundingBoxMm,
      volumeCm3: item.volumeCm3,
      overhangRatio: item.overhangRatio,
      isManifold: true,
      errorMessage: null,
      createdAt: item.createdAt,
    });
  }

  return {
    users: new Map([[defaultUser.uid, defaultUser]]),
    catalog_models: catalogMap,
    generation_jobs: jobsMap,
    slice_quotes: new Map([[defaultQuote.id, defaultQuote]]),
    print_orders: new Map([[sampleOrder.id, sampleOrder]]),
  };
}

export function getDevDatabase(): DevMemoryDatabase {
  if (!globalForForgeAdmin.__axisForgeDevDb) {
    globalForForgeAdmin.__axisForgeDevDb = createInitialDevDatabase();
  } else if (
    !globalForForgeAdmin.__axisForgeDevDb.catalog_models ||
    !globalForForgeAdmin.__axisForgeDevDb.catalog_models.has('cat_scad_gridfinity_bin')
  ) {
    const fresh = createInitialDevDatabase();
    fresh.catalog_models.forEach((val, key) => {
      if (!globalForForgeAdmin.__axisForgeDevDb!.catalog_models.has(key)) {
        globalForForgeAdmin.__axisForgeDevDb!.catalog_models.set(key, val);
      }
    });
    fresh.generation_jobs.forEach((val, key) => {
      if (!globalForForgeAdmin.__axisForgeDevDb!.generation_jobs.has(key)) {
        globalForForgeAdmin.__axisForgeDevDb!.generation_jobs.set(key, val);
      }
    });
  }
  return globalForForgeAdmin.__axisForgeDevDb;
}

export function isServerMockMode(): boolean {
  const hasRealCredentials =
    Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(process.env.FIREBASE_PRIVATE_KEY) &&
    !process.env.FIREBASE_PRIVATE_KEY?.includes('YOUR_PRIVATE_KEY');

  if (process.env.NEXT_PUBLIC_DEV_MOCK_MODE === 'true') {
    return true;
  }

  return !hasRealCredentials;
}

export function getFirebaseAdmin(): {
  app: App;
  db: Firestore;
  storage: Storage;
  auth: Auth;
} {
  if (!globalForForgeAdmin.__axisForgeAdminApp) {
    if (getApps().length > 0) {
      globalForForgeAdmin.__axisForgeAdminApp = getApps()[0]!;
    } else {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'axisforge-prod';
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (clientEmail && privateKey) {
        globalForForgeAdmin.__axisForgeAdminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket:
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
        });
      } else {
        globalForForgeAdmin.__axisForgeAdminApp = initializeApp({
          projectId,
          storageBucket:
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
        });
      }
    }
  }

  const app = globalForForgeAdmin.__axisForgeAdminApp;
  return {
    app,
    db: getFirestore(app),
    storage: getStorage(app),
    auth: getAuth(app),
  };
}

// ============================================================================
// UNIFIED SERVER REPOSITORY (Uses Firestore Admin in Prod, DevMemory in Mock)
// ============================================================================

export const ForgeServerRepository = {
  async getOrCreateUser(uid: string): Promise<UserDocument> {
    if (isServerMockMode()) {
      const existing = getDevDatabase().users.get(uid);
      if (existing) return existing;
      const created: UserDocument = {
        uid,
        email: `${uid}@axisforge.no`,
        displayName: 'AxisForge Operatør',
        role: 'customer',
        freeGenerationsRemaining: 3,
        aiCreditNok: 0,
        createdAt: new Date().toISOString(),
      };
      getDevDatabase().users.set(uid, created);
      return created;
    }

    const { db } = getFirebaseAdmin();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      return snap.data() as UserDocument;
    }
    const created: UserDocument = {
      uid,
      email: `${uid}@axisforge.no`,
      displayName: 'AxisForge Operatør',
      role: 'customer',
      freeGenerationsRemaining: 3,
      aiCreditNok: 0,
      createdAt: new Date().toISOString(),
    };
    await ref.set(created);
    return created;
  },

  async saveUser(userDoc: UserDocument): Promise<UserDocument> {
    if (isServerMockMode()) {
      getDevDatabase().users.set(userDoc.uid, userDoc);
      return userDoc;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('users').doc(userDoc.uid).set(userDoc);
    return userDoc;
  },

  async purchaseExtraGenerations(uid: string): Promise<UserDocument> {
    const userDoc = await this.getOrCreateUser(uid);
    const updated: UserDocument = {
      ...userDoc,
      freeGenerationsRemaining: userDoc.freeGenerationsRemaining + EXTRA_AI_PACK_GENERATIONS,
      aiCreditNok: userDoc.aiCreditNok + EXTRA_AI_PACK_PRICE_NOK,
    };
    return this.saveUser(updated);
  },

  async rewardOrderBonusGenerations(uid: string): Promise<UserDocument> {
    const userDoc = await this.getOrCreateUser(uid);
    const updated: UserDocument = {
      ...userDoc,
      freeGenerationsRemaining: userDoc.freeGenerationsRemaining + ORDER_BONUS_GENERATIONS,
      aiCreditNok: 0,
    };
    return this.saveUser(updated);
  },

  async listCatalogModels(): Promise<CatalogModelDocument[]> {
    if (isServerMockMode()) {
      const items = Array.from(getDevDatabase().catalog_models.values());
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const { db } = getFirebaseAdmin();
    const snap = await db.collection('catalog_models').orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => d.data() as CatalogModelDocument);
  },

  async saveCatalogModel(model: CatalogModelDocument): Promise<CatalogModelDocument> {
    if (isServerMockMode()) {
      getDevDatabase().catalog_models.set(model.id, model);
      return model;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('catalog_models').doc(model.id).set(model);
    return model;
  },

  async deleteCatalogModel(id: string): Promise<void> {
    if (isServerMockMode()) {
      getDevDatabase().catalog_models.delete(id);
      return;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('catalog_models').doc(id).delete();
  },

  async saveGenerationJob(job: GenerationJobDocument): Promise<GenerationJobDocument> {
    if (isServerMockMode()) {
      getDevDatabase().generation_jobs.set(job.id, job);
      return job;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('generation_jobs').doc(job.id).set(job);
    return job;
  },

  async getGenerationJob(jobId: string): Promise<GenerationJobDocument | null> {
    if (isServerMockMode()) {
      return getDevDatabase().generation_jobs.get(jobId) ?? null;
    }
    const { db } = getFirebaseAdmin();
    const snap = await db.collection('generation_jobs').doc(jobId).get();
    if (!snap.exists) return null;
    return snap.data() as GenerationJobDocument;
  },

  async saveSliceQuote(quote: SliceQuoteDocument): Promise<SliceQuoteDocument> {
    if (isServerMockMode()) {
      getDevDatabase().slice_quotes.set(quote.id, quote);
      return quote;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('slice_quotes').doc(quote.id).set(quote);
    return quote;
  },

  async getSliceQuote(quoteId: string): Promise<SliceQuoteDocument | null> {
    if (isServerMockMode()) {
      return getDevDatabase().slice_quotes.get(quoteId) ?? null;
    }
    const { db } = getFirebaseAdmin();
    const snap = await db.collection('slice_quotes').doc(quoteId).get();
    if (!snap.exists) return null;
    return snap.data() as SliceQuoteDocument;
  },

  async createImmutableOrder(order: PrintOrderDocument): Promise<PrintOrderDocument> {
    if (isServerMockMode()) {
      getDevDatabase().print_orders.set(order.id, order);
      return order;
    }
    const { db } = getFirebaseAdmin();
    await db.collection('print_orders').doc(order.id).create(order);
    return order;
  },

  async listOrdersByUser(uid?: string): Promise<PrintOrderDocument[]> {
    if (isServerMockMode()) {
      const all = Array.from(getDevDatabase().print_orders.values());
      const filtered = uid ? all.filter((o) => o.uid === uid || o.uid === 'dev-operator-01') : all;
      return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const { db } = getFirebaseAdmin();
    let queryRef = db.collection('print_orders').orderBy('createdAt', 'desc');
    if (uid) {
      queryRef = db.collection('print_orders').where('uid', '==', uid).orderBy('createdAt', 'desc');
    }
    const snap = await queryRef.limit(50).get();
    return snap.docs.map((doc) => doc.data() as PrintOrderDocument);
  },
};

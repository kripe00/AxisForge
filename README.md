# AxisForge — AI, Parametrisk (.SCAD) & CAD 3D-Print Studio

**AxisForge** er en fullstack plattform for 3D-printing og on-demand produksjon bygget med **Next.js 14 (App Router)**, **TypeScript**, **Three.js (`@react-three/fiber`)**, **OpenSCAD WebAssembly (`openscad-wasm` med Manifold-motor)**, **Google Gemini AI** og **Firebase**.

## Hovedfunksjoner

- **Parametrisk OpenSCAD (`.scad`) i nettleser og sky**:
  - Last opp egne `.scad`-filer eller generer skreddersydde, vannrette `.scad`-modeller med **Gemini 3.8 Flash** / **Gemini 3.1 Pro**.
  - Automatisk uthenting av OpenSCAD Customizer-variabler (`/* [Seksjon] */`, intervaller `[min:step:max]`) til sanntids skyvespaker i brukergrensesnittet.
  - Lynrask kompilering i minnet via **`openscad-wasm` (`--backend=Manifold`)** på ~200 ms – helt uten krav om lokalt installert OpenSCAD på serveren.
- **3D-modellopplasting (`.STL` & `.3MF`)**:
  - Direkte parsing og forhåndsvisning av både binære/ASCII `.STL`-filer og `.3MF`-pakker i 3D-arbeidsflaten.
- **Interaktiv 3D-byggeplate (`256 × 256 × 256 mm`)**:
  - Sanntids 3D-visning med målene i millimeter, automatisk gjennomsiktig byggeplate og underbelysning når kameraet roteres under modellen.
- **Sanntids Pris- og Slicer-motor**:
  - Beregner volum ($\text{cm}^3$), vekt (gram), printtid og stykkpris for **PLA**, **PETG**, **ABS** og **TPU** med volumrabatt.
- **Admin-portal (`/admin`)**:
  - Administrer ferdige katalogmodeller, last opp `.STL`/`.3MF`/`.SCAD`-filer eller generer nye parametriske katalogmodeller direkte med AI.

## Kom i gang lokalt

1. **Installer avhengigheter**:
   ```bash
   npm install
   ```

2. **Konfigurer miljøvariabler**:
   Kopier `.env.example` til `.env.local` og legg inn nøklene dine (f.eks. `GEMINI_API_KEY`):
   ```bash
   cp .env.example .env.local
   ```

3. **Start utviklingsserveren**:
   ```bash
   npm run dev
   ```
   Åpne [http://localhost:3000](http://localhost:3000) i nettleseren (og [http://localhost:3000/admin](http://localhost:3000/admin) for Admin-panelet).

## Kvalitetssjekk

```bash
npm run format   # Formaterer kode med Prettier
npm run check    # Kjører TypeScript-typesjekk (tsc --noEmit)
npm run lint     # Kjører ESLint
```

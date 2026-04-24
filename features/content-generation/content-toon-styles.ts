/**
 * Presets sent as `toonStyle` to content v2 / image gen — full art-direction for the model.
 * Keep in sync with defaults in ai-service `GeminiImageGenerator` and main-service `AiServiceContentV2Client`.
 */
export const DEFAULT_TOON_STYLE =
  'Western graphic novel toon: heavy bold outlines, aggressive shading with optional cross-hatching, high-energy composition; strong black linework defining forms, dramatic speed-line or energetic background, bold saturated colors flatter than photo realism, intense expressive faces.';

export const TOON_STYLE_OPTIONS: { label: string; value: string }[] = [
  {
    label: 'Comic Toon (Default)',
    value: DEFAULT_TOON_STYLE,
  },
  {
    label: 'Anime Toon',
    value:
      'Japanese animation toon aesthetic: soft idealized proportions, clean or thinner line work, cel-shading, brighter saturated colors; slightly larger expressive eyes, simplified nose and mouth, soft shading transitions, tasteful stylized sparkle or kawaii-inspired background accents.',
  },
  {
    label: 'Realistic',
    value:
      'Photorealistic high-resolution look: no cartoon outlines; natural complex lighting, shallow depth of field separating subject from background; fine textures (individual hair strands, fabric weave, skin detail); camera-like realism.',
  },
  {
    label: 'Flat Vector',
    value:
      'Flat minimalist vector / modern infographic: geometric precision, crisp edges or no outlines, solid flat color blocks with minimal gradients; shading via simple geometric shapes; clean scalable composition.',
  },
  {
    label: 'Retro Pop Art',
    value:
      'Retro American comic / Lichtenstein-inspired pop art: Ben-Day halftone dot patterns for shading instead of smooth gradients, very thick high-contrast outlines, oversaturated primary comic-book CMYK-like colors, poster-like graphic punch.',
  },
  {
    label: 'Cinematic',
    value:
      'Cinematic film-still mood: dramatic chiaroscuro lighting, teal-and-orange or moody color grade, subtle lens flares and bokeh; photorealistic subject rendering with epic, high-budget atmosphere.',
  },
];

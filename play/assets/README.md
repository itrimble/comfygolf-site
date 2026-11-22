# PBR asset pack

**The pack IS present.** `manifest.json` describes every item and the game
reports `PBR pack OK` in the HUD.

## Layout

```
public/assets/
  manifest.json                        what the loader reads
  decoders/                            DRACO + KTX2 decoder binaries
    draco_decoder.js
    draco_decoder.wasm
    draco_wasm_wrapper.js
    basis/
      basis_transcoder.js
      basis_transcoder.wasm
  characters/golfer/golfer_lod0.glb    the skinned, textured golfer
  characters/golfer/animations.glb    all eight clips in one file
  vegetation/tree_a_lod0.glb         near-detail tree (instanced)
  vegetation/tree_a_lod1.glb         cheap tree for distant instances
  vegetation/tree_olive_lod{0,1}.glb     card trees: three more species,
  vegetation/tree_broadleaf_lod{0,1}.glb each four photographs crossing at
  vegetation/tree_fir_lod{0,1}.glb       the trunk (two when far away)
  vegetation/shrub.glb               undergrowth shrub (instanced)
  vegetation/grass_clump.glb         grass tufts (instanced)
  equipment/club_driver.glb           club models
  equipment/club_iron.glb
  equipment/club_wedge.glb
  equipment/club_putter.glb
  materials/turf_basecolor.jpg        surface maps
  materials/turf_normal.jpg
  materials/turf_roughness.jpg
  materials/sand_basecolor.jpg
  materials/sand_normal.jpg
  materials/sand_roughness.jpg
  environment/clear_outdoor.hdr       the IBL environment
```

`decoders/` comes from the Three.js distribution - do not replace it.

## Conventions the loader follows

**Golfer.** `golfer_lod0.glb` is skinned (a `SkinnedMesh` with a 25-bone
skeleton: the 24 rig bones plus the `ClubHead` joint added by the pack
builder). The mixer roots on the loaded model so bone transforms drive the
mesh.

**Clips.** `animations.glb` carries all eight clips. Names are matched
case-insensitively by substring:

| Pattern | Used for |
|---|---|
| `driver`, `tee` | driver swing |
| `iron5`, `5iron`, `five`, `iron` | iron swings |
| `9iron`, `nine`, `iron` | 9-iron |
| `wedge`, `chip`, `pitch`, `approach` | wedge / chip |
| `putt`, `putter` | putting stroke |
| `reaction`, `disappointed`, `dejected` | restrained post-hole reaction |
| `celebrate`, `cheer`, `pump`, `excited` | positive post-hole reaction |
| `idle`, `ready`, `address` | standing idle |

The swing clips declare their impact frame in the glTF animation `extras`
(`impactAt`, 0..1 through the clip). The loader reads it; without it the
contact is assumed to be at 55 % of the clip.

**Bones.** The loader attaches the club models to the bone whose name contains
`hand` plus one of `right` / `r_` / `r.` (here: `RightHand`), and reads the
clubhead from the bone whose name contains `club` / `clubhead` / `shaft`
(here: `ClubHead`, a child of `RightHand`).

**Clubhead alignment.** `ClubHead` is positioned so that it lands EXACTLY on
the visual clubhead of whatever club is equipped: every club is normalised to
one common length (1.00 m) with its grip at the hand, so the bone and the
visible head coincide for all four clubs. The loader's impact correction
shifts the rig by that bone's world position, so the clubhead reaches the
ball rather than the hand.

**Scale.** The rig is authored in centimetres under an `Armature` node with a
0.01 scale. Every child of a bone inherits that scale, so the pack builder
compensates by `k = 1 / 0.01` when it parents the clubs and the clubhead
bone. Without that compensation the clubs render 100x too small and the
clubhead bone collapses with them.

**Vegetation.** Each model becomes one `InstancedMesh` per material, so a
forest of several hundred trees costs a handful of draw calls. Instances are
placed with the seeded scenery stream (`RNG_SCENERY`), so the layout is
identical on every run: trees scatter outside the playing corridor, shrubs
hug the fairway border, and grass tufts fill the rough.

Trees carry TWO meshes - the detailed `tree_a_lod0` and the cheap
`tree_a_lod1` - over ONE instance list. Each frame the renderer writes an
instance's matrix into whichever of the two suits its distance from the
camera, and drops instances past the cull distance entirely. The models
are normalised to a fixed real-world height (7.2 m trees, 1.5 m shrubs,
0.55 m grass) and stood on the terrain, with the pivot at the base.

Meshy exports these materials with `metallicFactor = 1`, which renders
foliage like wet plastic; the renderer forces them to dielectric.

**Card trees.** The olive, the broadleaf and the fir are Poly Haven scans
of real trees, which are film assets of one to five million vertices. The
game does not draw those. `scripts/build_card_trees.py` has Blender render
each from four sides and writes a model of four upright cards crossing at
the trunk, each carrying the view from its own side: 32 triangles a tree
near the camera (`_lod0`, a 2048 px atlas) and 16 beyond it (`_lod1`, two
views). The card normals lean outward so the sun shades the crown as one
round thing, and the renderer gives them a matte (Lambert) material - with
the PBR one, the bright sky's reflection washed the dark leaves out to
white. A mesh marked `extras.cards` is treated this way. From a few metres
away the crossing cards can be made out; the hole's hand-placed obstacle
trees, the ones a ball ends up under, stay the solid `tree_a` model.

`src/treeSpecies.ts` says which species a course grows and in what share
(a links grows no firs), and deals the one list of tree positions among
them in stands rather than a salt-and-pepper mix.

**Materials.** `turf_basecolor.jpg` is the Poly Haven `grass_ground`
albedo, colour-graded to a ~104 deg green hue (it ships as a dry olive
photograph) so the course reads as mown turf. The bunker is its own mesh
using the `sand_*` map set, so sand is a real PBR surface rather than a
tinted lawn. The turf maps are tiled once every ~8 m across the 200 x 380 m
terrain. The terrain keeps its per-surface vertex-colour tint, which is
multiplied over the maps, so fairway, green, bunker and rough still read as
different surfaces.

On top of the turf, each mown surface has its own photograph:
`fairway_basecolor.jpg` (a mown lawn, tiled every 4 m), `green_basecolor.jpg`
(a short even one, every 2.5 m) and `rough_basecolor.jpg` (a long coarse
one, every 5 m, parkland only: a links' rough is its own dry turf). Each
terrain vertex carries how much of each it stands on, and the terrain
shader (`src/terrainSurface.ts`) lays the photograph over the turf there,
adds the light and dark bands a mower leaves, and flattens the turf's
bumps on the fairway and green. The three are graded to the turf's own
average colour, so the tints still land where they were tuned. A pack
without them draws the turf alone.

**Environment.** `clear_outdoor.hdr` drives `scene.environment` (image-based
lighting: specular highlights and ambient bounce) and is the visible
background in CLEAR weather. The storm presets keep their own sky colour.

## Payload budget

Meshy ships every model with three 2048x2048 maps, which put the pack at
70 MB on the wire and ~380 MB of decoded texture memory - enough to make
the game appear to hang on a phone or a laptop over Tailscale, because the
browser downloads the lot and then tries to allocate hundreds of megabytes
of VRAM.

`scripts/downscale_textures.py` rewrites the images embedded in a GLB in
place (geometry, materials and JSON untouched), and
`tests/asset-payload.test.ts` fails the build if the pack exceeds its wire
or VRAM budget again. After the first downscale: **9.6 MB on the wire, ~57 MB of texture
memory.**

| Model | Texture size |
|---|---|
| `tree_a_lod0` | 1024 |
| `tree_a_lod1` | 512 |
| `tree_olive` / `tree_broadleaf` / `tree_fir` `_lod0` | 2048 (four 1024 views; the fir's are 512 x 2048) |
| the same, `_lod1` | 1024 x 512 (two views) |
| `shrub` | 512 |
| `grass_clump` | 256 |
| `golfer_lod0` | 1024 |
| clubs | 512 |
| turf base colour (`turf_basecolor`, `turf_links_basecolor`) | 2048 (1024 `_1k` copies for phones) |
| every other turf / sand map | 1024 |

## Provenance

| Item | Source | Licence |
|---|---|---|
| Golfer model + rig | Meshy AI (image-to-3d, then auto-rig) | private output, Pro tier |
| Animation clips | Meshy AI (text-to-motion applied to the rig) | private output, Pro tier |
| Club models | Meshy AI (image-to-3d from generated product shots) | private output, Pro tier |
| Vegetation models | Meshy AI (image-to-3d from generated reference shots) | private output, Pro tier |
| Parkland turf + sand maps | Poly Haven (`grass_ground`, `sand_01`) | CC0 |
| Links turf maps (`turf_links_*`) | Poly Haven (`withered_grass`) | CC0 |
| Links sand maps (`sand_links_*`) | Poly Haven (`coast_sand_04`) | CC0 |
| HDRI | Poly Haven (`kloofendal_43d_clear`) | CC0 |
| Card trees (`tree_olive`, `tree_broadleaf`, `tree_fir`) | Poly Haven models (`island_tree_02`, `tree_small_02`, `fir_tree_01` tree a), rendered to cards | CC0 |
| Fairway, green and rough photographs | ambientCG (`Grass008`, `Grass005`, `Grass004`) | CC0 |

`manifest.example.json` is kept as a reference for a non-standard layout.

## Behaviour if the pack goes missing again

The game still runs and is still playable:

* The golfer renders an explicit `ASSET PACK MISSING` diagnostic card in the
  scene instead of a stand-in character.
* The HUD shows `PACK MISSING` in amber with the missing paths listed.
* A committed shot still launches the ball: when no clip exists the game
  fires the impact itself after a short beat, and a watchdog guarantees a
  shot can never hang waiting for an impact that cannot arrive.

## Ground textures per course

Each course theme has its own turf and sand sets, named in `manifest.json`:
`turf` / `sand` for the parkland course and `turf_links` / `sand_links` for
the links course. Only the sets for the course in play are held in memory;
changing course loads the new sets and releases the old ones. A phone loads
the `baseColorMobile` map of a set when the manifest names one.

The maps are built from the Poly Haven 2K JPGs by
`scripts/build_terrain_textures.py <downloads-dir>`, which records the
exact source file names and the colour grade applied to each. Poly Haven
licenses every asset CC0 (https://polyhaven.com/license, read 2026-11-20).
The fairway, green and rough photographs are ambientCG's, also CC0
(https://docs.ambientcg.com/license/, read 2026-11-21), built by the same
script. Current load for one device (2026-11-21, `tests/asset-payload.test.ts`):
desktop 18.7 MB down and 273 MB of texture memory against a 300 MB budget;
phone 16.1 MB down and 68 MB against 100 MB.

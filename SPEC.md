# petpen — Spec

petpen is an 8-bit web app for a pretend San Mateo pet foster program. The premise: hospital patients who can't care for their pets while inpatient drop them off; hospital staff browse and foster them temporarily until the patient is discharged.

This is a fun project, not a real product. No HIPAA, no auth, no notifications, no production hardening. Aesthetic-first; the magic is the pet pen and the cute profiles.

## Users

Three implicit roles, no accounts:

- **Hospital staff** (primary) — browse the catalog, watch the pen, claim pets to foster
- **Owner** — fills out intake when dropping off; bookmarks the pet's profile URL to come back and see photo updates
- **Coordinator** (David) — unlocks `/coordinator` with a PIN, can edit any pet, mark stays discharged, release claims, hide problem pets

No login. Identity is by URL (owners bookmark their pet's profile) and by PIN (coordinator).

## Pages

| URL | What it is |
|---|---|
| `/` | Pet pen — homepage |
| `/catalog` | Grid of pet cards |
| `/pets/[id]` | Pet profile (full page) |
| `/pets/[id]` (intercepted) | Pet profile as modal overlay when clicked from pen or catalog |
| `/intake` | New pet intake form |
| `/intake/[id]/confirmation` | Post-intake confirmation page with bookmark URL |
| `/coordinator` | PIN-gated coordinator dashboard |

Both pen click and catalog click open the profile as a modal-with-shareable-URL using Next.js parallel + intercepting routes (`app/@modal/(.)pets/[id]/page.tsx`). Direct URL visits (e.g. owner bookmark) render the full page.

## Core features

### 1. Intake form (`/intake`)

Fills out by the owner (or someone helping the owner). Single page form, plain.

**Pet fields:**
- Name (required)
- Species (required, dropdown: dog / cat / other)
- Breed (required, dropdown of common + "mixed/unknown")
- Age in years (required)
- Sex (required, dropdown)
- Color / markings (textarea)
- Weight (number, optional)
- Photo (required, jpg/png/webp, max 5MB)

**Owner fields:**
- First name (required)
- Phone (required)
- Email (optional)
- Emergency contact name + phone (optional)

**Stay fields:**
- Drop-off date (required, defaults today)
- Expected return date (optional — defaults to drop-off + 14 days if blank, coordinator can edit)
- "What if I can't come back" textarea (optional)

**Medical fields:**
- Vaccinated (yes / no)
- On medications (textarea: name + dose + frequency)
- Allergies (textarea)
- Vet name + phone (optional)
- Special diet (textarea)

**Behavioral fields:**
- House-trained (checkbox)
- Crate-trained (checkbox)
- Good with dogs (checkbox)
- Good with cats (checkbox)
- Good with kids (checkbox)
- Energy level (1–5 slider)
- Personality keywords (free text — used for bio generation)

**Logistics fields:**
- Supplies provided (checkbox group: food, leash, bed, crate, meds)
- Foster authorized for vet care up to $___ (number)

**On submit:**
1. Create `pet` row
2. Create `stay` row pointing at the pet
3. Trigger async sprite generation (server action, fire-and-forget)
4. Trigger async bio generation (server action, fire-and-forget)
5. Auto-derive badges from form fields (synchronous, simple mapping)
6. Redirect to confirmation page

**Confirmation page (`/intake/[id]/confirmation`):**
- "Welcome to the pen, {pet name}! 🐾"
- Big copy of `/pets/[id]` URL, with a "Copy" button
- Bold instruction: "Save this link — it's how you'll find {pet name} during their stay"
- Link to view profile

### 2. Pet pen (`/`)

A rectangular grass area with all in-program pets idling and gliding around. The homepage.

**Behavior:**
- Show every pet whose stay status is not `discharged` or `hidden`
- Each pet is a 48x48 sprite positioned somewhere in the pen
- Per-pet random rhythm: idle 4–12 seconds, then glide 2–4 seconds to a new random position at ~30 px/sec
- Glide animation is `transform: translate` with `transition: transform 3s linear` — no walk frames, just sliding
- Z-order by `y` position so lower sprites render on top
- Position bounds inset 40px from each edge so pets don't overlap the fence
- Hover → speech bubble tooltip: name, breed, "Goes home in N days" or "🏠 fostered by {name}"
- Click → opens profile as modal-with-shareable-URL

**Pen size:** start at 900x500. Eyeball after first build.

**Empty state:** when no pets are in the program, show a wooden sign in the pen: "No pets here yet — bring one in!" with a button to `/intake`.

### 3. Pet catalog (`/catalog`)

Grid of pet cards, browsable by hospital staff.

**Card content:**
- Pet sprite (cached AI-generated)
- Name
- Breed
- Age
- Status pill: "Available," "🏠 Fostered by Sarah," "Going home soon"
- "Goes home in N days"
- No badges on the card

**Filters (pill row above grid):**
- Species (dog / cat / other)
- Size (S / M / L / XL — derived from weight if available)
- Energy (low / medium / high)
- Good with [kids / dogs / cats]

**Search:** single input matching name + breed (client-side over loaded set).

**Default sort:** unclaimed pets first, then by intake date newest-first. (Pet discharge means going home, so "discharging soonest" is the OPPOSITE of urgent — newly intook unclaimed pets are who needs help most.)

**Click on a card:** opens profile as modal-with-shareable-URL.

**No pagination.** Show all pets in one page.

### 4. Pet profile (`/pets/[id]`)

Full page on direct visit; modal overlay when reached from pen or catalog. Stardew-inspired but pruned.

**Top section:** big chunky pixel-art portrait frame with the AI-generated sprite, real intake photo as a small clickable thumbnail in the corner. Below: name in big pixel font, then a row of breed / age / sex / status pill / "Goes home in N days" or "Going home {date}".

**Middle section, two columns:**
- **Left:** parchment-style panel with auto-generated bio paragraph
- **Right:** 3x2 grid of badge icons (emoji for v1, later upgraded to 8-bit-rendered versions). Badges are auto-derived from intake form (mapping below).

**Care notes panel:** wood-textured panel showing:
- House-trained status, crate-trained status, energy level
- Allergies, special diet
- Medication schedule (in plain language: "needs meloxicam 0.5mg twice a day")

**Hidden from public profile (privacy default):** owner phone, owner email, vet phone, vet name. These exist in the database but never render on the public page.

**Owner display:** "Owned by Marcus, returning May 18" — first name only.

**Foster Me section:** if `available`, big "Foster Me" button that opens the claim modal. If `claimed` or `fostered`, replaced with a pill: "Claimed by Sarah — Going home {date}".

**Photo updates timeline (bottom):** vertical list of photo updates, newest first. Each update shows photo + caption + "Posted by Sarah, 3 days ago." Below the list, a "Post Update" button opens a small form (photo + caption + first name + phone). No moderation.

**Coordinator mode (when active):** pencil icons appear on every editable field. Clicking opens an inline editor.

#### Badge auto-derivation

| Form input | Badge |
|---|---|
| House-trained = true | 🏠 House Trained |
| Crate-trained = true | 📦 Crate Trained |
| Good with kids = true | 👶 Good with Kids |
| Good with dogs = true | 🐕 Good with Dogs |
| Good with cats = true | 🐈 Good with Cats |
| Energy = 1–2 | 🛋️ Couch Potato |
| Energy = 4–5 | 🏃 Active |
| Vaccinated = true | 💉 Vaccinated |

Coordinator can override.

### 5. Foster claim flow

**Trigger:** "Foster Me" button on pet profile when status = `available`.

**Modal form fields:**
- First name (required)
- Phone (required)
- "How long can you foster?" (dropdown: A few days / About a week / Two weeks / Three weeks / The full stay — default = full stay)

**On submit:**
1. Create `claim` record on the stay (or update stay row directly): `foster_first_name`, `foster_phone`, `foster_commitment`, `claimed_at`
2. Stay status transitions to `claimed`
3. Pet still appears in pen, but with 🏠 indicator in tooltip
4. Catalog card replaces "Foster Me" with "Claimed by Sarah — until {date}"
5. Redirect to confirmation page (same pet URL, with banner: "Thanks for fostering! Bookmark this page to post photo updates.")

**Coordinator can release a claim** (returns stay to `available`).

**No timeout, no approval, no email.** Foster commitment is shown on profile so coordinator can see "Sarah said one week, but the stay is three weeks — need a backup."

### 6. Coordinator view (`/coordinator`)

PIN-gated dashboard.

**Unlock flow:**
1. Visit `/coordinator`
2. Enter PIN (compared against `COORDINATOR_PIN` env var)
3. On success: set `localStorage.coordinator = true`, render the dashboard, show a banner across all pages
4. "Lock" button clears the localStorage flag

**Dashboard:**
- Table view of all stays (active + discharged + hidden)
- Filters: status, species
- Per-row actions: edit pet, edit stay (extend dates), release claim, mark discharged, hide pet, regenerate sprite, regenerate bio

**Inline coordinator affordances** (visible on `/pets/[id]` when coordinator mode is active):
- Pencil icons on every editable field (bio, badges, care notes, photo, basic info)
- "Mark discharged" button
- "Release claim" button
- "Hide pet" button

**Discharge vs hide:**
- **Discharge** = pet went home. Stay status → `discharged`. Pet leaves the pen. Profile shows a "Went home 🎉" banner and is read-only. Photo updates preserved.
- **Hide** = soft delete for problem cases. Stay status → `hidden`. Pet leaves the pen and catalog. Visible only in coordinator dashboard.

### 7. AI sprite generation

**Service:** Vertex AI, model `gemini-2.5-flash-image` (Nano Banana).

**Strategy:** reference image + prompt. At intake, breed dropdown maps to a curated reference photo in `/public/breed-refs/`. "Mixed/unknown" maps to a generic mutt photo.

**Prompt template:**
```
Create this {breed} into a cute low-res 8bit sprite side view, no anti aliasing, square aspect ratio
```

**Trigger:** server action fired async on intake submit. Pet record is created with `sprite_url = null`. Pet appears in pen with placeholder sprite (a generic 8-bit dog/cat silhouette) until the URL fills in. UI polls or revalidates.

**Storage:** result image saved to Supabase Storage bucket `sprites/`. Public URL written to `pets.sprite_url`.

**Frontend display:** fixed 64x64 container with `image-rendering: pixelated; object-fit: contain;` — handles non-square output gracefully.

**Failure handling:** retry once. If still failing, leave placeholder. Coordinator dashboard has a "Regenerate sprite" button.

### 8. AI bio generation

**Service:** Vertex AI, model `gemini-2.5-flash`.

**Trigger:** server action fired async on intake submit.

**Prompt template:**
```
You are writing a short, warm bio for a pet who will be temporarily fostered while their owner is in the hospital. Write 2-3 sentences in the pet's first-person voice. Keep it warm and inviting.

Pet details:
- Name: {name}
- Breed: {breed}
- Age: {age}
- Sex: {sex}
- Energy level (1-5): {energy}
- Good with kids: {goodWithKids}
- Good with dogs: {goodWithDogs}
- Good with cats: {goodWithCats}
- House-trained: {houseTrained}
- Crate-trained: {crateTrained}
- Personality keywords from owner: {personalityKeywords}

Output: 2-3 sentences in first person, no quote marks, no preamble. Just the bio.
```

**Coordinator can:** regenerate from dashboard, or hand-edit via inline pencil.

## Data model

Three tables.

### `pets`

| Field | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| name | text | |
| species | enum | dog / cat / other |
| breed | text | |
| age | int | years |
| sex | enum | male / female / unknown |
| color_markings | text | |
| weight | int | nullable |
| photo_url | text | |
| sprite_url | text | nullable until generated |
| bio | text | nullable until generated |
| badges | jsonb | array of {emoji, label} |
| medical | jsonb | { vaccinated, medications, allergies, vet_name, vet_phone, diet } |
| behavioral | jsonb | { house_trained, crate_trained, good_with_dogs, good_with_cats, good_with_kids, energy, personality_keywords } |
| logistics | jsonb | { supplies, vet_authorization_amount } |
| created_at | timestamptz | |

### `stays`

| Field | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| pet_id | uuid (fk) | |
| owner_first_name | text | |
| owner_phone | text | |
| owner_email | text | nullable |
| owner_emergency_contact | jsonb | { name, phone } |
| owner_what_if_unable | text | |
| intook_at | timestamptz | drop-off date |
| expected_return | date | defaults to intook_at + 14 days |
| actual_return | date | nullable, set on discharge |
| status | enum | intook / available / claimed / fostered / discharged / hidden |
| foster_first_name | text | nullable |
| foster_phone | text | nullable |
| foster_commitment | enum | a_few_days / about_a_week / two_weeks / three_weeks / full_stay |
| claimed_at | timestamptz | nullable |
| coordinator_notes | text | |
| created_at | timestamptz | |

A pet can have multiple stays over time. Pen and catalog query stays where status NOT IN (`discharged`, `hidden`).

### `photo_updates`

| Field | Type | Notes |
|---|---|---|
| id | uuid (pk) | |
| pet_id | uuid (fk) | |
| poster_first_name | text | |
| poster_phone | text | |
| caption | text | |
| image_url | text | |
| created_at | timestamptz | |

## Tech stack

- **Framework:** Next.js 15 (App Router) on Vercel
- **Database + Storage:** Supabase (Postgres + Storage)
- **AI:** Google AI Studio (Gemini API) — `gemini-2.5-flash-image` (sprites, aka Nano Banana) + `gemini-2.5-flash` (bios). SDK: `@google/genai`. Auth: single `GOOGLE_API_KEY` env var.
- **Styling:** Tailwind
- **Fonts:** [VT323](https://fonts.google.com/specimen/VT323) (body, default everywhere), [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (badge labels, hero headers)
- **Images:** sharp for server-side resize on photo upload
- **No state library** — server actions + revalidation

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_API_KEY=
COORDINATOR_PIN=
```

## Aesthetic

8-bit Stardew Valley + PostHog retro warmth.

- Color palette: warm earthy greens, wood browns, parchment yellow, soft sky blue, NES-limited
- Chunky pixel borders on every panel
- Wooden frames around portraits
- Parchment-style backgrounds for body text
- Pixelated rendering on all generated sprites (`image-rendering: pixelated`)
- VT323 for body, Press Start 2P sparingly for emphasis

## Photo upload constraints

- Accept: jpg, png, webp
- Max upload: 5MB
- Server-side resize: max 800px on long edge before storing
- Strip EXIF metadata (especially GPS) on upload
- Skip HEIC for now; iPhone users get an error toast suggesting jpg

## Out of scope for v1

- Auth, accounts, login of any kind
- Email or SMS notifications
- Mobile-first pen view (catalog and profile are mobile-friendly; pen is desktop-only with a "view on desktop" message on small screens)
- Multi-foster handoff (one foster per stay; commitment dropdown captures intent for future)
- Pet arrival / discharge animations
- Pagination
- Spam protection (Turnstile etc.)
- Real privacy enforcement (HIPAA, etc.)
- Walk animation frames on sprites (pets glide, no stepping animation)
- 8-bit Nano-Banana-rendered versions of badge emojis (David has a future prompt for this)
- Foster profile pages

## Open defaults to revisit after first build

- Pen dimensions (start 900x500)
- Sprite size in pen (start 48x48)
- Idle/glide rhythm (start 4–12s idle, 2–4s glide, 30 px/sec)
- Bio prompt template wording
- Badge derivation mapping (might want to tweak which form values trigger which badges)
- Catalog card size (eyeball)
- Whether modal-with-shareable-URL pattern feels right or we fall back to plain navigation

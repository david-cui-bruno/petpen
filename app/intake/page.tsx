import { submitIntake } from "./actions";
import { ALL_BREEDS } from "@/lib/breeds";
import { CollapsibleSection } from "./CollapsibleSection";

export const metadata = { title: "Intake — petpen" };

// Force runtime rendering — the form's default expected-return date is computed
// from `new Date()`, so static prerendering would freeze it at build time.
export const dynamic = "force-dynamic";

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function localDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function IntakePage() {
  const fourteenDaysFromNow = localDateString(addDays(new Date(), 14));

  return (
    <main className="flex-1 max-w-3xl mx-auto p-6">
      <h1 className="font-pixel text-2xl text-wood-dark mb-2">Pet Intake</h1>
      <p className="text-xl mb-6">
        Fill this out to bring your pet into the pen while you&apos;re away.
      </p>

      {/* Single shared breed list — native datalist filters by substring as the
          user types, so dog breeds + cat breeds in one list works for both
          species without any client-side toggling. */}
      <datalist id="breed-options">
        {ALL_BREEDS.map((breed) => (
          <option key={breed} value={breed} />
        ))}
      </datalist>

      <form action={submitIntake} className="space-y-4">
        {/* Always open: required identification */}
        <Section title="🐾 About your pet">
          <Field label="Name" name="name" required />
          <SelectField
            label="Species"
            name="species"
            required
            options={[
              { value: "dog", label: "Dog" },
              { value: "cat", label: "Cat" },
              { value: "other", label: "Other" },
            ]}
          />
          <Field
            label="Breed (start typing for suggestions)"
            name="breed"
            required
            list="breed-options"
            autoComplete="off"
          />
          <Field label="Age (years)" name="age" type="number" min={0} required />
          <SelectField
            label="Sex"
            name="sex"
            options={[
              { value: "unknown", label: "Unknown" },
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
          />
          <Field label="Weight (lbs)" name="weight" type="number" min={0} />
          <FileField
            label="Photo (jpg, png, webp — max 5MB)"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </Section>

        <Section title="👋 About you">
          <Field label="Your first name" name="owner_first_name" required />
          <Field label="Phone" name="owner_phone" type="tel" required />
          <Field label="Email (optional)" name="owner_email" type="email" />
          <Field
            label="Emergency contact name"
            name="owner_emergency_name"
          />
          <Field
            label="Emergency contact phone"
            name="owner_emergency_phone"
            type="tel"
          />
          <TextareaField
            label="What if I can't come back?"
            name="owner_what_if_unable"
            placeholder="e.g. contact my sister Lisa at..."
          />
        </Section>

        {/* Collapsed by default: optional sections */}
        <CollapsibleSection title="📅 Stay">
          <Field
            label="Expected return date"
            name="expected_return"
            type="date"
            defaultValue={fourteenDaysFromNow}
          />
        </CollapsibleSection>

        <CollapsibleSection title="💊 Medical">
          <CheckboxField label="Vaccinated" name="med_vaccinated" />
          <TextareaField
            label="Medications (name + dose + frequency)"
            name="med_medications"
          />
          <TextareaField label="Allergies" name="med_allergies" />
          <Field label="Vet name" name="med_vet_name" />
          <Field label="Vet phone" name="med_vet_phone" type="tel" />
          <TextareaField label="Special diet" name="med_diet" />
        </CollapsibleSection>

        <CollapsibleSection title="🐕 Behavioral">
          <CheckboxField label="House-trained" name="beh_house_trained" />
          <CheckboxField label="Crate-trained" name="beh_crate_trained" />
          <CheckboxField label="Good with dogs" name="beh_good_with_dogs" />
          <CheckboxField label="Good with cats" name="beh_good_with_cats" />
          <CheckboxField label="Good with kids" name="beh_good_with_kids" />
          <RangeField
            label="Energy level"
            name="beh_energy"
            min={1}
            max={5}
            defaultValue={3}
          />
          <TextareaField
            label="Personality keywords (used for the bio)"
            name="beh_personality"
            placeholder="cuddly, mischievous, shy at first..."
          />
        </CollapsibleSection>

        <CollapsibleSection title="📦 Logistics">
          <fieldset>
            <legend className="text-xl mb-1">Supplies provided:</legend>
            <div className="flex flex-wrap gap-3">
              {(["food", "leash", "bed", "crate", "meds"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1 text-xl">
                  <input
                    type="checkbox"
                    name="logistics_supplies"
                    value={s}
                    defaultChecked={s !== "meds"}
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <Field
            label="Foster authorized for vet care up to ($)"
            name="logistics_vet_auth"
            type="number"
            min={0}
          />
        </CollapsibleSection>

        <button
          type="submit"
          className="font-pixel text-base bg-grass text-parchment px-6 py-3 pixel-border hover:bg-grass-dark transition-colors"
        >
          Bring to the pen
        </button>
      </form>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-parchment p-4 space-y-3">
      <h2 className="font-pixel text-base text-wood-dark">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  min,
  defaultValue,
  list,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  defaultValue?: string;
  list?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xl">
        {label}
        {required && <span className="text-grass-dark"> *</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        min={min}
        defaultValue={defaultValue}
        list={list}
        autoComplete={autoComplete}
        className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
      />
    </label>
  );
}

function FileField({
  label,
  name,
  accept,
  required = false,
}: {
  label: string;
  name: string;
  accept?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xl">
        {label}
        {required && <span className="text-grass-dark"> *</span>}
      </span>
      <input
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="block w-full mt-1 text-xl"
      />
    </label>
  );
}

function TextareaField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xl">{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={2}
        className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
      />
    </label>
  );
}

function CheckboxField({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 text-xl">
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xl">
        {label}
        {required && <span className="text-grass-dark"> *</span>}
      </span>
      <select
        name={name}
        required={required}
        className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeField({
  label,
  name,
  min,
  max,
  defaultValue,
}: {
  label: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
}) {
  return (
    <label className="block">
      <span className="text-xl">{label} (1 = chill, 5 = zoomies)</span>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="block w-full mt-1"
      />
    </label>
  );
}

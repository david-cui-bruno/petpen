"use client";

import { useRef, useState } from "react";
import { postUpdate } from "./actions";

export function PostUpdateForm({ petId }: { petId: string }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const action = postUpdate.bind(null, petId);

  async function handleAction(formData: FormData) {
    setSubmitting(true);
    try {
      await action(formData);
      formRef.current?.reset();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-pixel text-xs bg-wood text-parchment px-4 py-2 hover:bg-wood-dark"
      >
        + Post update
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="panel-parchment p-4 space-y-3 max-w-md"
    >
      <h3 className="font-pixel text-xs text-wood-dark">Post a photo update</h3>
      <label className="block">
        <span className="text-xl">Photo (jpg/png/webp, max 5MB) *</span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          required
          className="block mt-1 text-xl"
        />
      </label>
      <label className="block">
        <span className="text-xl">Caption</span>
        <input
          type="text"
          name="caption"
          placeholder="Living their best life..."
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        />
      </label>
      <label className="block">
        <span className="text-xl">Your first name *</span>
        <input
          type="text"
          name="poster_first_name"
          required
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        />
      </label>
      <label className="block">
        <span className="text-xl">Your phone *</span>
        <input
          type="tel"
          name="poster_phone"
          required
          className="block w-full mt-1 px-2 py-1 bg-white text-wood-dark border-2 border-wood-dark"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => setOpen(false)}
          className="font-pixel text-xs bg-wood-light text-wood-dark px-3 py-1 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="font-pixel text-xs bg-grass text-parchment px-4 py-1 disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}

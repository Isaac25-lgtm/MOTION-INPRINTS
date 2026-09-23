"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { MAX_LINE_NOTES, clampQuantity } from "@/lib/quote/cart";
import { quoteList } from "./store";

type Props = {
  slug: string;
  title: string;
  unit: string;
  options: { id: string; label: string; choices: string[] }[];
  notesHint: string;
};

/**
 * Specification form for one product. Choices are optional: anything left
 * blank is sent as "Not specified" and settled when we reply.
 */
export function AddToQuote({ slug, title, unit, options, notesHint }: Props) {
  const uid = useId();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const qty = clampQuantity(quantity);
    quoteList.add({
      slug,
      title,
      unit,
      options: choices,
      quantity: qty,
      notes,
    });
    setAdded(`${qty.toLocaleString("en-GB")} ${unit}`);
    setNotes("");
  }

  return (
    <form className="add-quote" onSubmit={submit}>
      {options.map((group) => (
        <fieldset key={group.id} className="add-quote__group">
          <legend>{group.label}</legend>
          <div className="choice-row">
            {group.choices.map((choice) => {
              const id = `${uid}-${group.id}-${choice}`;
              return (
                <label key={choice} className="choice" htmlFor={id}>
                  <input
                    id={id}
                    type="radio"
                    name={group.id}
                    value={choice}
                    checked={choices[group.id] === choice}
                    onChange={() =>
                      setChoices((c) => ({ ...c, [group.id]: choice }))
                    }
                  />
                  <span>{choice}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="field field--short">
        <label htmlFor={`${uid}-qty`}>Quantity ({unit})</label>
        <input
          id={`${uid}-qty`}
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={`${uid}-notes`}>Notes for this item (optional)</label>
        <textarea
          id={`${uid}-notes`}
          rows={3}
          maxLength={MAX_LINE_NOTES}
          value={notes}
          aria-describedby={`${uid}-notes-hint`}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="field__hint" id={`${uid}-notes-hint`}>
          {notesHint}
        </p>
      </div>

      <div className="add-quote__actions">
        <button className="btn btn--solid" type="submit">
          Add to Quote
        </button>
        <p className="add-quote__status" role="status">
          {added ? (
            <>
              Added {added} to your quote list.{" "}
              <Link href="/quote">
                View list <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Mirrors `BodySchema` in `src/app/api/membership/route.ts` field-for-field
 * so a visitor never sees a server-side validation error the client
 * couldn't have caught first (the server remains the source of truth; this
 * is purely a fast, accessible first pass).
 */
const JoinSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(200, "That name is too long."),
  email: z.string().trim().email("Enter a valid email address.").max(200, "That email is too long."),
  phone: z.string().trim().min(6, "Enter a valid phone number.").max(30, "That phone number is too long."),
  dob: z.string().trim().max(20).optional(),
  icOrPassport: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500, "Please keep the address under 500 characters.").optional(),
  club: z.string().trim().max(200).optional(),
  handicap: z.string().trim().max(20).optional(),
  referrer: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000, "Please keep this under 2000 characters.").optional(),
});

type FieldKey = keyof z.infer<typeof JoinSchema>;

const FIELD_LABELS: Record<FieldKey, string> = {
  fullName: "Full name",
  email: "Email address",
  phone: "Phone number",
  dob: "Date of birth",
  icOrPassport: "IC or passport number",
  address: "Home address",
  club: "Home golf club",
  handicap: "Golf handicap",
  referrer: "Referred by",
  message: "Anything else you'd like us to know",
};

const ALL_KEYS: FieldKey[] = [
  "fullName",
  "email",
  "phone",
  "dob",
  "icOrPassport",
  "address",
  "club",
  "handicap",
  "referrer",
  "message",
];

const EMPTY_VALUES: Record<FieldKey, string> = {
  fullName: "",
  email: "",
  phone: "",
  dob: "",
  icOrPassport: "",
  address: "",
  club: "",
  handicap: "",
  referrer: "",
  message: "",
};

type Status = "idle" | "submitting" | "error" | "success" | "rate-limited" | "server-error";

const inputClass =
  "h-12 w-full rounded-md border border-fairway-900/20 bg-cream-50 px-4 text-base text-ink-900 " +
  "placeholder:text-ink-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fairway-700 " +
  "aria-[invalid=true]:border-red-600";

const textareaClass = `${inputClass} h-auto min-h-28 resize-y py-3`;

type TextFieldConfig = {
  key: FieldKey;
  type: "text" | "email" | "tel" | "date";
  required?: boolean;
  hint?: string;
  autoComplete?: string;
};

const TEXT_FIELDS: TextFieldConfig[] = [
  { key: "fullName", type: "text", required: true, autoComplete: "name" },
  { key: "email", type: "email", required: true, autoComplete: "email" },
  {
    key: "phone",
    type: "tel",
    required: true,
    autoComplete: "tel",
    hint: "We'll call or WhatsApp you about your application.",
  },
  { key: "dob", type: "date", autoComplete: "bday", hint: "Helps us confirm you meet the 55-and-above eligibility." },
  { key: "icOrPassport", type: "text" },
  { key: "club", type: "text", hint: "Leave blank if you're not currently a member of a golf club." },
  { key: "handicap", type: "text" },
  { key: "referrer", type: "text", hint: "Know a current SGSM member? Let us know who referred you." },
];

function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return "in about a minute";
  return `in about ${minutes} minutes`;
}

export function JoinForm() {
  const formId = useId();
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string[]>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [submitCount, setSubmitCount] = useState(0);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  const hasFieldErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    if (status === "error" && hasFieldErrors) {
      errorSummaryRef.current?.focus();
    }
  }, [status, hasFieldErrors, submitCount]);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function handleChange(key: FieldKey, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitCount((n) => n + 1);
    setBannerMessage(null);

    const payload: Record<string, string> = {};
    for (const key of ALL_KEYS) {
      const trimmed = values[key].trim();
      if (trimmed) payload[key] = trimmed;
    }

    const parsed = JoinSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      setStatus("error");
      return;
    }

    setErrors({});
    setStatus("submitting");

    try {
      const response = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 201) {
        const data = (await response.json()) as { id: number };
        setApplicationId(data.id);
        setStatus("success");
        return;
      }

      if (response.status === 400) {
        const data = (await response.json()) as { issues?: Record<string, string[]> };
        setErrors(data.issues ?? {});
        setBannerMessage("Please check the highlighted fields below and try again.");
        setStatus("error");
        return;
      }

      if (response.status === 429) {
        const data = (await response.json()) as { retryAfterMs?: number };
        const when = data.retryAfterMs ? formatRetryAfter(data.retryAfterMs) : "shortly";
        setBannerMessage(`You've submitted a few applications already. Please try again ${when}.`);
        setStatus("rate-limited");
        return;
      }

      setBannerMessage("Something went wrong on our end. Please try again, or contact us directly.");
      setStatus("server-error");
    } catch {
      setBannerMessage("We couldn't reach the server. Please check your connection and try again.");
      setStatus("server-error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-lg border border-fairway-900/20 bg-fairway-100 p-8 text-center"
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-fairway-700" aria-hidden="true" />
        <h2 ref={successRef} tabIndex={-1} className="mt-4 text-2xl text-fairway-950 focus:outline-none">
          Thank you — your application is in!
        </h2>
        <p className="mt-3 text-ink-700">
          {applicationId ? `Reference #${applicationId}. ` : ""}
          A member of our council will be in touch to guide you through the next steps. We look forward to
          welcoming you to the Society.
        </p>
      </div>
    );
  }

  const isSubmitting = status === "submitting";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-busy={isSubmitting}>
      {hasFieldErrors ? (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-600/40 bg-red-50 p-5 focus:outline-none"
        >
          <p className="flex items-center gap-2 text-lg font-semibold text-red-900">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            Please fix the following before submitting
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-red-900">
            {Object.entries(errors).map(([key, messages]) =>
              messages && messages.length > 0 ? (
                <li key={key}>
                  <a href={`#${formId}-${key}`} className="underline hover:no-underline">
                    {FIELD_LABELS[key as FieldKey]}: {messages[0]}
                  </a>
                </li>
              ) : null
            )}
          </ul>
        </div>
      ) : null}

      {bannerMessage && !hasFieldErrors ? (
        <div role="alert" className="rounded-lg border border-red-600/40 bg-red-50 p-4 text-red-900">
          {bannerMessage}
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => {
          const inputId = `${formId}-${field.key}`;
          const hintId = field.hint ? `${inputId}-hint` : undefined;
          const errorId = errors[field.key] ? `${inputId}-error` : undefined;
          const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

          return (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label htmlFor={inputId} className="text-base font-medium text-ink-900">
                {FIELD_LABELS[field.key]}
                {field.required ? (
                  <span aria-hidden="true" className="text-fairway-700">
                    {" "}
                    *
                  </span>
                ) : (
                  <span className="text-ink-500"> (optional)</span>
                )}
              </label>
              <input
                id={inputId}
                name={field.key}
                type={field.type}
                required={field.required}
                autoComplete={field.autoComplete}
                value={values[field.key]}
                onChange={(event) => handleChange(field.key, event)}
                aria-invalid={Boolean(errors[field.key]) || undefined}
                aria-describedby={describedBy}
                aria-required={field.required || undefined}
                className={inputClass}
              />
              {field.hint ? (
                <p id={hintId} className="text-sm text-ink-500">
                  {field.hint}
                </p>
              ) : null}
              {errors[field.key] ? (
                <p id={errorId} className="text-sm font-medium text-red-700">
                  {errors[field.key]?.[0]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-address`} className="text-base font-medium text-ink-900">
          Home address <span className="text-ink-500">(optional)</span>
        </label>
        <textarea
          id={`${formId}-address`}
          name="address"
          rows={3}
          autoComplete="street-address"
          value={values.address}
          onChange={(event) => handleChange("address", event)}
          aria-invalid={Boolean(errors.address) || undefined}
          aria-describedby={errors.address ? `${formId}-address-error` : undefined}
          className={textareaClass}
        />
        {errors.address ? (
          <p id={`${formId}-address-error`} className="text-sm font-medium text-red-700">
            {errors.address[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-message`} className="text-base font-medium text-ink-900">
          {FIELD_LABELS.message} <span className="text-ink-500">(optional)</span>
        </label>
        <textarea
          id={`${formId}-message`}
          name="message"
          rows={4}
          value={values.message}
          onChange={(event) => handleChange("message", event)}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={errors.message ? `${formId}-message-error` : undefined}
          className={textareaClass}
        />
        {errors.message ? (
          <p id={`${formId}-message-error`} className="text-sm font-medium text-red-700">
            {errors.message[0]}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-ink-500">Fields marked * are required.</p>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isSubmitting}
        icon={isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : undefined}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}

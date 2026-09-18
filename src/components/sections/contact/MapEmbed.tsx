export type MapEmbedProps = {
  src: string;
  title: string;
};

/**
 * Google Maps embed for the office location. Plain `<iframe>`, no API key or
 * dependency — `loading="lazy"` defers the network request and the heavy
 * iframe document until it's near the viewport, so it never competes with
 * the page's LCP element.
 */
export function MapEmbed({ src, title }: MapEmbedProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-cream-200 shadow-soft">
      <div className="aspect-video w-full">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className="h-full w-full"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

import { useEffect } from "react";

interface MetaOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export function useMeta({ title, description, image, url }: MetaOptions) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    const setMeta = (property: string, content?: string) => {
      if (!content) return;
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const setNameMeta = (name: string, content?: string) => {
      if (!content) return;
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const effectiveUrl = url ?? (typeof window !== "undefined" ? window.location.href : undefined);

    if (description) {
      setNameMeta("description", description);
    }

    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:image", image);
    setMeta("og:url", effectiveUrl);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);
    setNameMeta("twitter:card", image ? "summary_large_image" : "summary");
  }, [title, description, image, url]);
}


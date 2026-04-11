interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export async function shareOrCopy({ title, text, url }: SharePayload) {
  const shareData: SharePayload = { title, text, url };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    // eslint-disable-next-line no-alert
    alert("Link copied to clipboard!");
  } catch {
    // eslint-disable-next-line no-alert
    alert("Could not copy link. URL: " + url);
  }
}

export function buildWhatsAppShareUrl({ text, url }: { text: string; url: string }) {
  const message = `${text} ${url}`.trim();
  const encoded = encodeURIComponent(message);
  return `https://wa.me/?text=${encoded}`;
}


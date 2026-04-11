import React from "react";

export default function Help() {
  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-serif font-bold text-stone-900 mb-4">Help Center</h1>
        <p className="text-stone-600 mb-6">
          We&apos;re building out full support content. For now, if you have any questions about
          TwendeHub, reach us at{" "}
          <a href="mailto:support@twendehub.com" className="text-olive-drab font-medium">
            support@twendehub.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}


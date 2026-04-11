import React from "react";

export default function Safety() {
  return (
    <div className="pt-32 pb-24 px-4 bg-warm-off-white min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-serif font-bold text-stone-900 mb-4">Safety Guidelines</h1>
        <p className="text-stone-600 mb-4">
          Safety is core to every TwendeHub adventure. This page will soon include detailed
          guidance for organizers and participants on transport, medical readiness, and emergency
          contacts.
        </p>
        <p className="text-stone-600">
          Until then, please follow organizer instructions carefully, share your plans with someone
          you trust, and contact{" "}
          <a href="mailto:safety@twendehub.com" className="text-olive-drab font-medium">
            safety@twendehub.com
          </a>{" "}
          if you have any concerns.
        </p>
      </div>
    </div>
  );
}


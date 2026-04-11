import React from "react";

export default function Pricing() {
  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
            Pricing for Organizers
          </h1>
          <p className="text-stone-600 text-lg max-w-2xl mx-auto">
            Simple, transparent pricing so you can focus on running unforgettable outdoor
            adventures across Kenya.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-6 bg-white border border-stone-200 rounded-3xl">
            <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
              Event Creation Fee
            </h2>
            <p className="text-3xl font-serif font-bold text-olive-drab mb-2">KES 1,000</p>
            <p className="text-sm text-stone-600 mb-4">
              One-time per event, paid when you publish your adventure.
            </p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li>• Unlocks full event visibility on TwendeHub</li>
              <li>• Access to organiser tools and participant management</li>
              <li>• Supports platform hosting, security, and support</li>
            </ul>
          </div>

          <div className="card p-6 bg-white border border-stone-200 rounded-3xl">
            <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
              Featured Listing Upgrade
            </h2>
            <p className="text-3xl font-serif font-bold text-olive-drab mb-2">KES 500</p>
            <p className="text-sm text-stone-600 mb-4">
              Promote your event to the Featured section for extra visibility.
            </p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li>• Highlighted placement on the home page</li>
              <li>• Ideal for last-minute fills or flagship trips</li>
              <li>• Runs alongside your regular event listing</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="card p-6 bg-white border border-stone-200 rounded-3xl">
            <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
              Participant Bookings
            </h2>
            <p className="text-sm text-stone-600 mb-4">
              Free to join free events. Paid events charge whatever fee you set per participant.
            </p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li>• You control pricing for each trip</li>
              <li>• Participants see clear, upfront costs</li>
              <li>• Designed for hiking groups, road trips, and more</li>
            </ul>
          </div>

          <div className="card p-6 bg-white border border-stone-200 rounded-3xl">
            <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
              Vehicles & Photographers
            </h2>
            <p className="text-sm text-stone-600 mb-4">
              Free to list while we&apos;re in early access. TwendeHub takes{" "}
              <span className="font-semibold">0% commission</span> on these add-ons.
            </p>
            <ul className="space-y-2 text-sm text-stone-600">
              <li>• List trusted vehicles for transport</li>
              <li>• Bring photographers into your trips with no extra platform fee</li>
              <li>• Keep your earnings — we focus on growing the ecosystem</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-olive-drab text-white font-semibold hover:bg-olive-drab/90 transition-colors"
            onClick={() => (window.location.href = "/create-event")}
          >
            Create Your Event
          </button>
        </div>
      </div>
    </div>
  );
}


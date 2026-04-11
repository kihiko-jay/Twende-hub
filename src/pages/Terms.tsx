import React from "react";

const sections = [
  { id: "last-updated", label: "Last Updated" },
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "service", label: "Description of Service" },
  { id: "roles", label: "User Roles and Eligibility" },
  { id: "organiser-resp", label: "Organiser Responsibilities" },
  { id: "participant-resp", label: "Participant Responsibilities" },
  { id: "marketplace-rules", label: "Marketplace Rules" },
  { id: "payments", label: "Payment Terms" },
  { id: "prohibited", label: "Prohibited Content" },
  { id: "termination", label: "Termination" },
  { id: "law", label: "Governing Law" },
  { id: "contact", label: "Contact" },
];

export default function Terms() {
  return (
    <div className="pt-32 pb-24 px-4">
      <div className="max-w-4xl mx-auto lg:grid lg:grid-cols-4 gap-8">
        <aside className="mb-8 lg:mb-0 lg:col-span-1 lg:sticky lg:top-28 self-start">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">
            On this page
          </h2>
          <nav className="space-y-2 text-sm">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block text-stone-500 hover:text-stone-900"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="lg:col-span-3 space-y-8">
          <header>
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-3">
              Terms of Service
            </h1>
            <p className="text-stone-600 max-w-2xl">
              These Terms of Service govern your use of TwendeHub. By using the platform,
              you agree to these terms.
            </p>
          </header>

          <section id="last-updated">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Last Updated
            </h2>
            <p className="text-stone-600">March 2026</p>
          </section>

          <section id="acceptance">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Acceptance of Terms
            </h2>
            <p className="text-stone-600">
              By creating an account or using TwendeHub, you confirm that you have read,
              understood, and agree to be bound by these Terms of Service. If you do not
              agree, you may not use the platform.
            </p>
          </section>

          <section id="service">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Description of Service
            </h2>
            <p className="text-stone-600">
              TwendeHub is a marketplace connecting event organisers, participants,
              vehicle owners, and photographers for outdoor adventures in Kenya. We
              provide tools for event discovery, bookings, communication, and payments,
              but we do not operate the events ourselves.
            </p>
          </section>

          <section id="roles">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              User Roles and Eligibility
            </h2>
            <p className="text-stone-600 mb-2">
              To use TwendeHub you must be at least 18 years old and capable of entering
              into a binding agreement. Different roles on the platform have different
              permissions:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>
                <strong>Organisers</strong> can create and manage events, and manage
                participants.
              </li>
              <li>
                <strong>Participants</strong> can browse and join events.
              </li>
              <li>
                <strong>Vehicle owners</strong> can list vehicles and accept bookings.
              </li>
              <li>
                <strong>Photographers</strong> can list photography services and accept
                bookings.
              </li>
              <li>
                <strong>Vendors</strong> may operate multiple service types.
              </li>
            </ul>
          </section>

          <section id="organiser-resp">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Organiser Responsibilities
            </h2>
            <p className="text-stone-600 mb-2">
              As an organiser, you are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Providing accurate, up-to-date information about your events</li>
              <li>Managing participant safety and following applicable laws and guidelines</li>
              <li>Communicating any changes, cancellations, or risks to participants</li>
              <li>
                Paying a non-refundable platform fee of{" "}
                <strong>KES 1,000 per event</strong> when you publish an event
              </li>
            </ul>
          </section>

          <section id="participant-resp">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Participant Responsibilities
            </h2>
            <p className="text-stone-600 mb-2">
              As a participant, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Respect event rules and organiser instructions</li>
              <li>Be aware of the risks associated with outdoor activities</li>
              <li>Ensure you are medically fit and properly equipped for the event</li>
            </ul>
          </section>

          <section id="marketplace-rules">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Marketplace Rules
            </h2>
            <p className="text-stone-600 mb-2">
              Vehicle owners and photographers are responsible for the quality and safety
              of their own services. TwendeHub does not verify every listing or supervise
              events.
            </p>
            <p className="text-stone-600">
              TwendeHub is not liable for losses, injuries, or disputes arising from
              third-party services booked through the platform. Any issues should be
              resolved directly between the parties involved, though we may assist where
              reasonable.
            </p>
          </section>

          <section id="payments">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Payment Terms
            </h2>
            <p className="text-stone-600 mb-2">
              The following platform fees apply to organisers:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600 mb-2">
              <li>
                Event creation fee: <strong>KES 1,000</strong> per event (non-refundable)
              </li>
              <li>
                Feature listing upgrade: <strong>KES 500</strong> per event (non-refundable)
              </li>
            </ul>
            <p className="text-stone-600">
              Payments are processed via M-Pesa or other supported providers. We do not
              store card details. Platform fees are non-refundable, including in cases of
              event cancellation, except where required by law.
            </p>
          </section>

          <section id="prohibited">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Prohibited Content
            </h2>
            <p className="text-stone-600 mb-2">
              You agree not to use TwendeHub to post or promote:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Illegal activities or events</li>
              <li>Misleading, fraudulent, or inaccurate listings</li>
              <li>Hate speech, harassment, or abusive behaviour</li>
              <li>Content that violates intellectual property rights</li>
            </ul>
          </section>

          <section id="termination">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Termination
            </h2>
            <p className="text-stone-600">
              TwendeHub may suspend or terminate your account, or remove listings, if you
              violate these terms or engage in behaviour that risks the safety or trust of
              the community. We may also suspend access for investigation where we
              reasonably suspect misuse.
            </p>
          </section>

          <section id="law">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Governing Law
            </h2>
            <p className="text-stone-600">
              These Terms of Service are governed by and construed in accordance with the
              laws of the Republic of Kenya. Any disputes will be subject to the exclusive
              jurisdiction of the Kenyan courts.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Contact
            </h2>
            <p className="text-stone-600">
              For legal questions or concerns about these terms, please contact{" "}
              <a href="mailto:legal@twendehub.com" className="text-olive-drab font-medium">
                legal@twendehub.com
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}


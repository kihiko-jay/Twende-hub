import React from "react";

const sections = [
  { id: "last-updated", label: "Last Updated" },
  { id: "who-we-are", label: "Who We Are" },
  { id: "data-we-collect", label: "What Data We Collect" },
  { id: "how-we-use-data", label: "How We Use Your Data" },
  { id: "data-retention", label: "Data Retention" },
  { id: "your-rights", label: "Your Rights" },
  { id: "exercise-rights", label: "How to Exercise Your Rights" },
  { id: "third-parties", label: "Third-Party Services" },
  { id: "cookies", label: "Cookies" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPolicy() {
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
              Privacy Policy
            </h1>
            <p className="text-stone-600 max-w-2xl">
              This Privacy Policy explains how TwendeHub collects, uses, and protects your
              personal data when you use our platform for outdoor adventures and group
              experiences in Kenya.
            </p>
          </header>

          <section id="last-updated">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Last Updated
            </h2>
            <p className="text-stone-600">March 2026</p>
          </section>

          <section id="who-we-are">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Who We Are
            </h2>
            <p className="text-stone-600">
              TwendeHub operates as an outdoor adventure event platform based in Kenya. We
              help organisers run professional hikes, road trips, and other group
              experiences, and connect them with participants, vehicle owners, and
              photographers.
            </p>
          </section>

          <section id="data-we-collect">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              What Data We Collect
            </h2>
            <p className="text-stone-600 mb-2">
              When you use TwendeHub, we may collect the following types of information:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Role on the platform (e.g. organiser, participant, vehicle owner, photographer)</li>
              <li>Event participation history</li>
              <li>
                Payment references related to your bookings and organiser fees (we do{" "}
                <strong>not</strong> store card details — M-Pesa only)
              </li>
              <li>Location data if you grant permission for radius-based search</li>
              <li>Chat messages and announcements within events</li>
            </ul>
          </section>

          <section id="how-we-use-data">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              How We Use Your Data
            </h2>
            <p className="text-stone-600 mb-2">
              We use your personal data to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Power the TwendeHub platform and its core features</li>
              <li>Process organiser fees and event-related payments</li>
              <li>Send booking updates, reminders, and important notifications</li>
              <li>Help organisers manage participants and event logistics</li>
              <li>Improve the service, including safety and reliability</li>
            </ul>
          </section>

          <section id="data-retention">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Data Retention
            </h2>
            <p className="text-stone-600">
              We retain your active account data for as long as your TwendeHub account
              exists. If you request account deletion, we aim to delete or anonymise your
              personal data within 90 days, subject to any legal or regulatory retention
              requirements.
            </p>
          </section>

          <section id="your-rights">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Your Rights
            </h2>
            <p className="text-stone-600 mb-2">
              Under the Kenya Data Protection Act 2019 and, where applicable, the GDPR
              (for users in the EU), you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Access the personal data we hold about you</li>
              <li>Rectify inaccurate or incomplete data</li>
              <li>Request deletion of your personal data</li>
              <li>Request a copy of your data in a portable format</li>
              <li>Object to certain types of processing</li>
            </ul>
          </section>

          <section id="exercise-rights">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              How to Exercise Your Rights
            </h2>
            <p className="text-stone-600">
              To exercise any of these rights, please email{" "}
              <a href="mailto:privacy@twendehub.com" className="text-olive-drab font-medium">
                privacy@twendehub.com
              </a>
              . We may need to verify your identity before processing your request.
            </p>
          </section>

          <section id="third-parties">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Third-Party Services
            </h2>
            <p className="text-stone-600 mb-2">
              TwendeHub relies on trusted third-party services to deliver the platform:
            </p>
            <ul className="list-disc list-inside space-y-1 text-stone-600">
              <li>Supabase for database, authentication, and hosting (servers in the EU)</li>
              <li>M-Pesa / Safaricom for payment processing</li>
              <li>Cloudinary or similar providers for image hosting</li>
            </ul>
            <p className="text-stone-600 mt-2">
              These providers process data on our behalf in line with their own terms and
              privacy policies.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Cookies
            </h2>
            <p className="text-stone-600">
              TwendeHub uses essential session cookies to keep you logged in and to secure
              your account. We do not use advertising or cross-site tracking cookies.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Contact
            </h2>
            <p className="text-stone-600">
              If you have any questions about this Privacy Policy or how we handle your
              data, please contact us at{" "}
              <a href="mailto:privacy@twendehub.com" className="text-olive-drab font-medium">
                privacy@twendehub.com
              </a>
              .
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}


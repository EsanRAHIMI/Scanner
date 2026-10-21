import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy policy — Lorenzo Marketing',
  description: 'How Lorenzo Marketing accesses and uses Google account data for Lorenzo Home.',
};

const UPDATED = '21 October 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#f4f2f0] text-brand-black">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Lorenzo <span className="text-brand-burgundy">Marketing</span>
          </Link>
          <a className="text-sm text-brand-dark-gray underline underline-offset-2" href="https://lorenzohome.ae">
            lorenzohome.ae
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-burgundy">Lorenzo Home</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="mt-2 text-sm text-brand-dark-gray">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-brand-dark-gray">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">Who we are</h2>
            <p>
              Lorenzo Marketing is the private operating system of Lorenzo Home (<a className="underline underline-offset-2" href="https://lorenzohome.ae">lorenzohome.ae</a>). It is used by Lorenzo staff to plan campaigns and read the performance of Lorenzo’s own marketing accounts. This policy describes that application, served at marketing.lorenzohome.ae.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">Google data we access</h2>
            <p>
              A Lorenzo administrator connects Lorenzo’s own Google account. We request only the access needed to read that account’s marketing data. We do not ask for Gmail, Drive, Calendar, contacts, or the contents of personal messages.
            </p>
            <p>Depending on what is configured, the application reads:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Google Ads: campaign names, status, dates, cost, impressions, clicks, and conversions for Lorenzo’s ad account.</li>
              <li>Google Analytics: aggregated site traffic for a Lorenzo property.</li>
              <li>Google Search Console: search clicks and impressions for a Lorenzo site.</li>
              <li>Google Tag Manager: whether a Lorenzo container is reachable.</li>
              <li>Google Business Profile: the rating and review count for a Lorenzo location.</li>
            </ul>
            <p>
              The connection is stored as a refresh token so the application can renew a short-lived access token. The access token is not shown to users and is used only to call the Google APIs above.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">How we use it</h2>
            <p>
              Google data is shown inside Lorenzo Marketing to Lorenzo staff, so they can see spend, results, and account status. It is used to operate and improve that dashboard. It is not sold. It is not used to advertise to consumers, to build profiles of people outside Lorenzo, or to decide credit, employment, or insurance.
            </p>
            <p>
              Lorenzo Marketing’s use of information received from Google APIs adheres to the{' '}
              <a className="underline underline-offset-2" href="https://developers.google.com/terms/api-services-user-data-policy">
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">Who can see it</h2>
            <p>
              The dashboard requires a Lorenzo staff account. Google data is stored in Lorenzo’s application database and is available only to people signed in to Lorenzo Marketing. We do not transfer it to advertising networks, data brokers, or other companies. A hosting or database provider may process it only so the application can run.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">How long we keep it</h2>
            <p>
              Performance figures are kept as Lorenzo’s marketing records while the account stays connected. Disconnecting an account stops further collection. A request to delete stored Google data can be sent through{' '}
              <a className="underline underline-offset-2" href="https://lorenzohome.ae">lorenzohome.ae</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-black">Contact</h2>
            <p>
              Lorenzo Home, operator of Lorenzo Marketing. Questions about this policy or about Google data we hold:{' '}
              <a className="underline underline-offset-2" href="https://lorenzohome.ae">lorenzohome.ae</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

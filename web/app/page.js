import Hero from "./components/landing/Hero";
import ProductPreview from "./components/landing/ProductPreview";
import BeforeAfter from "./components/landing/BeforeAfter";
import HowItWorks from "./components/landing/HowItWorks";
import Metrics from "./components/landing/Metrics";
import Testimonials from "./components/landing/Testimonials";

const RELEASES_URL = "https://github.com/khushcoding123/TokenTrackStuff/releases";
// Direct one-click download of the latest release's Windows asset. GitHub's
// /releases/latest/download/<name> URL always resolves to the newest release's
// asset with that exact filename — so publish the build named "Metriq-Windows.zip".
const WIN_DOWNLOAD =
  "https://github.com/khushcoding123/TokenTrackStuff/releases/latest/download/Metriq-Windows.zip";

export const metadata = { title: "Metriq — Focus your prompts before you send them" };

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-mesh relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-5%] w-[500px] h-[500px] bg-secondary-container/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
            M
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary leading-none">Metriq</span>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <Hero winDownloadUrl={WIN_DOWNLOAD} releasesUrl={RELEASES_URL} />
        <ProductPreview />
        <BeforeAfter />
        <HowItWorks />
        <Metrics />
        <Testimonials />
      </main>

      <footer className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-subtle/50 relative z-10">
        <span className="font-body-sm text-body-sm text-on-surface-variant">© {new Date().getFullYear()} Metriq</span>
        <div className="flex items-center gap-6">
          <a
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
            href="https://github.com/khushcoding123/TokenTrackStuff#readme"
            rel="noreferrer noopener"
            target="_blank"
          >
            Docs
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
            href="https://github.com/khushcoding123/TokenTrackStuff"
            rel="noreferrer noopener"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

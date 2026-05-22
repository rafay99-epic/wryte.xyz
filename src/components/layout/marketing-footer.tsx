import Link from "next/link";
import { BrandIcon } from "@/components/branding/brand-icon";
import { APP_RELEASE_LABEL } from "@/lib/release";

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Changelog", href: "/changelog" },
    { label: "Feature Requests", href: "/feature-requests" },
    { label: "How it Works", href: "/how-it-works" },
  ],
  Company: [
    { label: "Contact", href: "/contact" },
    {
      label: "GitHub",
      href: "https://github.com/rafay99-epic/wryte.xyz",
      external: true,
    },
    {
      label: "Abdul Rafay",
      href: "https://rafay99.com",
      external: true,
    },
    {
      label: "Syntax Lab Technology",
      href: "https://syntaxlabtechnology.com",
      external: true,
    },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
  ],
} as const;

export function MarketingFooter() {
  return (
    <footer className="relative">
      <div className="mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent" />

      <div className="mx-auto max-w-[1100px] px-6 pb-8 pt-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr]">
          <div>
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <BrandIcon
                width={24}
                height={24}
                className="rounded-[4px] transition-transform duration-300 group-hover:scale-110"
              />
              <span className="text-[15px] font-semibold tracking-tight text-foreground/70">
                wryte
              </span>
            </Link>
            <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-foreground/40 dark:text-foreground/20">
              A complete content workspace for developers. Write, manage, and
              publish — all from one place.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://github.com/rafay99-epic/wryte.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/[0.08] text-foreground/40 transition-all duration-200 hover:border-foreground/15 hover:bg-foreground/[0.04] hover:text-foreground/70 dark:border-foreground/[0.05] dark:text-foreground/20 dark:hover:border-foreground/10 dark:hover:text-foreground/50"
              >
                <span className="sr-only">GitHub</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                </svg>
              </a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[11px] font-semibold tracking-[0.12em] text-foreground/50 uppercase dark:text-foreground/25">
                {category}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-foreground/40 transition-colors duration-200 hover:text-foreground/70 dark:text-foreground/20 dark:hover:text-foreground/50"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13px] text-foreground/40 transition-colors duration-200 hover:text-foreground/70 dark:text-foreground/20 dark:hover:text-foreground/50"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-foreground/[0.06] pt-6 dark:border-foreground/[0.03]">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-[11px] text-foreground/30 dark:text-foreground/15">
              &copy; {new Date().getFullYear()} Wryte &middot;{" "}
              {APP_RELEASE_LABEL}
            </p>
            <p className="text-[11px] text-foreground/25 dark:text-foreground/10">
              Open Source &middot; MIT Licensed
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

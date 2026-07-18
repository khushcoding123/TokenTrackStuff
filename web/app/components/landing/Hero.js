"use client";

import { motion } from "framer-motion";

// Hero entrance: one orchestrated stagger on page load (badge → headline →
// copy → download buttons), then the product preview rises in below.
// Download button hrefs/targets come from page.js untouched — only the
// presentation layer (motion + glow) lives here.

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] } },
};

export default function Hero({ winDownloadUrl, macDownloadUrl, releasesUrl }) {
  return (
    <motion.section
      variants={container}
      initial="hidden"
      animate="show"
      className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-12 md:pt-24 md:pb-16 flex flex-col items-center text-center gap-stack-lg"
    >
      <motion.span
        variants={item}
        className="font-label-sm text-label-sm text-primary uppercase tracking-wider border border-primary/30 bg-primary/10 rounded-full px-3 py-1"
      >
        AI coding companion
      </motion.span>

      <motion.h1
        variants={item}
        className="font-display text-headline-lg-mobile md:text-display text-on-background max-w-3xl leading-tight tracking-tight"
      >
        Stop burning tokens on <span className="gradient-text">vague prompts.</span>
      </motion.h1>

      <motion.p variants={item} className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
        Metriq analyzes your prompt against your real codebase before it ever reaches Claude, ChatGPT, Cursor,
        or VS Code, flagging what's too broad and rewriting it into something focused, so your AI tool
        doesn't waste tokens searching the whole project.
      </motion.p>

      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-3 mt-2">
        <motion.a
          whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(75, 226, 119, 0.35)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2"
          href={winDownloadUrl}
        >
          <span className="material-symbols-outlined text-[18px]">desktop_windows</span>
          Download for Windows
        </motion.a>
        {[
          // macOS gets a direct asset download (same one-click behavior as
          // Windows, so no new tab); Linux has no packaged asset yet, so it
          // still points at the releases page.
          { os: "macOS", icon: "laptop_mac", href: macDownloadUrl, direct: true },
          { os: "Linux", icon: "dns", href: releasesUrl, direct: false },
        ].map((d) => (
          <motion.a
            key={d.os}
            whileHover={{ y: -2, backgroundColor: "rgba(75, 226, 119, 0.18)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="bg-primary/10 border border-primary text-primary px-6 py-3 rounded-lg font-label-md text-label-md flex items-center gap-2"
            href={d.href}
            {...(d.direct ? {} : { rel: "noreferrer noopener", target: "_blank" })}
          >
            <span className="material-symbols-outlined text-[18px]">{d.icon}</span>
            Download for {d.os}
          </motion.a>
        ))}
      </motion.div>
    </motion.section>
  );
}

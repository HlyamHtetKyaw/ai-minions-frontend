import Link from 'next/link';
import { FEATURES } from '@/lib/constants';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      {/* Hero */}
      <section className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
          AI-powered tools for creators
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted">
          Caption, translate, transcribe, and edit video content in seconds.
          Fifteen specialised tools, one platform.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={FEATURES[0].path}
            className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-colors"
          >
            Get started
          </Link>
          <a
            href="#tools"
            className="rounded-full border border-card-border px-6 py-2.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Browse tools
          </a>
        </div>
      </section>

      {/* Tool grid */}
      <section id="tools">
        <h2 className="mb-8 text-2xl font-semibold">All tools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              key={feature.path}
              href={feature.path}
              className="group flex flex-col gap-3 rounded-xl border border-card-border bg-card p-5 transition-all hover:border-gray-400 hover:shadow-sm dark:hover:border-gray-600"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="font-semibold group-hover:underline">{feature.name}</h3>
              </div>
              <p className="text-sm text-muted leading-relaxed">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

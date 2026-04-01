import Link from 'next/link';
import { FEATURES, LANGUAGES } from '@/lib/constants';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-card-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg shrink-0">
          <span className="text-2xl">🤖</span>
          <span>AI Minions</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Features dropdown */}
          <div className="group relative">
            <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Tools
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown panel */}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute left-0 top-full mt-1 w-72 rounded-xl border border-card-border bg-background p-2 shadow-lg transition-all duration-150">
              <div className="grid grid-cols-1 gap-0.5 max-h-96 overflow-y-auto">
                {FEATURES.map((f) => (
                  <Link
                    key={f.path}
                    href={f.path}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-base">{f.icon}</span>
                    <span className="font-medium">{f.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="hidden sm:block">
            <select
              defaultValue="en"
              className="rounded-md border border-card-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none"
              aria-label="Language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <ThemeToggle />

          <div className="flex items-center gap-2 ml-1">
            <button className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Sign in
            </button>
            <button className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-colors">
              Sign up
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

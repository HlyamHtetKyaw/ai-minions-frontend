import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-6xl">🤷</span>
      <h1 className="text-3xl font-bold tracking-tight">404 — Page not found</h1>
      <p className="text-muted max-w-sm">
        That tool or page doesn&apos;t exist. Check the URL or browse all available tools.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}

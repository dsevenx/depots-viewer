export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 sm:text-5xl">
              Depots Viewer
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              View and manage your investment portfolios with ease
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Portfolio Overview
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Get a comprehensive view of all your investment portfolios in one place
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Real-time Updates
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Track your investments with real-time data and performance metrics
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Mobile Friendly
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">
                Access your portfolios anywhere, optimized for all devices
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex flex-col sm:flex-row gap-4">
              <button className="px-8 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors">
                Get Started
              </button>
              <button className="px-8 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

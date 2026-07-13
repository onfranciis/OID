// Minimal shell for Phase F0. Phase F1 replaces this with the real app shell:
// header with actor name, left navigation, router outlet, toasts, re-auth dialog.
export function App() {
  return (
    <div className="min-h-screen bg-page font-sans text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center px-4 font-bold">
          Internal ID Admin
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Admin console</h1>
        <p className="mt-2 text-muted">
          Application shell scaffolding. Sections arrive in later phases.
        </p>
      </main>
    </div>
  );
}

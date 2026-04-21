import Link from "next/link";
import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { redirect } from "next/navigation";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/dev/login");
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-900/50 hidden md:block">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-zinc-800">
            <Link href="/quotes" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded bg-sky-600 flex items-center justify-center text-white font-bold group-hover:bg-sky-500 transition-colors">
                S
              </div>
              <span className="font-semibold text-zinc-50 tracking-tight">Struxient Office</span>
            </Link>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <Link 
              href="/quotes" 
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              Quotes
            </Link>
            {/* Future office links can go here (Customers, Flows, etc) */}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                {auth.principal.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">{auth.principal.email}</span>
                <span className="text-[10px] text-zinc-500 truncate capitalize">{auth.principal.role.toLowerCase().replace('_', ' ')}</span>
              </div>
            </div>
            <Link 
              href="/dev/login" 
              className="mt-2 flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between px-8">
          <div className="md:hidden flex items-center gap-2">
             <div className="w-6 h-6 rounded bg-sky-600 flex items-center justify-center text-white text-xs font-bold">S</div>
             <span className="font-semibold text-zinc-50 text-sm">Struxient Office</span>
          </div>
          <div className="hidden md:block text-xs text-zinc-500 font-medium">
             Tenant ID: <span className="font-mono text-zinc-400">{auth.principal.tenantId}</span>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/dev/new-quote-shell" className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-3 py-1.5 rounded transition-colors font-medium">
                + New Quote
             </Link>
          </div>
        </header>

        {/* Workspace Container */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

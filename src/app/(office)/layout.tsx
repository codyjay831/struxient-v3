import Link from "next/link";
import { principalHasCapability, tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { redirect } from "next/navigation";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    redirect("/login");
  }

  const { principal } = auth;
  // Fallback ladder: canonical displayName -> email -> userId -> "?".
  // Avatar/identity rendering must never assume any single field exists.
  const identityLabel =
    (principal.displayName && principal.displayName.trim()) ||
    (principal.email && principal.email.trim()) ||
    principal.userId ||
    "?";
  const identityInitial = (identityLabel.charAt(0) || "?").toUpperCase();
  const roleLabel = principal.role
    ? principal.role.toLowerCase().replace(/_/g, " ")
    : "member";

  const showTenantSettings = principalHasCapability(principal, "office_mutate");

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
            <Link
              href="/projects"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/></svg>
              Projects
            </Link>
            <Link
              href="/customers"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Customers
            </Link>
            <Link
              href="/work"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
              Work
            </Link>
            <Link
              href="/search"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Search
            </Link>
            <Link
              href="/flows"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Flows
            </Link>
            <Link
              href="/jobs"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Jobs
            </Link>
            {showTenantSettings ? (
              <>
                <Link
                  href="/settings/tenant"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  Tenant settings
                </Link>
                <Link
                  href="/settings/team"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Team & roles
                </Link>
              </>
            ) : null}
            <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Library
            </div>
            <Link
              href="/library/packets"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Packets
            </Link>
            <Link
              href="/library/task-definitions"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Task definitions
            </Link>
            <Link
              href="/library/process-templates"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              Process templates
            </Link>
            {/* Future office links can go here (Customers, etc) */}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                {identityInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">{identityLabel}</span>
                <span className="text-[10px] text-zinc-500 truncate capitalize">{roleLabel}</span>
              </div>
            </div>
            <Link 
              href="/login" 
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
             Tenant ID: <span className="font-mono text-zinc-400">{principal.tenantId}</span>
          </div>
          <div className="flex items-center gap-4">
             <Link
               href="/search"
               className="text-xs text-zinc-400 hover:text-zinc-200 font-medium hidden sm:inline"
             >
               Search
             </Link>
             <Link href="/quotes/new" className="text-xs bg-sky-700 hover:bg-sky-600 text-white px-3 py-1.5 rounded transition-colors font-medium">
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

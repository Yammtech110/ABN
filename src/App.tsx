import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DirectoryProvider, useDirectory } from './context/DirectoryContext';
import { BackNavigationProvider, exitNativeApp } from './context/BackNavigationContext';
import { ExitConfirmDialog } from './components/ExitConfirmDialog';
import { TRANSLATIONS } from './data/translations';
import { AuthScreen } from './screens/AuthScreen';
import { SplashScreen, SPLASH_FADE_MS, SPLASH_VISIBLE_MS } from './screens/SplashScreen';
import { BusinessDetailsModal } from './components/BusinessDetailsModal';
import { HomeTab } from './components/HomeTab';
import { SearchTab } from './components/SearchTab';
import { SavedTab } from './components/SavedTab';

import { BusinessPortalTab } from './components/BusinessPortalTab';
import { AccountTab } from './components/AccountTab';
import { AdminPanelTab } from './components/AdminPanelTab';
import { JobManagementScreen } from './components/JobManagementScreen';
import { JobBoardScreen } from './components/JobBoardScreen';
import { LegalDocScreen } from './components/LegalDocScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { Business } from './types';
import { LegalDocId } from './data/legalContent';
import { getUserListing, canPostJobs } from './utils/listingAccess';
import {
  Home,
  Search,
  Heart,
  Briefcase,
  User,
  Shield,
  Smartphone,
  Info,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

// ── Live Clock Hook ────────────────────────────────────────────
function useLiveClock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Detect if running on real mobile device (not desktop browser) ──
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Tab View Wrapper with animation ───────────────────────────
const TabView: React.FC<{ children: React.ReactNode; tabKey: string }> = ({ children, tabKey }) => (
  <div key={tabKey} className="tab-view">
    {children}
  </div>
);

// ── Shared Tab Content Renderer ────────────────────────────────
const CONSUMER_TABS = ['home', 'search', 'saved'] as const;

function TabContent({
  activeTab,
  setActiveTab,
  setSelectedBusiness,
  searchQueryText,
  setSearchQueryText,
  legalDocId,
  setLegalDocId,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setSelectedBusiness: (b: Business | null) => void;
  searchQueryText: string;
  setSearchQueryText: (q: string) => void;
  legalDocId: LegalDocId | null;
  setLegalDocId: (id: LegalDocId | null) => void;
}) {
  const { currentUser, businesses } = useDirectory();
  const myListing = getUserListing(currentUser, businesses);
  const notificationsBackRef = React.useRef('account');

  const switchTab = (tab: string) => {
    if (tab === 'notifications') {
      notificationsBackRef.current = activeTab === 'home' ? 'home' : 'account';
    }
    setActiveTab(tab);
  };

  return (
    <>
      {activeTab === 'home' && (
        <TabView tabKey="home">
          <HomeTab
            onSelectBusiness={setSelectedBusiness}
            onSwitchTab={switchTab}
            setSearchQueryText={setSearchQueryText}
          />
        </TabView>
      )}
      {activeTab === 'search' && (
        <TabView tabKey="search">
          <SearchTab
            initialQuery={searchQueryText}
            onClearQuery={() => setSearchQueryText('')}
            onSelectBusiness={setSelectedBusiness}
            onSwitchTab={switchTab}
          />
        </TabView>
      )}
      {activeTab === 'saved' && (
        <TabView tabKey="saved">
          <SavedTab onSelectBusiness={setSelectedBusiness} onSwitchTab={switchTab} />
        </TabView>
      )}
      {activeTab === 'business' && (
        <TabView tabKey="business">
          <BusinessPortalTab registrationOnly />
        </TabView>
      )}

      {activeTab === 'account' && (
        <TabView tabKey="account">
          <AccountTab
            onSwitchTab={switchTab}
            onOpenLegal={(id) => {
              setLegalDocId(id);
              setActiveTab('legal');
            }}
          />
        </TabView>
      )}
      {activeTab === 'portal-management' && (
        <TabView tabKey="portal-management">
          <BusinessPortalTab
            onBack={() => setActiveTab('account')}
            manageMode
          />
        </TabView>
      )}

      {activeTab === 'job-management' && canPostJobs(myListing) && (
        <TabView tabKey="job-management">
          <JobManagementScreen onBack={() => setActiveTab('account')} />
        </TabView>
      )}

      {activeTab === 'job-board' && (
        <TabView tabKey="job-board">
          <JobBoardScreen onBack={() => setActiveTab('home')} />
        </TabView>
      )}

      {activeTab === 'notifications' && (
        <TabView tabKey="notifications">
          <NotificationsScreen
            onBack={() => setActiveTab(notificationsBackRef.current)}
          />
        </TabView>
      )}

      {activeTab === 'legal' && legalDocId && (
        <TabView tabKey={`legal-${legalDocId}`}>
          <LegalDocScreen
            docId={legalDocId}
            onBack={() => {
              setLegalDocId(null);
              setActiveTab('account');
            }}
          />
        </TabView>
      )}

      {activeTab === 'admin' && (
        <TabView tabKey="admin">
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
              <button
                onClick={() => setActiveTab('account')}
                className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
                aria-label="Back to Account"
              >
                <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
              </button>
              <span className="text-xs font-bold text-[#FFA048] uppercase tracking-wider">Admin Panel</span>
            </div>
            <AdminPanelTab />
          </div>
        </TabView>
      )}
    </>
  );
}

// ── Bottom Nav Bar (shared) ───────────────────────────────────
function BottomNav({
  activeTab,
  setActiveTab,
  setSearchQueryText,
  t,
  isAdmin,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setSearchQueryText: (q: string) => void;
  t: Record<string, string>;
  isAdmin?: boolean;
}) {
  const isAccountActive = activeTab === 'account' || activeTab === 'portal-management' || activeTab === 'job-management' || activeTab === 'notifications' || activeTab === 'legal';

  return (
    <nav className="flex justify-between items-center h-full px-2">

      {!isAdmin && (
        <>
          <button
            onClick={() => { setSearchQueryText(''); setActiveTab('home'); }}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${activeTab === 'home' ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
            id="tab-btn-home"
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] tracking-tight">{t.home}</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${activeTab === 'search' ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
            id="tab-btn-search"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] tracking-tight">{t.search}</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${activeTab === 'saved' ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
            id="tab-btn-saved"
          >
            <Heart className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] tracking-tight">{t.saved}</span>
          </button>
        </>
      )}

      {isAdmin && (
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${activeTab === 'admin' ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
          id="tab-btn-admin"
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] tracking-tight">{t.adminPanel || 'Admin'}</span>
        </button>
      )}

      {/* Account tab — always visible; highlights for account, portal-management, and admin sub-pages */}
      <button
        onClick={() => setActiveTab('account')}
        className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${isAccountActive ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
        id="tab-btn-account"
      >
        <User className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] tracking-tight">{t.account}</span>
      </button>
    </nav>
  );
}

function DirectoryAppContent() {
  const { language, currentUser, businesses, authReady, isAuthenticated } = useDirectory();
  const t = TRANSLATIONS[language];
  const liveTime = useLiveClock();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<string>('home');
  const [legalDocId, setLegalDocId] = useState<LegalDocId | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQueryText, setSearchQueryText] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleRootBack = useCallback(() => {
    if (showExitConfirm) {
      setShowExitConfirm(false);
      return;
    }
    if (selectedBusiness) {
      setSelectedBusiness(null);
      return;
    }
    const parentTab: Record<string, string> = {
      'job-management': 'account',
      'portal-management': 'account',
      'job-board': 'home',
      notifications: 'account',
      legal: 'account',
      admin: 'account',
    };
    if (parentTab[activeTab]) {
      if (activeTab === 'legal') setLegalDocId(null);
      setActiveTab(parentTab[activeTab]);
      return;
    }
    if (activeTab !== 'home') {
      setActiveTab('home');
      return;
    }
    setShowExitConfirm(true);
  }, [activeTab, selectedBusiness, showExitConfirm]);

  const confirmExitApp = useCallback(() => {
    setShowExitConfirm(false);
    void exitNativeApp();
  }, []);

  // Welcome splash — hold for exactly 2s, then fade into main layout
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), SPLASH_VISIBLE_MS);
    const hideTimer = setTimeout(() => setShowSplash(false), SPLASH_VISIBLE_MS + SPLASH_FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const myListing = getUserListing(currentUser, businesses);

  const prevRoleRef = useRef(currentUser?.role);
  useEffect(() => {
    const prev = prevRoleRef.current;
    const next = currentUser?.role;
    if (next === 'admin' && prev !== 'admin') {
      setActiveTab('admin');
    }
    prevRoleRef.current = next;
  }, [currentUser?.role]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
  }, []);

  // Job management is only for approved business listings
  useEffect(() => {
    if (activeTab === 'job-management' && !canPostJobs(myListing)) {
      setActiveTab('account');
    }
  }, [activeTab, myListing]);

  const verifiedActiveCount = businesses.filter((b) => b.isVerified && b.status === 'active').length;
  const expiredCount = businesses.filter((b) => b.status === 'suspended').length;

  const splashOverlay = showSplash ? <SplashScreen fading={splashFading} /> : null;

  if (!authReady) {
    return (
      <>
        {splashOverlay}
        <div
          className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#191512] to-[#0A0705] text-[#F4E3D7]"
          id="auth-boot-loading"
        >
          <Loader2 className="w-8 h-8 text-[#FFA048] animate-spin mb-3" />
          <p className="text-xs text-gray-500 font-medium">Checking session…</p>
        </div>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {splashOverlay}
        <AuthScreen />
      </>
    );
  }

  // ── MOBILE LAYOUT: Full-screen native app experience ──────────
  if (isMobile) {
    return (
      <BackNavigationProvider onRootBack={handleRootBack}>
      <>
      {splashOverlay}
      <div
        className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#191512] to-[#0A0705] text-[#F4E3D7]"
        id="app-root-mobile"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 pt-4 pb-2">
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setSelectedBusiness={setSelectedBusiness}
            searchQueryText={searchQueryText}
            setSearchQueryText={setSearchQueryText}
            legalDocId={legalDocId}
            setLegalDocId={setLegalDocId}
          />
        </div>

        {/* Native Bottom Navigation Bar */}
        <div
          className="flex-shrink-0 bg-[#0A0705]/80 backdrop-blur-md border-t border-[#2D2319] z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="h-14">
            <BottomNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSearchQueryText={setSearchQueryText}
              t={t as unknown as Record<string, string>}
              isAdmin={isAdmin}
            />
          </div>
        </div>

        {/* Global Modals */}
        {selectedBusiness && (
          <BusinessDetailsModal
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
          />
        )}

        <ExitConfirmDialog
          open={showExitConfirm}
          onStay={() => setShowExitConfirm(false)}
          onExit={confirmExitApp}
        />
      </div>
      </>
      </BackNavigationProvider>
    );
  }

  // ── DESKTOP LAYOUT: Simulator sandbox (browser only) ─────────
  return (
    <>
    {splashOverlay}
    <div className="min-h-screen bg-[#0A0705] text-[#F4E3D7] font-sans flex flex-col antialiased" id="app-root">

      {/* Top Navbar */}
      <header className="border-b border-[#2D2319] bg-[#0A0705]/80 backdrop-blur-md p-4 sticky top-0 z-40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#FFA048] tracking-widest uppercase">ABN</h1>
            <div className="hidden sm:block min-w-0">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest truncate">{t.tagline}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Phone Simulator */}
        <section className="lg:col-span-6 flex flex-col items-center justify-center py-4">
          <div className="relative w-full max-w-[395px] h-[812px] rounded-[52px] border-[10px] border-[#2D2319] bg-[#0F0E0C] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col ring-8 ring-[#1A1510]/50">

            {/* Status Bar with live clock — desktop simulator only */}
            <div className="absolute top-0 inset-x-0 h-6 bg-black z-30 flex justify-between items-center px-8 text-[9px] font-bold text-gray-400">
              <span className="font-mono">{liveTime}</span>
              <div className="w-16 h-3.5 bg-black rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0 flex items-center justify-center">
                <div className="w-8 h-1 bg-gray-800 rounded-full"></div>
              </div>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <div className="w-4 h-2.5 bg-gray-600 rounded-sm flex items-end p-[1px] border border-gray-500">
                  <div className="w-full h-[80%] bg-[#FFA048]"></div>
                </div>
              </div>
            </div>

            {/* App Content */}
            <div className="flex-1 pt-8 pb-16 overflow-y-auto px-5 bg-gradient-to-b from-[#191512] to-[#0A0705] scrollbar-none">
              <TabContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                setSelectedBusiness={setSelectedBusiness}
                searchQueryText={searchQueryText}
                setSearchQueryText={setSearchQueryText}
                legalDocId={legalDocId}
                setLegalDocId={setLegalDocId}
              />
            </div>

            {/* Simulator Bottom Navigation Bar */}
            <div className="absolute bottom-0 inset-x-0 h-16 bg-[#0A0705]/80 backdrop-blur-xl border-t border-[#2D2319] rounded-b-[42px] z-30 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]">
                  <BottomNav
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    setSearchQueryText={setSearchQueryText}
                    t={t as unknown as Record<string, string>}
                    isAdmin={isAdmin}
                  />
            </div>

            {/* Home indicator bar */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-700 rounded-full z-30"></div>
          </div>
        </section>

        {/* Right Sandbox Panel */}
        <section className="lg:col-span-6 space-y-6">

          <div className="p-5 rounded-3xl bg-[#0F0E0C] border border-[#2D2319] space-y-2 animate-fade-in-up">
            <div className="flex items-center gap-2 text-[#FFA048] text-xs font-bold uppercase tracking-wider">
              <Smartphone className="w-4 h-4" />
              <span>Interactive Community Sandbox</span>
            </div>
            <h2 className="text-xl font-bold text-white leading-snug">
              Shia Business Directory Mobile Environment
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Assalamu Alaykum! Welcome to the Ahle Bait Network (ABN) sandbox. Experience the full mobile app and verify administrative rules on the fly.
            </p>
          </div>

          {/* Directory stats */}
          <div className="p-5 rounded-3xl bg-[#0F0E0C] border border-[#2D2319] space-y-4 animate-fade-in-up" style={{ animationDelay: '0.07s' }}>
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider block">Live Directory Stats</span>
            <div className="p-3.5 rounded-2xl bg-black/40 border border-[#2D2319]/80 text-xs text-gray-400">
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Total Listings: <strong className="text-white">{businesses.length}</strong></li>
                <li>Active: <strong className="text-green-400">{verifiedActiveCount}</strong></li>
                <li>Suspended: <strong className="text-red-400">{expiredCount}</strong></li>
              </ul>
            </div>
          </div>

          {/* Compliance Info */}
          <div className="p-5 rounded-3xl bg-[#0F0E0C] border border-[#2D2319] space-y-3 animate-fade-in-up" style={{ animationDelay: '0.14s' }}>
            <div className="flex items-center gap-2 text-[#FFA048] text-xs font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Dues Compliance Audit Logs</span>
            </div>
            <p className="text-xs text-gray-300"><strong>The $50/Month Visibility Rule:</strong> Each business requires a monthly fee to remain in the directory.</p>
            <div className="p-3 rounded-2xl bg-[#1C130D]/75 border border-[#3D2C1E]/50">
              <p className="text-[11px] text-amber-400 leading-normal">
                Sign in via the auth screen to register a business or service from Home, then await admin approval before it appears in search.
              </p>
            </div>
          </div>

        </section>
      </main>

      {/* Global Modals */}
      {selectedBusiness && (
        <BusinessDetailsModal business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
      )}

      <footer className="border-t border-[#2D2319] bg-[#0F0E0C] py-6 text-center text-xs text-gray-500">
        <p>© 2026 Ahle Bait Network (ABN). All rights reserved.</p>
      </footer>
    </div>
    </>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ABN] Render error caught by boundary:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0705] flex flex-col items-center justify-center text-white p-6">
          <Shield className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-red-400">Application Error</h1>
          <p className="text-sm text-gray-400 text-center max-w-md mb-4">
            A rendering error occurred in the application structure.
          </p>
          <pre className="bg-[#191512] p-4 rounded-xl text-xs text-red-300 max-w-full overflow-x-auto">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-6 py-2 bg-[#FFA048] text-black font-bold rounded-lg hover:bg-amber-400"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <DirectoryProvider>
        <DirectoryAppContent />
      </DirectoryProvider>
    </ErrorBoundary>
  );
}

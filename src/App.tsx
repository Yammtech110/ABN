import React, { useState, useEffect, useRef } from 'react';
import { DirectoryProvider, useDirectory } from './context/DirectoryContext';
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
import { Business } from './types';
import { getUserListing, canPostJobs } from './utils/listingAccess';
import { isNativeApp } from './lib/oauth';
import {
  Home,
  Search,
  Heart,
  Briefcase,
  User,
  Shield,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

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
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setSelectedBusiness: (b: Business | null) => void;
  searchQueryText: string;
  setSearchQueryText: (q: string) => void;
}) {
  const { currentUser, businesses } = useDirectory();
  const myListing = getUserListing(currentUser, businesses);
  return (
    <>
      {activeTab === 'home' && (
        <TabView tabKey="home">
          <HomeTab
            onSelectBusiness={setSelectedBusiness}
            onSwitchTab={setActiveTab}
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
            onSwitchTab={setActiveTab}
          />
        </TabView>
      )}
      {activeTab === 'saved' && (
        <TabView tabKey="saved">
          <SavedTab onSelectBusiness={setSelectedBusiness} onSwitchTab={setActiveTab} />
        </TabView>
      )}
      {activeTab === 'business' && (
        <TabView tabKey="business">
          <BusinessPortalTab registrationOnly />
        </TabView>
      )}

      {activeTab === 'account' && (
        <TabView tabKey="account">
          <AccountTab onSwitchTab={setActiveTab} />
        </TabView>
      )}
      {/* Portal Management — opened from Account settings Manage Business/Service */}
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

      {/* Job Board — global public job listings, accessed from HomeTab "See All Jobs" */}
      {activeTab === 'job-board' && (
        <TabView tabKey="job-board">
          <JobBoardScreen onBack={() => setActiveTab('home')} />
        </TabView>
      )}

      {/* Admin panel — web browser only (hidden on Android/iOS native builds) */}
      {activeTab === 'admin' && !isNativeApp() && (
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
  showAdminPanel,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setSearchQueryText: (q: string) => void;
  t: Record<string, string>;
  /** Admin tab only on web — never on Android/iOS native builds */
  showAdminPanel?: boolean;
}) {
  const isAccountActive = activeTab === 'account' || activeTab === 'portal-management' || activeTab === 'job-management';

  return (
    <nav className="flex justify-between items-center h-full px-2">

      {!showAdminPanel && (
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

      {showAdminPanel && (
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
        className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${isAccountActive || activeTab === 'admin' ? 'text-[#FFA048] scale-110 font-black' : 'text-gray-500 hover:text-white'}`}
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

  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQueryText, setSearchQueryText] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

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
  // Admin controls stay on the web app only; native apps still receive synced directory data.
  const showAdminPanel = isAdmin && !isNativeApp();
  const myListing = getUserListing(currentUser, businesses);

  const prevRoleRef = useRef(currentUser?.role);
  useEffect(() => {
    const prev = prevRoleRef.current;
    const next = currentUser?.role;
    if (next === 'admin' && prev !== 'admin' && !isNativeApp()) {
      setActiveTab('admin');
    }
    prevRoleRef.current = next;
  }, [currentUser?.role]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', 'en');
  }, []);

  // Native builds never open the admin panel — send admins to the consumer home feed.
  useEffect(() => {
    if (isNativeApp() && activeTab === 'admin') {
      setActiveTab('home');
    }
  }, [activeTab]);

  // Job management is only for approved business listings
  useEffect(() => {
    if (activeTab === 'job-management' && !canPostJobs(myListing)) {
      setActiveTab('account');
    }
  }, [activeTab, myListing]);

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

  // Full-screen web / native app (no phone simulator sandbox)
  return (
    <>
      {splashOverlay}
      <div
        className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#191512] to-[#0A0705] text-[#F4E3D7]"
        id="app-root"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-2 md:px-8 md:pt-6">
            <TabContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSelectedBusiness={setSelectedBusiness}
              searchQueryText={searchQueryText}
              setSearchQueryText={setSearchQueryText}
            />
          </div>
        </div>

        <div
          className="flex-shrink-0 bg-[#0A0705]/90 backdrop-blur-md border-t border-[#2D2319] z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto h-14 max-w-6xl">
            <BottomNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSearchQueryText={setSearchQueryText}
              t={t as unknown as Record<string, string>}
              showAdminPanel={showAdminPanel}
            />
          </div>
        </div>

        {selectedBusiness && (
          <BusinessDetailsModal
            business={selectedBusiness}
            onClose={() => setSelectedBusiness(null)}
          />
        )}
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

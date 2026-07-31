import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { isSensitiveAuthNotification } from './utils/notifications';
import { useOpenNotificationsOnPush, usePushNotifications } from './hooks/usePushNotifications';
import { OfflineGate } from './components/OfflineGate';
import {
  Home,
  Search,
  Briefcase,
  User,
  Shield,
  ArrowLeft,
  Loader2,
  Bell,
  Heart,
} from 'lucide-react';

// Native APK only — browser (abn-1.onrender.com) uses the web layout.
const isNativeApp = (): boolean => Capacitor.isNativePlatform();

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
          <div className="min-h-full bg-[#0D0906] px-4 pt-4 pb-8">
            <BusinessPortalTab
              onBack={() => setActiveTab('account')}
              manageMode
            />
          </div>
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
          <div className="space-y-5 min-h-full px-4 pt-4 pb-8 bg-[#1E1915]">
            <div className="subpage-header sticky top-0 z-10 -mx-4 px-4 pt-1 flex items-center gap-3 pb-3 border-b border-[#2B231D] bg-[#1E1915]/95 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('account')}
                className="p-2 rounded-full bg-[#171310] hover:bg-[#1E1915] border border-[#2B231D] transition-colors"
                aria-label="Back to Account"
              >
                <ArrowLeft className="w-4 h-4 text-[#F08C32]" />
              </button>
              <span className="text-xs font-bold text-[#F08C32] uppercase tracking-wider">Admin Panel</span>
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
  unreadCount = 0,
}: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setSearchQueryText: (q: string) => void;
  t: Record<string, string>;
  isAdmin?: boolean;
  unreadCount?: number;
}) {
  const isAccountActive = activeTab === 'account' || activeTab === 'portal-management' || activeTab === 'job-management' || activeTab === 'legal';
  const isNotificationsActive = activeTab === 'notifications';
  const isJobsActive = activeTab === 'job-board';

  const tabClass = (active: boolean) =>
    `flex flex-col items-center justify-center flex-1 py-2 transition-all ${
      active ? 'text-[#F08C32] scale-105 font-black' : 'text-[#CFCFCF] hover:text-[#FFFFFF]'
    }`;

  return (
    <nav className="flex justify-between items-center h-full px-1 bg-[#171310] border-t-0" id="bottom-nav">

      {!isAdmin && (
        <>
          <button
            onClick={() => { setSearchQueryText(''); setActiveTab('home'); }}
            className={tabClass(activeTab === 'home')}
            id="tab-btn-home"
          >
            <Home className={`w-5 h-5 mb-0.5 ${activeTab === 'home' ? 'fill-[#F08C32]' : ''}`} />
            <span className="text-[9px] tracking-tight">{t.home}</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={tabClass(activeTab === 'search')}
            id="tab-btn-search"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] tracking-tight">{t.search}</span>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={tabClass(activeTab === 'saved')}
            id="tab-btn-saved"
          >
            <Heart className={`w-5 h-5 mb-0.5 ${activeTab === 'saved' ? 'fill-[#F08C32]' : ''}`} />
            <span className="text-[9px] tracking-tight">{t.saved || 'Saved'}</span>
          </button>
          <button
            onClick={() => setActiveTab('job-board')}
            className={tabClass(isJobsActive)}
            id="tab-btn-jobs"
          >
            <Briefcase className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] tracking-tight">Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`relative ${tabClass(isNotificationsActive)}`}
            id="tab-btn-notifications"
          >
            <Bell className={`w-5 h-5 mb-0.5 ${isNotificationsActive ? 'fill-[#F08C32]' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-[18%] min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#FF9E47] text-black text-[8px] font-black flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            <span className="text-[9px] tracking-tight">Notification</span>
          </button>
        </>
      )}

      {isAdmin && (
        <button
          onClick={() => setActiveTab('admin')}
          className={tabClass(activeTab === 'admin')}
          id="tab-btn-admin"
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] tracking-tight">{t.adminPanel || 'Admin'}</span>
        </button>
      )}

      <button
        onClick={() => setActiveTab('account')}
        className={tabClass(isAccountActive)}
        id="tab-btn-account"
      >
        <User className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] tracking-tight">Profile</span>
      </button>
    </nav>
  );
}

// ── Top Nav Bar (web browser) ─────────────────────────────────
function WebTopNav({
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
  const isAccountActive =
    activeTab === 'account' ||
    activeTab === 'portal-management' ||
    activeTab === 'job-management' ||
    activeTab === 'legal';

  const navBtn = (tab: string, label: string, icon: React.ReactNode, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick ?? (() => setActiveTab(tab))}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
        activeTab === tab || (tab === 'account' && isAccountActive)
          ? 'bg-[#FF9E47] text-black shadow-[0_0_15px_rgba(242, 153, 74,0.35)]'
          : 'text-[#8E8E8E] hover:text-[#FFFFFF] hover:bg-[#1E1915]'
      }`}
      id={`web-tab-${tab}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none" id="web-top-nav">
      {!isAdmin && (
        <>
          {navBtn('home', t.home, <Home className="w-4 h-4" />, () => {
            setSearchQueryText('');
            setActiveTab('home');
          })}
          {navBtn('search', t.search, <Search className="w-4 h-4" />)}
          {navBtn('saved', t.saved || 'Saved', <Heart className="w-4 h-4" />)}
          {navBtn('job-board', 'Jobs', <Briefcase className="w-4 h-4" />)}
          {navBtn('notifications', 'Notification', <Bell className="w-4 h-4" />)}
        </>
      )}
      {isAdmin && navBtn('admin', t.adminPanel || 'Admin', <Shield className="w-4 h-4" />)}
      {navBtn('account', 'Profile', <User className="w-4 h-4" />)}
    </nav>
  );
}

function DirectoryAppContent() {
  const { language, currentUser, businesses, authReady, isAuthenticated, apiToken, notifications } = useDirectory();
  const t = TRANSLATIONS[language];
  const nativeApp = isNativeApp();
  const unreadCount = isAuthenticated
    ? notifications.filter((n) => !n.isRead && !isSensitiveAuthNotification(n)).length
    : 0;

  const [activeTab, setActiveTab] = useState<string>('home');
  const [legalDocId, setLegalDocId] = useState<LegalDocId | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [searchQueryText, setSearchQueryText] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Real FCM / APNs registration when signed in on native APK
  usePushNotifications(apiToken, Boolean(isAuthenticated && apiToken));
  const openNotificationsFromPush = useCallback(() => setActiveTab('notifications'), []);
  useOpenNotificationsOnPush(openNotificationsFromPush);

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
      notifications: 'home',
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

  const splashOverlay = showSplash ? <SplashScreen fading={splashFading} /> : null;

  if (!authReady) {
    return (
      <>
        {splashOverlay}
        <div
          className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#110E0B] to-[#0D0906] text-[#F4E3D7]"
          id="auth-boot-loading"
        >
          <Loader2 className="w-8 h-8 text-[#F08C32] animate-spin mb-3" />
          <p className="text-xs text-[#8E8E8E] font-medium">Checking session…</p>
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

  // ── NATIVE APP: Full-screen mobile layout (APK only) ──────────
  if (nativeApp) {
    return (
      <BackNavigationProvider onRootBack={handleRootBack}>
      <>
      {splashOverlay}
      <div
        className="fixed inset-0 flex flex-col bg-[#0D0906] text-[#FFFFFF]"
        id="app-root-mobile"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Scrollable Content Area */}
        <div className={`flex-1 overflow-y-auto scrollbar-none pb-2 ${
          activeTab === 'home' ||
          activeTab === 'legal' ||
          activeTab === 'notifications' ||
          activeTab === 'job-board' ||
          activeTab === 'job-management' ||
          activeTab === 'admin' ||
          activeTab === 'portal-management'
            ? 'px-0 pt-0'
            : 'px-4 pt-4'
        }`}>
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

        {/* Hide bottom nav on full-page sub-screens (not main tabs) */}
        {!(
          activeTab === 'legal' ||
          activeTab === 'job-management' ||
          activeTab === 'admin' ||
          activeTab === 'portal-management'
        ) && (
        <div
          className="flex-shrink-0 bg-[#171310] border-t border-[#2B231D] z-30"
          id="bottom-nav-shell"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="h-14">
            <BottomNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSearchQueryText={setSearchQueryText}
              t={t as unknown as Record<string, string>}
              isAdmin={isAdmin}
              unreadCount={unreadCount}
            />
          </div>
        </div>
        )}

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

  // ── WEB APP: Full website layout (abn-1.onrender.com in browser) ─
  return (
    <>
      {splashOverlay}
      <div className="min-h-screen bg-[#0D0906] text-[#FFFFFF] font-sans flex flex-col antialiased" id="app-root-web">
        <header className="border-b border-[#2B231D] bg-[#0D0906]/95 backdrop-blur-md p-4 sticky top-0 z-40 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-tight">
                  <span className="text-[#FFFFFF]">AHLE</span>
                  <span className="text-[#F08C32]">BAIT</span>
                </h1>
                <p className="text-[10px] text-[#8E8E8E] font-bold uppercase tracking-widest truncate">{t.tagline}</p>
              </div>
            </div>
            <WebTopNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setSearchQueryText={setSearchQueryText}
              t={t as unknown as Record<string, string>}
              isAdmin={isAdmin}
            />
          </div>
        </header>

        <main className={`flex-1 w-full max-w-7xl mx-auto ${
          activeTab === 'home' ||
          activeTab === 'legal' ||
          activeTab === 'notifications' ||
          activeTab === 'job-board' ||
          activeTab === 'job-management' ||
          activeTab === 'admin' ||
          activeTab === 'portal-management'
            ? 'p-0'
            : 'p-4 md:p-6'
        }`}>
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setSelectedBusiness={setSelectedBusiness}
            searchQueryText={searchQueryText}
            setSearchQueryText={setSearchQueryText}
            legalDocId={legalDocId}
            setLegalDocId={setLegalDocId}
          />
        </main>

        <footer className="border-t border-[#2B231D] bg-[#171310] py-6 text-center text-xs text-[#8E8E8E]">
          <p>© 2026 Ahle Bait Network (ABN). All rights reserved.</p>
          <p className="mt-1 text-[10px] text-[#8E8E8E]">
            {verifiedActiveCount} active listings · Admin panel available on web
          </p>
        </footer>

        {selectedBusiness && (
          <BusinessDetailsModal business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />
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
        <div className="min-h-screen bg-[#0D0906] flex flex-col items-center justify-center text-white p-6">
          <Shield className="w-16 h-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-red-400">Application Error</h1>
          <p className="text-sm text-gray-400 text-center max-w-md mb-4">
            A rendering error occurred in the application structure.
          </p>
          <pre className="bg-[#110E0B] p-4 rounded-xl text-xs text-red-300 max-w-full overflow-x-auto">
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
      <OfflineGate>
        <DirectoryProvider>
          <DirectoryAppContent />
        </DirectoryProvider>
      </OfflineGate>
    </ErrorBoundary>
  );
}

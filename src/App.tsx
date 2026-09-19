import { Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Boundary } from '@/components/layout/Boundary'
import { lazyPage } from '@/lib/lazyPage'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { CommunityShell } from '@/components/community/CommunityRail'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import { Logomark } from '@/components/brand/Wordmark'
import { useParams } from 'react-router-dom'
import Landing from '@/pages/Landing'
import Auth from '@/pages/Auth'
import Home from '@/pages/Home'
import Discover from '@/pages/Discover'
import NotFound from '@/pages/NotFound'

// Everything behind the front door loads on demand.
const SpacePage = lazyPage(() => import('@/pages/SpacePage'))
const CreateHub = lazyPage(() => import('@/pages/CreateHub'))
const AssetPage = lazyPage(() => import('@/pages/AssetPage'))
const CreateOverview = lazyPage(() => import('@/pages/CreateHub').then((m) => ({ default: m.CreateOverview })))
const CreateSpaces = lazyPage(() => import('@/pages/CreateHub').then((m) => ({ default: m.CreateSpaces })))
const CreateUploads = lazyPage(() => import('@/pages/CreateUploads'))
const CreateMarketplace = lazyPage(() => import('@/pages/CreateHub').then((m) => ({ default: m.CreateMarketplace })))
const CreateInventory = lazyPage(() => import('@/pages/CreateHub').then((m) => ({ default: m.CreateInventory })))
const CreateAnalytics = lazyPage(() => import('@/pages/CreateHub').then((m) => ({ default: m.CreateAnalytics })))
const CreatorPage = lazyPage(() => import('@/pages/CreatorPage'))
const EventPage = lazyPage(() => import('@/pages/EventPage'))
const People = lazyPage(() => import('@/pages/People'))
const Communities = lazyPage(() => import('@/pages/Communities'))
const CommunityPage = lazyPage(() => import('@/pages/CommunityPage'))
const EditSpace = lazyPage(() => import('@/pages/EditSpace'))
const CreateAds = lazyPage(() => import('@/pages/CreateAds'))
const ConfigureCommunity = lazyPage(() => import('@/pages/ConfigureCommunity'))
const Terms = lazyPage(() => import('@/pages/Policies').then((m) => ({ default: m.Terms })))
const Guidelines = lazyPage(() => import('@/pages/Policies').then((m) => ({ default: m.Guidelines })))
const Privacy = lazyPage(() => import('@/pages/Policies').then((m) => ({ default: m.Privacy })))
const PolicyHub = lazyPage(() => import('@/pages/Policies'))
const PolicyPage = lazyPage(() => import('@/pages/Policies').then((m) => ({ default: m.PolicyPage })))
const Standing = lazyPage(() => import('@/pages/Standing'))
const StandingItem = lazyPage(() => import('@/pages/StandingItem'))
const Inbox = lazyPage(() => import('@/pages/Inbox'))
const Support = lazyPage(() => import('@/pages/Support'))
const SupportTicket = lazyPage(() => import('@/pages/SupportTicket'))
const Download = lazyPage(() => import('@/pages/Download'))
const AppSignIn = lazyPage(() => import('@/pages/AppSignIn'))
const WorldPage = lazyPage(() => import('@/pages/WorldPage'))
const Friends = lazyPage(() => import('@/pages/Friends'))
const Library = lazyPage(() => import('@/pages/Library'))
const Style = lazyPage(() => import('@/pages/Style'))
const Brix = lazyPage(() => import('@/pages/Brix'))
const DiscordJump = lazyPage(() => import('@/pages/DiscordJump'))
const BrixCodes = lazyPage(() => import('@/pages/BrixCodes'))
const StyleItem = lazyPage(() => import('@/pages/StyleItem'))
const Profile = lazyPage(() => import('@/pages/Profile'))
const Settings = lazyPage(() => import('@/pages/Settings'))

function Booting() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink">
      <Logomark className="h-10 animate-bob" />
      <span className="sr-only">Loading Kobblon</span>
    </div>
  )
}

/** Signed-out visitors get the landing page rather than a bounce to a form. */
function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <Booting />
  return session ? <Outlet /> : <Navigate to="/" replace />
}

function RootRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Booting />
  return session ? <Navigate to="/home" replace /> : <Landing />
}

/** Configuring a Space used to live on its own. It lives in Create now. */
function LegacyEditRedirect() {
  const { spaceId = '' } = useParams()
  return <Navigate to={`/create/spaces/${spaceId}/edit`} replace />
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {/* A page that will not draw says so, rather than leaving a blank
              rectangle with nothing to press. */}
          <Boundary>
          <Suspense fallback={<Booting />}>
            <Routes>
              <Route path="/terms" element={<Terms />} />
              <Route path="/guidelines" element={<Guidelines />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/policies" element={<PolicyHub />} />
              <Route path="/download" element={<Download />} />
              {/* Where a Kobblon application sends somebody to sign in. Named
                  one at a time rather than by pattern: /anything/sign-in
                  should be nothing, not a sign-in page for an app that does
                  not exist. Outside the app shell, because this is a step in
                  somebody else's flow rather than a page of the website. */}
              <Route path="/creator/sign-in" element={<AppSignIn />} />
              <Route path="/launcher/sign-in" element={<AppSignIn />} />
              <Route path="/policies/:slug" element={<PolicyPage />} />

              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/signup" element={<Auth mode="signup" />} />

              {/* the side of the site anyone can read without an account */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<RootRoute />} />
              </Route>

              <Route element={<AppShell />}>
                {/* open to guests so a shared link works logged out */}
                <Route path="/discover" element={<Discover />} />
                {/* A World is readable by anybody; playing it needs the
                    Launcher. Not /e/, which community events already own. */}
                <Route path="/worlds/:id" element={<WorldPage />} />
                <Route path="/worlds/:id/:slug" element={<WorldPage />} />
                <Route path="/create" element={<CreateHub />}>
                  <Route index element={<CreateOverview />} />
                  <Route path="spaces" element={<CreateSpaces />} />
                  <Route path="uploads" element={<CreateUploads />} />
                  <Route path="marketplace" element={<CreateMarketplace />} />
                  <Route path="inventory" element={<CreateInventory />} />
                  <Route path="analytics" element={<CreateAnalytics />} />
                  <Route path="ads" element={<CreateAds />} />
                  <Route path="creator/:username" element={<CreatorPage />} />
                  {/* Configuring a Space is Create's business; building one is
                      its own screen, so it keeps its own address. */}
                  <Route path="worlds/:spaceId/edit" element={<EditSpace />} />
                  <Route path=":tag" element={<AssetPage />} />
                </Route>
                <Route path="/people" element={<People />} />
                <Route path="/d/:id" element={<DiscordJump />} />
                <Route path="/style" element={<Style />} />
                <Route path="/style/:tag" element={<StyleItem />} />
                <Route element={<CommunityShell />}>
                  <Route path="/communities" element={<Communities />} />
                  <Route
                    path="/communities/new"
                    element={<Navigate to="/communities?new=1" replace />}
                  />
                  <Route path="/c/:id/:name" element={<CommunityPage />} />
                  <Route path="/c/:slug" element={<CommunityPage />} />
                </Route>
                {/* The numbered addresses are the real ones; the older
                    name-only forms still answer and redirect. */}
                <Route path="/u/:id/:name" element={<Profile />} />
                {/* Somebody's people, on the same page yours is on. */}
                <Route path="/u/:id/:name/friends" element={<Friends />} />
                <Route path="/u/:username" element={<Profile />} />
                <Route path="/s/:id/:name" element={<SpacePage />} />
                <Route path="/e/:id/:name" element={<EventPage />} />
                <Route path="/e/:id" element={<EventPage />} />
                <Route path="/u/:username/:slug" element={<SpacePage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/home" element={<Home />} />
                  <Route
                    path="/spaces/:spaceId/edit"
                    element={<LegacyEditRedirect />}
                  />
                  <Route element={<CommunityShell />}>
                    <Route path="/c/:slug/configure" element={<ConfigureCommunity />} />
                  </Route>
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/brix" element={<Brix />} />
                  <Route path="/brix/codes" element={<BrixCodes />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/standing" element={<Standing />} />
                  <Route path="/standing/:id" element={<StandingItem />} />
                  <Route path="/inbox" element={<Inbox />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/support/:id" element={<SupportTicket />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
          </Boundary>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
    </BrowserRouter>
  )
}

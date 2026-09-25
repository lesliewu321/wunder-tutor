import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Home } from './features/home/Home';
import { LabHome, LabSound, LabStagePlayer } from './features/lab/Lab';
import { LessonPlayer } from './features/lesson/LessonPlayer';
import { CourseCheck } from './features/onboarding/CourseCheck';
import { Onboarding } from './features/onboarding/Onboarding';
import { Conversation, PracticeHome } from './features/practice/Practice';
import { Me, ParentZone } from './features/profile/Profile';
import { SignIn } from './features/profile/SignIn';
import { Progress } from './features/progress/Progress';
import { useProfile, useStore } from './state/store';
import { isGrownUp } from './domain/types';
import type { Key } from './i18n';
import { useT } from './i18n/useT';
import { Icon, type IconName } from './ui/Icon';
import { Toaster } from './ui/kit';
import { BookTab } from './features/say/BookTab';
import { TwisterPlay, Twisters } from './features/twisters/Twisters';
import { SayIt } from './features/say/SayIt';
import { CameraHost } from './features/say/CameraHost';
import { pressBack } from './back';
import { isApp } from './platform';

// Five places to go. What a screen DOES lives on the screen: the camera is Snap & say's own button, the microphone
// belongs to lessons and conversations. A camera in the bar was out of place beside the course and a second "New
// photo" beside the book. Snap & say was Home's second mode until 2026-09-25, when Leslie drew Home's two mode cards
// onto the bar: the Course card was the Learn tab twice over, so it went, and the book got a tab of its own — with the
// camera icon, at Leslie's word ("use camera icon for snap and say").
const TABS: { to: string; label: Key; icon: IconName }[] = [
  { to: '/', label: 'common.nav.learn', icon: 'home' },
  { to: '/lab', label: 'common.nav.lab', icon: 'lab' },
  { to: '/book', label: 'common.nav.book', icon: 'camera' },
  { to: '/progress', label: 'common.nav.progress', icon: 'chart' },
  { to: '/me', label: 'common.nav.me', icon: 'user' },
];

function RequireProfile() {
  const profile = useProfile();
  return profile ? <Outlet /> : <Navigate to="/welcome" replace />;
}

function Tabs() {
  const { t } = useT();
  return (
    <>
      <main className="tab-main"><Outlet /></main>
      <nav className="nav" aria-label={t('common.nav.main')}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={({ isActive }) => `nav__item ${isActive ? 'is-active' : ''}`}>
            <span className="nav__icon"><Icon name={tab.icon} size={24} /></span>
            <span className="nav__label">{t(tab.label)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/** Android’s own Back, in the phone app (src/back.ts). The plugin is loaded only there. */
function PhoneBack() {
  const nav = useNavigate();
  const path = useLocation().pathname;
  const here = useRef(path);
  here.current = path;
  useEffect(() => {
    if (!isApp) return;
    let gone = false;
    let remove = () => {};
    void import('@capacitor/app').then(async ({ App: Phone }) => {
      const handle = await Phone.addListener('backButton', () => { pressBack(here.current, { back: () => nav(-1), learn: () => nav('/', { replace: true }), exit: () => void Phone.exitApp() }); });
      if (gone) void handle.remove(); else remove = () => void handle.remove();
    });
    return () => { gone = true; remove(); };
  }, [nav]);
  return null;
}

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => { document.getElementById('app-frame')?.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  const band = useProfile()?.band ?? 'junior';
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.band = band;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && mq.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161124' : isGrownUp(band) ? '#f7f6fb' : '#fff8ee');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [band, theme]);

  return (
    <BrowserRouter>
      <div id="app-frame" className="frame">
        <ScrollReset />
        <PhoneBack />
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/signin" element={<SignIn />} />
          <Route element={<RequireProfile />}>
            <Route element={<Tabs />}>
              <Route index element={<Home />} />
              <Route path="lab" element={<LabHome />} />
              <Route path="book" element={<BookTab />} />
              <Route path="twisters" element={<Twisters />} />
              <Route path="twisters/:twister" element={<TwisterPlay />} />
              <Route path="speak" element={<PracticeHome />} />
              <Route path="progress" element={<Progress />} />
              <Route path="me" element={<Me />} />
            </Route>
            <Route path="lab/:sound" element={<LabSound />} />
            <Route path="lab/:sound/:stage" element={<LabStagePlayer />} />
            <Route path="lesson/:lessonId" element={<LessonPlayer />} />
            <Route path="speak/:scenarioId" element={<Conversation />} />
            <Route path="say" element={<SayIt />} />
            <Route path="parents" element={<ParentZone />} />
            <Route path="check/:course" element={<CourseCheck />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CameraHost />
        <Toaster />
      </div>
    </BrowserRouter>
  );
}

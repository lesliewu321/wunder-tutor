import { useEffect } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './features/home/Home';
import { LabHome, LabSound, LabStagePlayer } from './features/lab/Lab';
import { LessonPlayer } from './features/lesson/LessonPlayer';
import { CourseCheck } from './features/onboarding/CourseCheck';
import { Onboarding } from './features/onboarding/Onboarding';
import { Conversation, PracticeHome } from './features/practice/Practice';
import { Me, ParentZone } from './features/profile/Profile';
import { Progress } from './features/progress/Progress';
import { useProfile, useStore } from './state/store';
import { isGrownUp } from './domain/types';
import { Icon, type IconName } from './ui/Icon';
import { Toaster } from './ui/kit';
import { SayIt } from './features/say/SayIt';

const TABS: { to: string; label: string; icon: IconName; center?: boolean }[] = [
  { to: '/', label: 'Learn', icon: 'home' },
  { to: '/lab', label: 'Lab', icon: 'lab' },
  { to: '/speak', label: 'Speak', icon: 'mic', center: true },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/me', label: 'Me', icon: 'user' },
];

function RequireProfile() {
  const profile = useProfile();
  return profile ? <Outlet /> : <Navigate to="/welcome" replace />;
}

function Tabs() {
  return (
    <>
      <main className="tab-main"><Outlet /></main>
      <nav className="nav" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `nav__item ${t.center ? 'nav__item--center' : ''} ${isActive ? 'is-active' : ''}`}>
            <span className="nav__icon"><Icon name={t.icon} size={t.center ? 28 : 24} /></span>
            <span className="nav__label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
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
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route element={<RequireProfile />}>
            <Route element={<Tabs />}>
              <Route index element={<Home />} />
              <Route path="lab" element={<LabHome />} />
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
        <Toaster />
      </div>
    </BrowserRouter>
  );
}

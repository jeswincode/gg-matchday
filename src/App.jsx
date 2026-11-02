import {lazy, Suspense, useCallback, useRef} from 'react';
import {api, invalidate, setApiActiveWorld} from './lib/api';
import {getActiveWorldSlug, worldContextHeaders} from './lib/worldContext.js';
import {StartupScreen, LoginDashboard, WelcomeScreen} from './components/StartupExperience';
const LeaderboardView = lazy(() => import('./components/Leaderboard'));
const Clasico = lazy(() => import('./components/Clasico'));
const MatchHistoryCard = lazy(() => import('./components/ui/MatchHistoryCard'));
const PlayersDirectory = lazy(() => import('./features/players/PlayersDirectory'));
const PlayerProfile = lazy(() => import('./features/players/PlayerProfile'));
const Calendar = lazy(() => import('./features/calendar/Calendar'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const MatchRecordForm = lazy(() => import('./features/matches/MatchRecordForm'));
const ClubsMode = lazy(() => import('./features/clubs/ClubsMode'));
const Awards = lazy(()=>import('./components/Awards'));
const MatchDetail = lazy(()=>import('./components/MatchDetail'));
const HallOfFame = lazy(()=>import('./components/HallOfFame'));
const Chat = lazy(()=>import('./components/Chat'));
const GlobalMapPage = lazy(() => import('./features/globalMap/GlobalMapPage'));
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEm¶»§q«^
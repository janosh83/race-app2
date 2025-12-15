import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ActiveRace from '../ActiveRace';
import { selectActiveRace } from '../../utils/activeRaceUtils';
import { useTime } from '../../contexts/TimeContext';

function ActiveRacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRace, setActiveRace, timeInfo, signedRaces } = useTime();

  useEffect(() => {
    // Check if this is initial app load (flag set by Login component)
    const isInitialLoad = sessionStorage.getItem('initialLoad') === 'true';
    
    // Only auto-redirect on initial load after login, not on manual navigation
    if (!isInitialLoad) return;

    // Clear the flag so subsequent visits don't redirect
    sessionStorage.removeItem('initialLoad');

    // Auto-redirect to map when there's exactly one active race and time state allows it
    const { activeRaceId, candidates } = selectActiveRace(signedRaces || []);
    
    if (activeRaceId && candidates.length === 1) {
      // Ensure TimeContext knows the full activeRace object
      const candidate = (signedRaces || []).find(r => (r.race_id ?? r.id ?? r.raceId) === activeRaceId) || null;
      if (candidate && !activeRace) setActiveRace(candidate);
      
      // Only auto-redirect to map if the time state allows it (showing checkpoints or logging)
      const state = timeInfo?.state;
      if (state && state !== 'BEFORE_SHOW' && state !== 'AFTER_SHOW') {
        navigate(`/race/${activeRaceId}/map`, { replace: true });
      }
    }
  }, [signedRaces, activeRace, setActiveRace, timeInfo, navigate]);

  return <ActiveRace />;
}

export default ActiveRacePage;

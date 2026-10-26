import React from 'react';

import ActiveRace from '../ActiveRace';

// Race selection page. Auto-selection and the redirect to the map after login
// are handled by TimeContext.syncSignedRaces and Login.
function ActiveRacePage() {
  return <ActiveRace />;
}

export default ActiveRacePage;

import React from 'react';
import { useOutletContext } from 'react-router-dom';

import CheckpointsList from '../CheckpointsList';

function CheckpointsPage() {
  const { navHeight = 0 } = useOutletContext() || {};
  return <CheckpointsList topOffset={navHeight} />;
}

export default CheckpointsPage;

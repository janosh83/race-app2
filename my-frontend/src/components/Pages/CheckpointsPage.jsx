import React from 'react';
import { useOutletContext } from 'react-router-dom';

import CheckpointsList from '../CheckpointsList';

function CheckpointsPage() {
  const { navHeight } = useOutletContext();
  return <CheckpointsList topOffset={navHeight} />;
}

export default CheckpointsPage;

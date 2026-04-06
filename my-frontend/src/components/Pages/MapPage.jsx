import React from 'react';
import { useOutletContext } from 'react-router-dom';

import Map from '../Map';

function MapPage() {
  const { navHeight = 0 } = useOutletContext() || {};

  return <Map topOffset={navHeight} />;
}

export default MapPage;

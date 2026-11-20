import React from 'react';
import { useOutletContext } from 'react-router-dom';

import Map from '../Map';

function MapPage() {
  const { navHeight, tabbarHeight = 0 } = useOutletContext();
  
  return <Map topOffset={navHeight} bottomOffset={tabbarHeight} />;
}

export default MapPage;

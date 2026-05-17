import React from 'react';
import { useOutletContext } from 'react-router-dom';

import Tasks from '../Tasks';

function TasksPage() {
  const { navHeight } = useOutletContext();
  return <Tasks topOffset={navHeight} />;
}

export default TasksPage;

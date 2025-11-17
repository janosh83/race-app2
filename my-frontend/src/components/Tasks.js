import React from 'react';
import { useEffect } from 'react';
import { isTokenExpired, logoutAndRedirect } from '../utils/auth';
 
function Tasks() {
  useEffect(() => {
    const check = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      if (isTokenExpired(token, 5)) logoutAndRedirect();
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
  
   return (
     <div className="container mt-5">
       <h1>Welcome to the Tasks Page!</h1>
       <p>You are logged in.</p>
     </div>
   );
 }
 
 export default Tasks;
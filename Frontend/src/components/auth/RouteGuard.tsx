import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '@/services/auth';

type RouteGuardProps = {
  role?: 'citizen' | 'official' | 'head_supervisor';
};

export const RouteGuard = ({ role }: RouteGuardProps) => {
  const isAuthenticated = authService.isAuthenticated();
  const user = authService.getCurrentUser();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return <Outlet />;
  }

  const redirectToOfficial = <Navigate to="/official/dashboard" replace />;
  const redirectToSupervisor = <Navigate to="/official/supervisor/dashboard" replace />;

  if (role === 'head_supervisor') {
    if (user.userType !== 'head_supervisor') {
      if (user.userType === 'official') {
        return redirectToOfficial;
      }
      return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
  }

  if (role === 'official') {
    if (user.userType !== 'official') {
      if (user.userType === 'head_supervisor') {
        return redirectToSupervisor;
      }
      return <Navigate to="/dashboard" replace />;
    }
    return <Outlet />;
  }

  if (role === 'citizen' && user.userType !== 'citizen') {
    if (user.userType === 'head_supervisor') {
      return redirectToSupervisor;
    }
    if (user.userType === 'official') {
      return redirectToOfficial;
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};






// import { Navigate, Outlet } from 'react-router-dom';
// import { authService } from '@/services/auth';

// type RouteGuardProps = {
//   role?: 'citizen' | 'official';
// };

// export const RouteGuard = ({ role }: RouteGuardProps) => {
//   const isAuthenticated = authService.isAuthenticated();
//   const user = authService.getCurrentUser();

//   if (!isAuthenticated || !user) {
//     return <Navigate to="/login" replace />;
//   }

//   if (role && user.userType !== role) {
//     if (user.userType === 'official') {
//       return <Navigate to="/official/dashboard" replace />;
//     }
//     return <Navigate to="/dashboard" replace />;
//   }

//   return <Outlet />;
// };

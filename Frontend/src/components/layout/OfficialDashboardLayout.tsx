import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Shield, 
  Home, 
  ClipboardList,
  Users,
  BarChart3,
  MapPin,
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Bell,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { authService } from '@/services/auth';
import { SettingsModal } from '@/components/SettingsModal';

interface OfficialDashboardLayoutProps {
  children: ReactNode;
  onSettingsClick?: () => void;
}


export const OfficialDashboardLayout = ({ children, onSettingsClick }: OfficialDashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const user = authService.getCurrentUser();
  const userRole = user?.userType === 'head_supervisor' ? 'head_supervisor' : 'official';
  const isHeadSupervisor = userRole === 'head_supervisor';
  const basePath = isHeadSupervisor ? '/official/supervisor' : '/official';
  const userName = user?.fullName || user?.name || user?.email || 'Official';
  const userDept = user?.department || (isHeadSupervisor ? 'City Command' : 'Operations');
  const roleBadgeLabel = isHeadSupervisor ? 'Head Supervisor Portal' : 'Department Official Portal';
  const navItems = [
    { icon: Home, label: isHeadSupervisor ? 'Command HQ' : 'Overview', slug: '/dashboard' },
    { icon: MapPin, label: 'Live Map', slug: '/map' },
    { icon: BarChart3, label: 'Analytics', slug: '/analytics', roles: ['head_supervisor'] }, 
    { icon: ClipboardList, label: isHeadSupervisor ? 'All Tickets' : 'My Tickets', slug: '/tickets' },
    { icon: Users, label: 'Personnel', slug: '/personnel', roles: ['head_supervisor'] },
    { icon: Bell, label: 'Alerts', slug: '/alerts' },
  ].filter((item) => !item.roles || item.roles?.includes(userRole as 'official' | 'head_supervisor'));
  const headerNav = navItems.find((item) => location.pathname.startsWith(`${basePath}${item.slug}`));

  const handleLogout = async () => {
    await authService.logout();
    navigate('/official/login'); 
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
      return;
    }
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOfficial />
      
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 gradient-hero h-16 flex items-center px-4">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-white hover:bg-white/10 rounded-lg"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <Link to={`${basePath}/dashboard`} className="flex items-center gap-2 mx-auto text-white">
          <div className="p-1.5 rounded-lg bg-white/10">
            <Shield className="h-5 w-5" />
          </div>
          <span className="font-heading font-bold">SafeLive Admin</span>
        </Link>

        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="p-2 text-white hover:bg-white/10 rounded-lg"
        >
          <User className="h-5 w-5" />
        </button>
      </header>

      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed top-0 left-0 bottom-0 w-64 gradient-hero text-white z-50 transform transition-transform duration-300",
        "lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between border-b border-white/10">
            <Link to={`${basePath}/dashboard`} className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/10">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <span className="text-lg font-heading font-bold block">SafeLive</span>
                <span className="text-xs text-white/60">Admin Portal</span>
              </div>
            </Link>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const targetPath = `${basePath}${item.slug}`;
              const isActive = location.pathname.startsWith(targetPath);
              return (
                <Link
                  key={item.slug}
                  to={targetPath}
                  onClick={() => setIsSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                    isActive 
                      ? "bg-white/20" 
                      : "hover:bg-white/10"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                handleSettingsClick();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/10"
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </button>
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{userName}</div>
                <div className="text-xs text-white/60 truncate">{userDept}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <main className={cn(
        "min-h-screen pt-16 lg:pt-0 lg:pl-64 transition-all duration-300"
      )}>
        <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-card border-b border-border">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-heading font-semibold text-foreground">
              {headerNav?.label || (isHeadSupervisor ? 'Command HQ' : 'Dashboard')}
            </h1>
            <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full">
              {roleBadgeLabel}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-accent" />
                </div>
                <span className="font-medium text-sm">{userName}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isProfileOpen && "rotate-180"
                )} />
              </button>

              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-card rounded-xl shadow-card border border-border z-50 py-2 animate-scale-in">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleSettingsClick();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};








// import { ReactNode, useState } from 'react';
// import { Link, useNavigate, useLocation } from 'react-router-dom';
// import { 
//   Shield, 
//   Home, 
//   ClipboardList,
//   Users,
//   BarChart3,
//   MapPin,
//   Settings, 
//   LogOut,
//   Menu,
//   X,
//   ChevronDown,
//   User,
//   Bell,
//   Building2
// } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { cn } from '@/lib/utils';
// import { authService } from '@/services/auth';
// import { SettingsModal } from '@/components/SettingsModal';

// interface OfficialDashboardLayoutProps {
//   children: ReactNode;
//   onSettingsClick?: () => void;
// }

// const navItems = [
//   { icon: Home, label: 'Overview', path: '/official/dashboard' },
//   { icon: ClipboardList, label: 'All Tickets', path: '/official/tickets' },
//   { icon: MapPin, label: 'Live Map', path: '/official/map' },
//   { icon: Users, label: 'Personnel', path: '/official/personnel' },
//   { icon: BarChart3, label: 'Analytics', path: '/official/analytics' },
//   { icon: Bell, label: 'Alerts', path: '/official/alerts' },
// ];

// export const OfficialDashboardLayout = ({ children, onSettingsClick }: OfficialDashboardLayoutProps) => {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [isProfileOpen, setIsProfileOpen] = useState(false);
//   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
//   const user = authService.getCurrentUser();
//   const userName = user?.name || user?.email || 'Official';
//   const userDept = user?.department || 'Operations';

//   const handleLogout = async () => {
//     await authService.logout();
//     navigate('/login');
//   };

//   const handleSettingsClick = () => {
//     if (onSettingsClick) {
//       onSettingsClick();
//       return;
//     }
//     setIsSettingsOpen(true);
//   };

//   return (
//     <div className="min-h-screen bg-background">
//       <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOfficial />
//       {}
//       <header className="lg:hidden fixed top-0 left-0 right-0 z-50 gradient-hero h-16 flex items-center px-4">
//         <button
//           onClick={() => setIsSidebarOpen(true)}
//           className="p-2 text-white hover:bg-white/10 rounded-lg"
//         >
//           <Menu className="h-6 w-6" />
//         </button>
        
//         <Link to="/" className="flex items-center gap-2 mx-auto text-white">
//           <div className="p-1.5 rounded-lg bg-white/10">
//             <Shield className="h-5 w-5" />
//           </div>
//           <span className="font-heading font-bold">SafeLive Admin</span>
//         </Link>

//         <button
//           onClick={() => setIsProfileOpen(!isProfileOpen)}
//           className="p-2 text-white hover:bg-white/10 rounded-lg"
//         >
//           <User className="h-5 w-5" />
//         </button>
//       </header>

//       {}
//       {isSidebarOpen && (
//         <div 
//           className="lg:hidden fixed inset-0 bg-black/50 z-50"
//           onClick={() => setIsSidebarOpen(false)}
//         />
//       )}

//       {}
//       <aside className={cn(
//         "fixed top-0 left-0 bottom-0 w-64 gradient-hero text-white z-50 transform transition-transform duration-300",
//         "lg:translate-x-0",
//         isSidebarOpen ? "translate-x-0" : "-translate-x-full"
//       )}>
//         <div className="flex flex-col h-full">
//           {}
//           <div className="p-4 flex items-center justify-between border-b border-white/10">
//             <Link to="/" className="flex items-center gap-2">
//               <div className="p-2 rounded-xl bg-white/10">
//                 <Shield className="h-6 w-6" />
//               </div>
//               <div>
//                 <span className="text-lg font-heading font-bold block">SafeLive</span>
//                 <span className="text-xs text-white/60">Admin Portal</span>
//               </div>
//             </Link>
//             <button
//               onClick={() => setIsSidebarOpen(false)}
//               className="lg:hidden p-2 hover:bg-white/10 rounded-lg"
//             >
//               <X className="h-5 w-5" />
//             </button>
//           </div>

//           {}
//           <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
//             {navItems.map((item) => {
//               const isActive = location.pathname === item.path;
//               return (
//                 <Link
//                   key={item.path}
//                   to={item.path}
//                   onClick={() => setIsSidebarOpen(false)}
//                   className={cn(
//                     "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
//                     isActive 
//                       ? "bg-white/20" 
//                       : "hover:bg-white/10"
//                   )}
//                 >
//                   <item.icon className="h-5 w-5" />
//                   <span className="font-medium">{item.label}</span>
//                   {item.badge && (
//                     <span className="ml-auto px-2 py-0.5 bg-destructive text-white text-xs font-medium rounded-full">
//                       {item.badge}
//                     </span>
//                   )}
//                 </Link>
//               );
//             })}
//             <button
//               onClick={() => {
//                 setIsSidebarOpen(false);
//                 handleSettingsClick();
//               }}
//               className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-white/10"
//             >
//               <Settings className="h-5 w-5" />
//               <span className="font-medium">Settings</span>
//             </button>
//           </nav>

//           {}
//           <div className="p-4 border-t border-white/10">
//             <div className="flex items-center gap-3 mb-4">
//               <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
//                 <Building2 className="h-5 w-5" />
//               </div>
//               <div className="flex-1 min-w-0">
//                 <div className="font-medium truncate">{userName}</div>
//                 <div className="text-xs text-white/60 truncate">{userDept}</div>
//               </div>
//             </div>
//             <Button
//               variant="ghost"
//               className="w-full justify-start text-white hover:bg-white/10"
//               onClick={handleLogout}
//             >
//               <LogOut className="h-4 w-4 mr-2" />
//               Logout
//             </Button>
//           </div>
//         </div>
//       </aside>

//       {}
//       <main className={cn(
//         "min-h-screen pt-16 lg:pt-0 lg:pl-64 transition-all duration-300"
//       )}>
//         {}
//         <header className="hidden lg:flex items-center justify-between h-16 px-6 bg-card border-b border-border">
//           <div className="flex items-center gap-4">
//             <h1 className="text-lg font-heading font-semibold text-foreground">
//               {navItems.find(item => item.path === location.pathname)?.label || 'Dashboard'}
//             </h1>
//             <span className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded-full">
//               Official Portal
//             </span>
//           </div>

//           <div className="flex items-center gap-4">
//             <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
//               <Bell className="h-5 w-5 text-muted-foreground" />
//             </button>

//             <div className="relative">
//               <button
//                 onClick={() => setIsProfileOpen(!isProfileOpen)}
//                 className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-lg transition-colors"
//               >
//                 <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
//                   <Building2 className="h-4 w-4 text-accent" />
//                 </div>
//                 <span className="font-medium text-sm">{userName}</span>
//                 <ChevronDown className={cn(
//                   "h-4 w-4 text-muted-foreground transition-transform",
//                   isProfileOpen && "rotate-180"
//                 )} />
//               </button>

//               {isProfileOpen && (
//                 <>
//                   <div 
//                     className="fixed inset-0 z-40" 
//                     onClick={() => setIsProfileOpen(false)} 
//                   />
//                   <div className="absolute right-0 mt-2 w-48 bg-card rounded-xl shadow-card border border-border z-50 py-2 animate-scale-in">
//                     <button
//                       onClick={() => {
//                         setIsProfileOpen(false);
//                         handleSettingsClick();
//                       }}
//                       className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
//                     >
//                       <Settings className="h-4 w-4" />
//                       Settings
//                     </button>
//                     <button
//                       onClick={handleLogout}
//                       className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors"
//                     >
//                       <LogOut className="h-4 w-4" />
//                       Logout
//                     </button>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//         </header>

//         <div className="p-6">
//           {children}
//         </div>
//       </main>
//     </div>
//   );
// };

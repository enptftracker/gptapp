import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Briefcase, 
  TrendingUp, 
  Star, 
  Settings,
  DollarSign,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/', icon: BarChart3, label: 'Dashboard' },
  { path: '/portfolios', icon: Briefcase, label: 'Portfolios' },
  { path: '/watchlist', icon: Star, label: 'Watchlist' },
  { path: '/settings', icon: Settings, label: 'Settings' }
];

export default function Layout() {
  const { signOut, user } = useAuth();

  const handleSignOut = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 md:h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <DollarSign className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <h1 className="text-base md:text-xl font-bold">Portfolio Tracker</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:block truncate max-w-[150px] md:max-w-none">{user?.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-9 md:w-9"
            >
              <LogOut className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 md:pt-6">
        <Outlet />
      </main>

      {/* Bottom Navigation - Mobile First */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-inset-bottom">
        <div className="container px-0">
          <div className="flex items-center justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 md:py-3 text-xs transition-colors min-w-0",
                    isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-[10px] md:text-xs truncate max-w-[60px]">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

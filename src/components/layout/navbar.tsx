"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Atom,
  Code2,
  Compass,
  Server,
  CreditCard,
  LayoutDashboard,
  Sun,
  Moon,
  Github,
  LogOut,
  User,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/studio", label: "Studio", icon: Code2 },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/backends", label: "Backends", icon: Server },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, isLoading, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-6">
          <Atom className="h-6 w-6 text-quantum" />
          <span className="font-bold text-lg hidden sm:inline-block">
            Quant<span className="text-quantum">Studio</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/TheQuantAI/quantstudio"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Github className="h-4 w-4" />
            </Button>
          </a>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {isLoading ? (
            <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            /* Logged-in state: avatar + dropdown */
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-full border border-border px-2 py-1 hover:bg-accent transition-colors"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-quantum/20 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-quantum" />
                  </div>
                )}
                <span className="text-sm font-medium hidden md:inline max-w-[120px] truncate">
                  {user.name || user.email?.split("@")[0]}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    onClick={() => { signOut(); setShowUserMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Logged-out state: Sign In + Get Started */
            <>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="quantum" size="sm">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

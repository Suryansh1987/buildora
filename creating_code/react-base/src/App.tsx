import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toaster } from 'sonner';

// Import pages
import HomePage from '@/pages/HomePage';
import CoursesPage from '@/pages/CoursesPage';
import CourseDetailsPage from '@/pages/CourseDetailsPage';
import DashboardPage from '@/pages/DashboardPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';

const Navigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">
              CourseHub
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-indigo-600 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/courses"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-indigo-600 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`
              }
            >
              Courses
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-indigo-600 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-indigo-600 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `text-sm font-medium transition-colors hover:text-indigo-600 ${
                  isActive ? 'text-indigo-600' : 'text-slate-600'
                }`
              }
            >
              Contact
            </NavLink>
            <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
              Sign In
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4">
            <nav className="flex flex-col space-y-4">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-indigo-600 ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </NavLink>
              <Separator />
              <NavLink
                to="/courses"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-indigo-600 ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Courses
              </NavLink>
              <Separator />
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-indigo-600 ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </NavLink>
              <Separator />
              <NavLink
                to="/about"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-indigo-600 ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </NavLink>
              <Separator />
              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-indigo-600 ${
                    isActive ? 'text-indigo-600' : 'text-slate-600'
                  }`
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact
              </NavLink>
              <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700 w-full">
                Sign In
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

const NotFound: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <h1 className="text-6xl font-bold text-indigo-600 mb-4">404</h1>
    <p className="text-xl text-slate-600 mb-6">Page not found</p>
    <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700">
      <Link to="/">Return Home</Link>
    </Button>
  </div>
);

function App() {
  return (
    <TooltipProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
          <Navigation />

          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:id" element={<CourseDetailsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
        <Toaster />
      </Router>
    </TooltipProvider>
  );
}

export default App;
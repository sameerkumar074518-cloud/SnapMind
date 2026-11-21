import { useEffect, useRef, useState } from "react";
import Auth from "./components/Auth";
import ResetPassword from "./components/ResetPassword";
import VerifyEmail from "./components/VerifyEmail";
import "./App.css";
import {
  LayoutGrid,
  Images,
  Folder,
  Star,
  Clock3,
  Settings,
  Search,
  Bell,
  Plus,
  Sparkles,
  ArrowUpRight,
  Menu,
  X,
  Tag,
  CalendarDays,
  Loader2,
  LogOut,
  Trash2,
} from "lucide-react";

import UploadBox from "./components/UploadBox";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://snapmind-4t5b.onrender.com";

const SEARCH_SUGGESTIONS = [
  "Find my college fee payment screenshot",
  "Show my Java programming notes",
  "Find the hotel booking I saved",
  "Show the product I wanted to purchase",
  "Find the football score screenshot",
];

function App() {
  const uploadRef = useRef(null);
  const categoriesRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  // ==============================
  // PASSWORD RESET DEEP LINK
  // ==============================

  const [resetToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken");
  });

  const clearResetToken = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", url.toString());
    window.location.reload();
  };

    const [verifyToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("verifyToken");
  });

  const clearVerifyToken = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("verifyToken");
    window.history.replaceState({}, "", url.toString());
    window.location.reload();
  };

  // ==============================
  // AUTHENTICATION
  // ==============================

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("snapmind_user");

      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Could not restore user session:", error);
      return null;
    }
  });

  const [screenshots, setScreenshots] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [apiSearchResults, setApiSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState("hybrid");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showImportant, setShowImportant] = useState(false);
  const [showRecentOnly, setShowRecentOnly] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeShot, setActiveShot] = useState(null);
  const [modalClosing, setModalClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("snapmind_token");
    localStorage.removeItem("snapmind_user");

    setUser(null);
    setScreenshots([]);
    setSearchQuery("");
    setDebouncedQuery("");
    setApiSearchResults(null);
    setIsSearching(false);
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedCategory("All");
    setShowImportant(false);
    setShowRecentOnly(false);
    setNavOpen(false);
    setActiveShot(null);
  };

  // ==============================
  // FETCH SCREENSHOTS
  // ==============================

  useEffect(() => {
    if (user) {
      fetchScreenshots();
    }
  }, [user]);

  // ==============================
  // ESCAPE KEY
  // ==============================

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (activeShot) {
          closeModal();
        }

        setNavOpen(false);
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShot]);

  // ==============================
  // CLOSE SEARCH DROPDOWN ON OUTSIDE CLICK
  // ==============================

  useEffect(() => {
    const onClickOutside = (e) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  // ==============================
  // MODAL BODY SCROLL LOCK
  // ==============================

  useEffect(() => {
    if (activeShot) {
      const prevOverflow = document.body.style.overflow;

      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [activeShot]);

  // ==============================
  // KEYBOARD SHORTCUT (⌘K / Ctrl+K)
  // ==============================

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => {
      window.removeEventListener("keydown", handleGlobalKey);
    };
  }, []);

  // ==============================
  // SEARCH DEBOUNCING & HYBRID QUERY
  // ==============================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 320);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery) {
      setApiSearchResults(null);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    const performHybridSearch = async () => {
      try {
        const token = localStorage.getItem("snapmind_token");
        const params = new URLSearchParams({
          q: debouncedQuery,
        });

        if (selectedCategory && selectedCategory !== "All") {
          params.set("category", selectedCategory);
        }

        if (showImportant) {
          params.set("important", "true");
        }

        if (dateFilter === "7d" || showRecentOnly) {
          const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          params.set("startDate", d.toISOString().split("T")[0]);
        } else if (dateFilter === "30d") {
          const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          params.set("startDate", d.toISOString().split("T")[0]);
        } else if (dateFilter === "custom") {
          if (customStartDate) params.set("startDate", customStartDate);
          if (customEndDate) params.set("endDate", customEndDate);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/screenshots/search?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (isMounted && data.success) {
          setApiSearchResults(data.screenshots || []);
          setSearchType(data.searchType || "hybrid");
        } else if (isMounted) {
          fallbackLocalSearch();
        }
      } catch (err) {
        console.warn(
          "Backend hybrid search request failed, using client fallback:",
          err
        );
        if (isMounted) {
          fallbackLocalSearch();
        }
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    };

    const fallbackLocalSearch = () => {
      const qLower = debouncedQuery.toLowerCase();
      const localMatches = screenshots.filter((s) => {
        const text = [
          s.originalName || "",
          s.extractedText || "",
          s.category || "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(qLower);
      });
      setApiSearchResults(localMatches);
      setSearchType("keyword");
    };

    performHybridSearch();

    return () => {
      isMounted = false;
    };
  }, [
    debouncedQuery,
    selectedCategory,
    dateFilter,
    customStartDate,
    customEndDate,
    showImportant,
    showRecentOnly,
    screenshots,
  ]);

  // ==============================
  // FETCH SCREENSHOTS
  // ==============================

  const fetchScreenshots = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem("snapmind_token");

      const response = await fetch(
        `${API_BASE_URL}/api/screenshots`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setScreenshots(data.screenshots);
      }
    } catch (error) {
      console.error("Could not fetch screenshots:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ==============================
  // TOGGLE IMPORTANT
  // ==============================

  const toggleImportant = async (id, currentValue) => {
    setScreenshots((prev) =>
      prev.map((s) =>
        s._id === id
          ? {
              ...s,
              important: !currentValue,
            }
          : s
      )
    );

    if (apiSearchResults) {
      setApiSearchResults((prev) =>
        prev
          ? prev.map((s) =>
              s._id === id
                ? {
                    ...s,
                    important: !currentValue,
                  }
                : s
            )
          : null
      );
    }

    try {
      const token = localStorage.getItem("snapmind_token");

      const response = await fetch(
        `${API_BASE_URL}/api/screenshots/${id}/important`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            important: !currentValue,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message || "Update failed"
        );
      }
    } catch (error) {
      console.error(
        "Could not update important state:",
        error
      );

      setScreenshots((prev) =>
        prev.map((s) =>
          s._id === id
            ? {
                ...s,
                important: currentValue,
              }
            : s
        )
      );

      if (apiSearchResults) {
        setApiSearchResults((prev) =>
          prev
            ? prev.map((s) =>
                s._id === id
                  ? {
                      ...s,
                      important: currentValue,
                    }
                  : s
              )
            : null
        );
      }
    }
  };

  // ==============================
// DELETE SCREENSHOT
// ==============================

const deleteScreenshot = async (id) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this screenshot?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const token = localStorage.getItem("snapmind_token");

    const response = await fetch(
      `${API_BASE_URL}/api/screenshots/${id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.message || "Delete failed"
      );
    }

    // Remove screenshot from the UI
    setScreenshots((prev) =>
      prev.filter((screenshot) => screenshot._id !== id)
    );

    if (apiSearchResults) {
      setApiSearchResults((prev) =>
        prev ? prev.filter((screenshot) => screenshot._id !== id) : null
      );
    }

    // Close modal if the deleted screenshot was open
    if (activeShot?._id === id) {
      setActiveShot(null);
    }

  } catch (error) {
    console.error(
      "Could not delete screenshot:",
      error
    );

    alert(
      error.message ||
        "Could not delete screenshot. Please try again."
    );
  }
};

  // ==============================
  // SCROLL HELPERS
  // ==============================

  const scrollToUpload = () => {
    setNavOpen(false);

    uploadRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const scrollToCategories = () => {
    setNavOpen(false);

    categoriesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToLibrary = () => {
    window.setTimeout(() => {
      document
        .getElementById("library")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  };

  // ==============================
  // CLOSE MODAL
  // ==============================

  const closeModal = () => {
    setModalClosing(true);

    window.setTimeout(() => {
      setActiveShot(null);
      setModalClosing(false);
    }, 160);
  };

  // ==============================
  // SEARCH & HYBRID RESULTS
  // ==============================

  const normalizedSearch =
    searchQuery.trim().toLowerCase();

  // Local keyword search fallback
  const localSearchResults = normalizedSearch
    ? screenshots.filter((screenshot) => {
        const searchableText = [
          screenshot.originalName || "",
          screenshot.extractedText || "",
          screenshot.category || "",
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
    : [];

  // Active search results: prefer API-returned hybrid AI results if available, else local fallback
  const activeSearchResults =
    apiSearchResults !== null ? apiSearchResults : localSearchResults;

  const SEARCH_DROPDOWN_LIMIT = 6;
  const visibleSearchResults = activeSearchResults.slice(
    0,
    SEARCH_DROPDOWN_LIMIT
  );

  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion);
    setIsSearchOpen(false);
    scrollToLibrary();
  };

  // ==============================
  // AVAILABLE CATEGORIES
  // ==============================

  const availableCategories = [
    "All",
    ...Array.from(
      new Set(
        screenshots.map(
          (screenshot) =>
            screenshot.category || "Other"
        )
      )
    ).sort((a, b) => {
      if (a === "All") return -1;
      if (b === "All") return 1;

      return a.localeCompare(b);
    }),
  ];

  // ==============================
  // FILTER SCREENSHOTS
  // ==============================

  const filteredScreenshots =
    screenshots.filter((screenshot) => {
      if (
        showImportant &&
        !screenshot.important
      ) {
        return false;
      }

      const created = new Date(
        screenshot.createdAt
      ).getTime();

      if (dateFilter === "7d" || showRecentOnly) {
        if (
          Date.now() - created >
          RECENT_WINDOW_MS
        ) {
          return false;
        }
      } else if (dateFilter === "30d") {
        if (
          Date.now() - created >
          30 * 24 * 60 * 60 * 1000
        ) {
          return false;
        }
      } else if (dateFilter === "custom") {
        if (customStartDate && created < new Date(customStartDate).getTime()) {
          return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (created > end.getTime()) {
            return false;
          }
        }
      }

      const screenshotCategory =
        screenshot.category || "Other";

      const matchesCategory =
        selectedCategory === "All" ||
        screenshotCategory ===
          selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      return true;
    });

  // What to render in the main screenshot library grid
  const displayedScreenshots = normalizedSearch
    ? activeSearchResults
    : filteredScreenshots;

  // ==============================
  // CATEGORY SELECT
  // ==============================

  const handleCategorySelect = (category) => {
    setShowImportant(false);
    setShowRecentOnly(false);
    setSelectedCategory(category);

    scrollToLibrary();
  };

  // ==============================
  // DASHBOARD STATS
  // ==============================

  const totalCount = screenshots.length;

  const categoryCount = new Set(
    screenshots.map(
      (s) => s.category || "Other"
    )
  ).size;

  const importantCount = screenshots.filter(
    (s) => s.important
  ).length;

  const recentCount = screenshots.filter(
    (s) => {
      const created = new Date(
        s.createdAt
      ).getTime();

      return (
        Date.now() - created <=
        RECENT_WINDOW_MS
      );
    }
  ).length;

  // ==============================
  // AUTH SCREEN
  // ==============================

// ==============================
// RESET PASSWORD SCREEN
// ==============================

if (resetToken) {
  return (
    <ResetPassword token={resetToken} onDone={clearResetToken} />
  );
}

  if (verifyToken) {
    return (
      <VerifyEmail token={verifyToken} onDone={clearVerifyToken} />
    );
  }

// ==============================
// AUTH SCREEN
// ==============================

if (!user) {
  return <Auth onLogin={handleLogin} />;
}
  // ==============================
  // DASHBOARD
  // ==============================

  return (
    <div className="app">

      {/* Mobile backdrop */}
      {navOpen && (
        <div
          className="nav-backdrop"
          onClick={() =>
            setNavOpen(false)
          }
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${
          navOpen
            ? "sidebar-open"
            : ""
        }`}
      >

        <div className="brand-row">

          <div className="brand">

            <div className="brand-mark">
              <Sparkles size={16} />
            </div>

            <span>SnapMind</span>

          </div>

          <button
            className="nav-close"
            onClick={() =>
              setNavOpen(false)
            }
            aria-label="Close menu"
          >
            <X size={18} />
          </button>

        </div>

        <nav className="sidebar-nav">

          {/* Dashboard */}
          <a
            className="sidebar-link active"
            href="#home"
            onClick={() => {
              setShowImportant(false);
              setShowRecentOnly(false);
            }}
          >
            <LayoutGrid size={17} />
            Dashboard
          </a>

          {/* Screenshots */}
          <a
            className="sidebar-link"
            href="#library"
            onClick={() => {
              setShowImportant(false);
              setShowRecentOnly(false);
            }}
          >
            <Images size={17} />
            Screenshots
          </a>

          {/* Categories */}
          <button
            className="sidebar-link sidebar-link-button"
            onClick={() => {
              setShowImportant(false);
              scrollToCategories();
            }}
          >
            <Folder size={17} />
            Categories
          </button>

          {/* Important */}
          <button
            className={`sidebar-link sidebar-link-button ${
              showImportant
                ? "active"
                : ""
            }`}
            onClick={() => {
              setShowImportant(true);
              setShowRecentOnly(false);
              setSelectedCategory("All");
              setSearchQuery("");
              setNavOpen(false);

              scrollToLibrary();
            }}
          >
            <Star size={17} />
            Important
          </button>

          {/* Recent */}
          <button
            className={`sidebar-link sidebar-link-button ${
              showRecentOnly
                ? "active"
                : ""
            }`}
            onClick={() => {
              setShowRecentOnly(true);
              setShowImportant(false);
              setSelectedCategory("All");
              setSearchQuery("");
              setNavOpen(false);

              scrollToLibrary();
            }}
          >
            <Clock3 size={17} />
            Recent
          </button>

        </nav>

        <div className="sidebar-bottom">

          <a
            className="sidebar-link"
            href="#settings"
          >
            <Settings size={17} />
            Settings
          </a>

          {/* Logged-in user */}
          <div className="user-mini">

            <div className="user-avatar">
              {user.name
                ? user.name
                    .charAt(0)
                    .toUpperCase()
                : "S"}
            </div>

            <div>
              <strong>
                {user.name || "User"}
              </strong>

              <span>
                Personal workspace
              </span>
            </div>

          </div>

          {/* Logout */}
          <button
            className="sidebar-link sidebar-link-button"
            onClick={handleLogout}
          >
            <LogOut size={17} />
            Log out
          </button>

        </div>

      </aside>

      {/* Main */}
      <main
        className="main-content"
        id="home"
      >

        {/* Topbar */}
        <header className="topbar">

          <button
            className="nav-toggle"
            onClick={() =>
              setNavOpen(true)
            }
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div
            className="search-wrapper"
            ref={searchWrapperRef}
          >

            <div className="search-box">

              <Search size={17} />

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ask SnapMind anything about your saved screenshots..."
                value={searchQuery}
                onFocus={() =>
                  setIsSearchOpen(true)
                }
                onChange={(e) => {
                  setSearchQuery(
                    e.target.value
                  );
                  setIsSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsSearchOpen(false);
                    scrollToLibrary();
                  }
                }}
              />

              {isSearching ? (
                <Loader2 size={15} className="search-spinner" />
              ) : searchQuery ? (
                <button
                  className="search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    setApiSearchResults(null);
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : (
                <span className="search-shortcut">
                  ⌘K
                </span>
              )}

            </div>

            {/* Quick search suggestions dropdown when input is focused but empty */}
            {isSearchOpen && !normalizedSearch && (
              <div className="search-dropdown search-suggestions-dropdown">
                <div className="search-suggestions-header">
                  <Sparkles size={13} className="sparkles-icon" />
                  <span>Ask anything in natural language</span>
                </div>
                <div className="search-suggestions-list">
                  {SEARCH_SUGGESTIONS.map((suggestion, idx) => (
                    <button
                      key={idx}
                      className="search-suggestion-item"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <Search size={13} className="suggestion-icon" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick search results dropdown under the search bar */}
            {isSearchOpen && normalizedSearch && (

              <div className="search-dropdown">

                <div className="search-dropdown-header">
                  <span className="search-mode-badge">
                    <Sparkles size={12} />
                    {isSearching
                      ? "Searching with AI..."
                      : searchType === "hybrid"
                      ? "Hybrid AI Search"
                      : searchType === "semantic"
                      ? "Semantic Search"
                      : "Keyword Search"}
                  </span>
                  {!isSearching && (
                    <span className="search-count-badge">
                      {activeSearchResults.length}{" "}
                      {activeSearchResults.length === 1 ? "result" : "results"}
                    </span>
                  )}
                </div>

                {isSearching && activeSearchResults.length === 0 ? (

                  <div className="search-dropdown-loading">
                    <Loader2 size={18} className="search-spinner" />
                    <span>Analyzing screenshot text and semantic meaning…</span>
                  </div>

                ) : activeSearchResults.length === 0 ? (

                  <div className="search-dropdown-empty">
                    Nothing matched "{searchQuery}".
                  </div>

                ) : (

                  <>

                    {visibleSearchResults.map(
                      (screenshot) => (

                        <button
                          key={screenshot._id}
                          className="search-result-item"
                          onClick={() => {
                            setActiveShot(screenshot);
                            setIsSearchOpen(false);
                          }}
                        >

                          <img
                            src={screenshot.imageUrl}
                            alt={screenshot.originalName}
                            loading="lazy"
                          />

                          <div className="search-result-info">

                            <span className="search-result-name">
                              {screenshot.originalName}
                            </span>

                            <div className="search-result-tags">
                              <span className="search-result-category">
                                {screenshot.category ||
                                  "Other"}
                              </span>
                              {screenshot._searchMetadata?.matchReasons?.includes(
                                "semantic"
                              ) && (
                                <span className="search-match-tag">
                                  <Sparkles size={10} />
                                  AI Match
                                </span>
                              )}
                            </div>

                          </div>

                        </button>

                      )
                    )}

                    {activeSearchResults.length >
                      SEARCH_DROPDOWN_LIMIT && (

                      <button
                        className="search-dropdown-viewall"
                        onClick={() => {
                          setIsSearchOpen(false);
                          scrollToLibrary();
                        }}
                      >
                        See all {activeSearchResults.length}{" "}
                        results
                      </button>

                    )}

                  </>

                )}

              </div>

            )}

          </div>

          <div className="topbar-actions">

            <button
              className="icon-button"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>

            <button
              className="upload-top-btn"
              onClick={scrollToUpload}
            >
              <Plus size={17} />
              <span>Upload</span>
            </button>

          </div>

        </header>

        {/* Dashboard */}
        <section className="dashboard">

          {/* Hero */}
          <div className="hero">

            <div className="hero-grid" />
            <div className="hero-glow" />

            <div className="hero-content">

              <div className="ai-badge">
                <Sparkles size={14} />
                AI-powered memory
              </div>

              <h1>
                Everything you save,
                <br />
                <span>
                  right when you need it.
                </span>
              </h1>

              <p className="hero-text">
                SnapMind reads every screenshot you take
                and turns it into something you can
                search, sort and actually find again.
              </p>

              <button
                className="hero-cta"
                onClick={scrollToUpload}
              >
                <Plus size={16} />
                Add a screenshot
              </button>

            </div>

            <div
              className="hero-orb"
              aria-hidden="true"
            >
              <div className="orb-core" />
              <div className="orb-ring" />
              <div className="orb-ring orb-ring-2" />
            </div>

          </div>

          {/* Quick Stats */}
          <div className="stats-grid">

            <div className="stat-card">

              <div className="stat-icon">
                <Images size={18} />
              </div>

              <div>

                <span>
                  Total screenshots
                </span>

                <strong>
                  {isLoading
                    ? "—"
                    : totalCount}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                <Folder size={18} />
              </div>

              <div>

                <span>Categories</span>

                <strong>
                  {isLoading
                    ? "—"
                    : categoryCount}
                </strong>

              </div>

            </div>

            <div className="stat-card">

              <div className="stat-icon">
                <Star size={18} />
              </div>

              <div>

                <span>Important</span>

                <strong>
                  {isLoading
                    ? "—"
                    : importantCount}
                </strong>

              </div>

            </div>

            <div
              className="stat-card stat-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowRecentOnly(true);
                setShowImportant(false);
                setSelectedCategory("All");
                setSearchQuery("");

                scrollToLibrary();
              }}
            >

              <div className="stat-icon">
                <Clock3 size={18} />
              </div>

              <div>

                <span>
                  Recently added
                </span>

                <strong>
                  {isLoading
                    ? "—"
                    : recentCount}
                </strong>

              </div>

            </div>

          </div>

          {/* Upload */}
          <section
            className="upload-section"
            ref={uploadRef}
          >

            <div className="upload-header">

              <h2>
                Add to your memory
              </h2>

              <p>
                Drop in a screenshot and SnapMind
                takes it from there.
              </p>

            </div>

            <UploadBox
              onUploadComplete={
                fetchScreenshots
              }
            />

          </section>

          {/* Library */}
          <section
            className="library-preview"
            id="library"
          >

            {/* Category Filters */}
            <div
              className="category-filter-section"
              ref={categoriesRef}
              id="categories"
            >

              <div className="category-filter-header">

                <div>

                  <h2>Categories</h2>

                  <p>
                    Browse your screenshots by category.
                  </p>

                </div>

              </div>

              <div className="category-filter-list">

                {availableCategories.map(
                  (category) => (
                    <button
                      key={category}
                      className={`category-filter-btn ${
                        selectedCategory ===
                        category
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        handleCategorySelect(
                          category
                        )
                      }
                    >
                      <Folder size={14} />
                      {category}
                    </button>
                  )
                )}

              </div>

            </div>

            {/* Date Filters */}
            <div className="date-filter-section">
              <div className="date-filter-label">
                <CalendarDays size={14} />
                <span>Filter by date:</span>
              </div>
              <div className="date-filter-list">
                {[
                  { id: "all", label: "All Time" },
                  { id: "7d", label: "Last 7 Days" },
                  { id: "30d", label: "Last 30 Days" },
                  { id: "custom", label: "Custom Range" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`date-filter-btn ${
                      dateFilter === item.id ? "active" : ""
                    }`}
                    onClick={() => {
                      setDateFilter(item.id);
                      if (item.id === "7d") {
                        setShowRecentOnly(true);
                      } else {
                        setShowRecentOnly(false);
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <div className="custom-date-inputs">
                  <div className="date-input-group">
                    <label>From:</label>
                    <input
                      type="date"
                      className="custom-date-field"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="date-input-group">
                    <label>To:</label>
                    <input
                      type="date"
                      className="custom-date-field"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                  {(customStartDate || customEndDate) && (
                    <button
                      className="clear-date-btn"
                      onClick={() => {
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      title="Clear custom dates"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Library title */}
            <div className="section-title">

              <div>

                <h2>
                  {showImportant
                    ? "Important screenshots"
                    : showRecentOnly || dateFilter === "7d"
                    ? "Recent screenshots"
                    : dateFilter === "30d"
                    ? "Screenshots from last 30 days"
                    : dateFilter === "custom"
                    ? "Screenshots in custom date range"
                    : normalizedSearch
                    ? (
                        <>
                          Search results
                          <span className="search-type-badge">
                            <Sparkles size={12} />
                            {searchType === "hybrid"
                              ? "Hybrid AI Search"
                              : searchType === "semantic"
                              ? "Semantic Search"
                              : "Keyword Search"}
                          </span>
                        </>
                      )
                    : selectedCategory !==
                      "All"
                    ? `${selectedCategory} screenshots`
                    : "Recent screenshots"}
                </h2>

                <p>
                  {showImportant
                    ? `${displayedScreenshots.length} important screenshot${
                        displayedScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      }`
                    : showRecentOnly || dateFilter === "7d"
                    ? `${displayedScreenshots.length} screenshot${
                        displayedScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      } from the last 7 days`
                    : normalizedSearch
                    ? `${displayedScreenshots.length} screenshot${
                        displayedScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      } found for "${searchQuery}"`
                    : selectedCategory !==
                      "All"
                    ? `${displayedScreenshots.length} screenshot${
                        displayedScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      } in ${selectedCategory}`
                    : "The last things you saved, ready to open."}
                </p>

              </div>

              {(normalizedSearch ||
                selectedCategory !==
                  "All" ||
                dateFilter !== "all" ||
                showImportant ||
                showRecentOnly) && (

                <button
                  className="view-all-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setApiSearchResults(null);
                    setSelectedCategory("All");
                    setDateFilter("all");
                    setCustomStartDate("");
                    setCustomEndDate("");
                    setShowImportant(false);
                    setShowRecentOnly(false);
                  }}
                >
                  Show all
                  <X size={15} />
                </button>

              )}

              {!normalizedSearch &&
                selectedCategory ===
                  "All" &&
                dateFilter === "all" &&
                !showImportant &&
                !showRecentOnly && (

                  <button
                    className="view-all-btn"
                  >
                    View all
                    <ArrowUpRight size={15} />
                  </button>

                )}

            </div>

            {isLoading ? (

              <div className="library-loading">

                <Loader2
                  size={22}
                  className="loading-spinner"
                />

                <span>
                  Loading your screenshots…
                </span>

              </div>

            ) : displayedScreenshots.length ===
              0 ? (

              <div className="empty-library">

                <div className="empty-icon">
                  {normalizedSearch ? <Sparkles size={26} /> : <Search size={26} />}
                </div>

                <h3>
                  {showImportant
                    ? "No important screenshots"
                    : showRecentOnly || dateFilter === "7d"
                    ? "No recent screenshots"
                    : dateFilter !== "all"
                    ? "No screenshots found in this date range"
                    : normalizedSearch
                    ? "No screenshots found"
                    : selectedCategory !==
                      "All"
                    ? `No ${selectedCategory} screenshots`
                    : "Your memory is empty"}
                </h3>

                <p>
                  {showImportant
                    ? "You haven't marked any screenshots as important yet."
                    : showRecentOnly || dateFilter === "7d"
                    ? "You don't have any screenshots from the last 7 days."
                    : normalizedSearch
                    ? `SnapMind searched titles, text, and semantic meaning for "${searchQuery}", but found no matches.`
                    : selectedCategory !==
                      "All"
                    ? `You don't have any screenshots in the ${selectedCategory} category yet.`
                    : "Upload your first screenshot and SnapMind will start building your personal library."}
                </p>

                {normalizedSearch && (
                  <div className="empty-suggestions-container">
                    <span className="suggestions-prompt">Try asking with natural language:</span>
                    <div className="empty-suggestion-chips">
                      {SEARCH_SUGGESTIONS.slice(0, 3).map((s, idx) => (
                        <button
                          key={idx}
                          className="empty-suggestion-chip"
                          onClick={() => {
                            setSearchQuery(s);
                            scrollToLibrary();
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {showImportant ||
                showRecentOnly ||
                dateFilter !== "all" ||
                normalizedSearch ||
                selectedCategory !==
                  "All" ? (

                  <button
                    className="empty-upload-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setApiSearchResults(null);
                      setSelectedCategory("All");
                      setDateFilter("all");
                      setCustomStartDate("");
                      setCustomEndDate("");
                      setShowImportant(false);
                      setShowRecentOnly(false);
                    }}
                  >
                    <X size={16} />
                    Clear filters
                  </button>

                ) : (

                  <button
                    className="empty-upload-btn"
                    onClick={scrollToUpload}
                  >
                    <Plus size={16} />
                    Upload your first screenshot
                  </button>

                )}

              </div>

            ) : (

              <div className="screenshot-grid">

                {displayedScreenshots.map(
                  (screenshot) => (

                    <div
                      className="screenshot-card"
                      key={screenshot._id}
                      onClick={() =>
                        setActiveShot(
                          screenshot
                        )
                      }
                    >

                      <div className="screenshot-image-wrapper">

                        <img
                          src={screenshot.imageUrl}
                          alt={screenshot.originalName}
                          loading="lazy"
                        />

                        <button
                          className={`screenshot-important-btn ${
                            screenshot.important
                              ? "is-important"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();

                            toggleImportant(
                              screenshot._id,
                              screenshot.important
                            );
                          }}
                          aria-label={
                            screenshot.important
                              ? "Remove from important"
                              : "Mark as important"
                          }
                        >

                          <Star
                            size={14}
                            fill={
                              screenshot.important
                                ? "currentColor"
                                : "none"
                            }
                          />

                        </button>

                        <button
  className="screenshot-delete-btn"
  onClick={(e) => {
    e.stopPropagation();
    deleteScreenshot(screenshot._id);
  }}
  aria-label="Delete screenshot"
>
  <Trash2 size={14} />
</button>

                        <div className="screenshot-image-overlay">

                          <span>
                            Open screenshot
                          </span>

                        </div>

                      </div>

                      <div className="screenshot-card-info">

                        <div className="screenshot-card-heading">

                          <h3
                            title={
                              screenshot.originalName
                            }
                          >
                            {screenshot.originalName}
                          </h3>

                          <div className="screenshot-card-badges">
                            <span className="screenshot-category">
                              {screenshot.category ||
                                "Other"}
                            </span>
                            {screenshot._searchMetadata?.matchReasons?.includes(
                              "semantic"
                            ) && (
                              <span
                                className="card-ai-badge"
                                title="Matched using AI semantic understanding"
                              >
                                <Sparkles size={10} />
                                AI
                              </span>
                            )}
                          </div>

                        </div>

                        <div className="screenshot-card-footer">

                          <span>
                            {new Date(
                              screenshot.createdAt
                            ).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>

                          <span className="screenshot-open">
                            Open →
                          </span>

                        </div>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </section>

          {/* How It Works */}
          <section className="how-section">

            <div className="section-title">

              <div>

                <h2>
                  From screenshot to memory
                </h2>

                <p>
                  Three steps, no extra effort on your side.
                </p>

              </div>

            </div>

            <div className="steps-grid">

              <div className="step-card">

                <span className="step-index">
                  01
                </span>

                <h3>Capture</h3>

                <p>
                  Save screenshots of anything important
                  from your everyday life.
                </p>

              </div>

              <div className="step-card">

                <span className="step-index">
                  02
                </span>

                <h3>Understand</h3>

                <p>
                  SnapMind reads the screenshot and
                  extracts useful information.
                </p>

              </div>

              <div className="step-card">

                <span className="step-index">
                  03
                </span>

                <h3>Remember</h3>

                <p>
                  Search your personal memory whenever
                  you need something.
                </p>

              </div>

            </div>

          </section>

        </section>

      </main>

      {/* Screenshot detail modal */}
      {activeShot && (

        <div
          className={`modal-backdrop ${
            modalClosing
              ? "modal-backdrop-closing"
              : ""
          }`}
          onClick={closeModal}
        >

          <div
            className={`modal-card ${
              modalClosing
                ? "modal-card-closing"
                : ""
            }`}
            onClick={(e) =>
              e.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              activeShot.originalName
            }
          >

            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="modal-image-wrapper">

              <img
                src={activeShot.imageUrl}
                alt={activeShot.originalName}
              />

            </div>

            <div className="modal-body">

              <h3>
                {activeShot.originalName}
              </h3>

              <div className="modal-meta">

                <span className="modal-meta-item">

                  <Tag size={13} />

                  {activeShot.category ||
                    "Other"}

                </span>

                <span className="modal-meta-item">

                  <CalendarDays size={13} />

                  {new Date(
                    activeShot.createdAt
                  ).toLocaleDateString(
                    "en-IN",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}

                </span>

                {activeShot.important && (

                  <span className="modal-meta-item modal-meta-important">

                    <Star
                      size={13}
                      fill="currentColor"
                    />

                    Important

                  </span>

                )}

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;
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

function App() {
  const uploadRef = useRef(null);
  const categoriesRef = useRef(null);

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
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showImportant, setShowImportant] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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
    setSelectedCategory("All");
    setShowImportant(false);
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
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShot]);

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
  // FETCH SCREENSHOTS
  // ==============================

  const fetchScreenshots = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem("snapmind_token");

      const response = await fetch(
        "https://snapmind-4t5b.onrender.com/api/screenshots",
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

    try {
      const token = localStorage.getItem("snapmind_token");

      const response = await fetch(
        `https://snapmind-4t5b.onrender.com/api/screenshots/${id}/important`,
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
      `https://snapmind-4t5b.onrender.com/api/screenshots/${id}`,
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
  // SEARCH
  // ==============================

  const normalizedSearch =
    searchQuery.trim().toLowerCase();

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

      const screenshotCategory =
        screenshot.category || "Other";

      const matchesCategory =
        selectedCategory === "All" ||
        screenshotCategory ===
          selectedCategory;

      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        screenshot.originalName || "",
        screenshot.extractedText || "",
        screenshot.category || "",
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        normalizedSearch
      );
    });

  // ==============================
  // CATEGORY SELECT
  // ==============================

  const handleCategorySelect = (category) => {
    setShowImportant(false);
    setSelectedCategory(category);

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

  if (resetToken) {
  return (
    <ResetPassword
      token={resetToken}
      onComplete={clearResetToken}
    />
  );
}

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
            onClick={() =>
              setShowImportant(false)
            }
          >
            <LayoutGrid size={17} />
            Dashboard
          </a>

          {/* Screenshots */}
          <a
            className="sidebar-link"
            href="#library"
            onClick={() =>
              setShowImportant(false)
            }
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
              setSelectedCategory("All");
              setSearchQuery("");
              setNavOpen(false);

              window.setTimeout(() => {
                document
                  .getElementById("library")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
              }, 50);
            }}
          >
            <Star size={17} />
            Important
          </button>

          {/* Recent */}
          <a
            className="sidebar-link"
            href="#recent"
          >
            <Clock3 size={17} />
            Recent
          </a>

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

          <div className="search-box">

            <Search size={17} />

            <input
              type="text"
              placeholder="Search your screenshots..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(
                  e.target.value
                )
              }
            />

            {searchQuery && (
              <button
                className="search-clear"
                onClick={() =>
                  setSearchQuery("")
                }
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}

            {!searchQuery && (
              <span className="search-shortcut">
                ⌘K
              </span>
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

            <div className="stat-card">

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

            {/* Library title */}
            <div className="section-title">

              <div>

                <h2>
                  {showImportant
                    ? "Important screenshots"
                    : normalizedSearch
                    ? "Search results"
                    : selectedCategory !==
                      "All"
                    ? `${selectedCategory} screenshots`
                    : "Recent screenshots"}
                </h2>

                <p>
                  {showImportant
                    ? `${filteredScreenshots.length} important screenshot${
                        filteredScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      }`
                    : normalizedSearch
                    ? `${filteredScreenshots.length} screenshot${
                        filteredScreenshots.length ===
                        1
                          ? ""
                          : "s"
                      } found for "${searchQuery}"`
                    : selectedCategory !==
                      "All"
                    ? `${filteredScreenshots.length} screenshot${
                        filteredScreenshots.length ===
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
                showImportant) && (

                <button
                  className="view-all-btn"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                    setShowImportant(false);
                  }}
                >
                  Show all
                  <X size={15} />
                </button>

              )}

              {!normalizedSearch &&
                selectedCategory ===
                  "All" &&
                !showImportant && (

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

            ) : filteredScreenshots.length ===
              0 ? (

              <div className="empty-library">

                <div className="empty-icon">
                  <Search size={26} />
                </div>

                <h3>
                  {showImportant
                    ? "No important screenshots"
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
                    : normalizedSearch
                    ? `Nothing matched "${searchQuery}". Try another keyword or category.`
                    : selectedCategory !==
                      "All"
                    ? `You don't have any screenshots in the ${selectedCategory} category yet.`
                    : "Upload your first screenshot and SnapMind will start building your personal library."}
                </p>

                {showImportant ||
                normalizedSearch ||
                selectedCategory !==
                  "All" ? (

                  <button
                    className="empty-upload-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                      setShowImportant(false);
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

                {filteredScreenshots.map(
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

                          <span className="screenshot-category">
                            {screenshot.category ||
                              "Other"}
                          </span>

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
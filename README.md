# 🧠 SnapMind — Your Digital Memory

<p align="center">
  <strong>Never lose an important screenshot again.</strong>
</p>

<p align="center">
  An AI-powered screenshot memory application that transforms scattered screenshots into an organized, searchable digital library.
</p>

<p align="center">
  <a href="https://snap-mind.vercel.app/">Live Demo</a> •
  <a href="https://github.com/sameerkumar074518-cloud/SnapMind">GitHub Repository</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express" />
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20Groq-8E75B2" />
  <img src="https://img.shields.io/badge/Cloudinary-Image%20Storage-3448C5?logo=cloudinary" />
  <img src="https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel" />
</p>

---

## ✨ Overview

We take screenshots of everything: important messages, study notes, coding solutions, shopping details, payment receipts, travel information and much more.

But finding those screenshots later can become frustrating.

**SnapMind solves this problem.**

SnapMind is a full-stack AI-powered screenshot management application that converts ordinary screenshots into organized, searchable digital memories.

Simply upload a screenshot. SnapMind automatically extracts its text, understands its content using AI, assigns a relevant category and saves everything in your personal screenshot library.

Think of it as your personal digital memory — a place where important information stays organized and easy to find.

## 🚀 Live Application

**Try SnapMind:** https://snap-mind.vercel.app/

## 🎯 Key Features

### 📸 Smart Screenshot Upload
- Upload screenshots directly from your device.
- Supports image uploads up to 10 MB.
- Secure image storage using Cloudinary.
- Automatically processes screenshots after upload.

### 🔍 Optical Character Recognition (OCR)
- Uses Tesseract.js to extract text from images.
- Makes screenshot content searchable and accessible.
- Processes text automatically during upload.

### 🤖 AI-Powered Categorization
- Uses Google Gemini for multimodal screenshot classification.
- Understands both visual content and extracted text.
- Uses Groq as a secondary AI provider when Gemini is unavailable.
- Includes an OCR-based fallback mechanism.
- Automatically assigns one of 13 categories:
  - Study
  - Work
  - Shopping
  - Social
  - Entertainment
  - Finance
  - News
  - Travel
  - Sports
  - Personal
  - Security
  - Technology
  - Other

### 🧠 Smart Information Extraction

SnapMind extracts useful information from recognized screenshot text, including:

- Title
- Date
- Amount
- Email address
- Phone number
- Order or transaction ID
- Location
- Category

### 🗂️ Personal Screenshot Library
- View all uploaded screenshots in one place.
- Browse screenshots by category.
- Search your saved collection.
- Open individual screenshots.
- Manage important screenshots.
- Access recently uploaded screenshots from the last seven days.

### 🔐 Authentication & Security
- User registration and login.
- Password hashing using bcrypt.
- JWT-based authentication.
- Email verification.
- Forgot password functionality.
- Secure, time-limited password reset links.
- User-specific screenshot access.

### ⭐ Screenshot Management
- Mark screenshots as important.
- Remove screenshots you no longer need.
- Automatically delete associated Cloudinary images when deleting screenshots.
- Keep your screenshot library organized.

### 🎨 Modern User Interface
- Premium dark-themed dashboard.
- Responsive application layout.
- Custom CSS styling.
- Lucide React icons.
- Interactive screenshot management interface.

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite |
| Styling | CSS3 |
| Icons | Lucide React |
| Backend | Node.js |
| Backend Framework | Express.js 5 |
| Database | MongoDB |
| ODM | Mongoose |
| Image Storage | Cloudinary |
| OCR | Tesseract.js |
| Primary AI | Google Gemini API |
| Secondary AI | Groq Vision API |
| Authentication | JWT |
| Password Security | bcryptjs |
| File Upload | Multer |
| Email Service | Brevo API |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |

---

## 🏗️ System Architecture

SnapMind follows a full-stack client-server architecture.

### Application Flow

```text
                  USER
                    |
                    v
           React Frontend (Vite)
                    |
                    v
             Express Backend
                    |
             Authentication
                    |
                    v
             Image Upload
                    |
                    v
                Cloudinary
                    |
              Secure Image URL
                    |
                    v
              Tesseract.js
               (OCR Engine)
                    |
             Extracted Text
                    |
                    v
             AI Classification
                    |
             +------+------+
             |             |
             v             v
           Gemini         Groq
          (Primary)     (Fallback)
             |             |
             +------+------+
                    |
                    v
          Information Extraction
                    |
                    v
               MongoDB
                    |
                    v
            React Dashboard
                    |
                    v
           Organized Screenshot
                 Library
```

### How It Works

1. The user uploads a screenshot through the React frontend.
2. Express receives the image and validates the upload.
3. Cloudinary stores the original screenshot and returns its secure URL.
4. Tesseract.js extracts text from the uploaded image.
5. Gemini analyses the image and OCR text to determine its category.
6. If Gemini fails, Groq is used as a fallback. An OCR-based classification fallback is also available.
7. The backend extracts additional information, such as dates, amounts, emails and order IDs.
8. MongoDB stores the screenshot metadata, extracted text, category and AI-generated structured information.
9. The frontend retrieves the saved screenshots and displays them in the user's personal library.

---

## 📂 Project Structure

```text
SnapMind/
│
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── models/
│   │   ├── Screenshot.js
│   │   └── User.js
│   │
│   ├── utils/
│   │   ├── ocr.js
│   │   ├── categorize.js
│   │   ├── intelligence.js
│   │   └── email.js
│   │
│   ├── server.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## ⚙️ Getting Started

Follow these instructions to run SnapMind locally.

### Prerequisites

Make sure you have installed:

- Node.js 18 or higher
- npm
- MongoDB Atlas account or MongoDB instance
- Cloudinary account
- Google Gemini API key
- Groq API key (optional, for AI fallback)
- Brevo account (for email functionality)

### 1. Clone the Repository

```bash
git clone https://github.com/sameerkumar074518-cloud/SnapMind.git
```

```bash
cd SnapMind
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the backend directory.

Configure the following environment variables:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

GEMINI_API_KEY=your_gemini_api_key

GROQ_API_KEY=your_groq_api_key

FRONTEND_URL=http://localhost:5173

BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=your_verified_sender_email
```

**Important:** Keep your API keys and credentials private. Never upload your `.env` file to GitHub.

Start the backend:

```bash
npm run dev
```

Backend runs at:

```text
http://localhost:5000
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

**Note:** The current frontend uses the deployed Render backend URL in its API requests. For local full-stack development, update those API URLs to `http://localhost:5000` before testing locally.

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset account password |

### Screenshot Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload` | Upload and process screenshot |
| GET | `/api/screenshots` | Retrieve user's screenshots |
| PATCH | `/api/screenshots/:id/important` | Update important status |
| DELETE | `/api/screenshots/:id` | Delete screenshot |

Protected screenshot endpoints require a valid JWT access token.

---

## ☁️ Deployment

SnapMind uses cloud-based deployment and storage services.

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | MongoDB Atlas |
| Image Storage | Cloudinary |
| AI Processing | Gemini / Groq APIs |
| Email Delivery | Brevo |

**Live Links**

- Application: https://snap-mind.vercel.app/
- Backend: https://snapmind-4t5b.onrender.com/
- Repository: https://github.com/sameerkumar074518-cloud/SnapMind

---

## 🔮 Future Improvements

Some potential improvements for future versions:

- Advanced natural-language search.
- Better screenshot intelligence and contextual retrieval.
- Duplicate screenshot detection.
- Bulk screenshot uploads.
- Export screenshot information as PDF.
- Custom tags and user-defined categories.
- More advanced filtering and sorting.
- Improved mobile experience.
- AI-powered conversations with saved screenshots.

---

## 👨‍💻 Developer

**Sameer Kumar**

Developer of SnapMind — an independent full-stack project built to solve a real-world problem: managing and retrieving important screenshots efficiently.

- GitHub: [@sameerkumar074518-cloud](https://github.com/sameerkumar074518-cloud)
- Project: [SnapMind](https://github.com/sameerkumar074518-cloud/SnapMind)
- Live Demo: [snap-mind.vercel.app](https://snap-mind.vercel.app/)

---

<p align="center">
  <strong>SnapMind — Your screenshots. Your memories. One intelligent library. 🧠</strong>
</p>

<p align="center">
  If you find this project interesting, consider giving the repository a ⭐
</p>

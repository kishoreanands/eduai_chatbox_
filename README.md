<<<<<<< HEAD
# EduAI – Smart Learning Assistant
link:(https://eduai-chatbox.vercel.app/dashboard.html)

EduAI is a premium, modern, responsive full-stack AI-powered educational web application with a clean, high-fidelity user interface inspired by ChatGPT, Google Gemini, and Notion.

## Features

- 💬 **ChatGPT-Inspired Chat**: markdown formatting, syntax highlighting, bookmarks, share links, chat history search, PDF summarizing, and image OCR text extracts.
- 🎙️ **Voice Assistant (Hands-Free)**: speech-to-text input, text-to-speech outputs, and playback speeds controls.
- 🧠 **Quiz Center & Adaptive Difficulty**: AI difficulty progression triggers (increases on success, Foundations review on failure) with score graphics.
- 💻 **Coding Practice Editor**: supporting Java, Python, JavaScript, and C++ compilers with AI debugging reviews.
- 📄 **Doc & PPT Generators**: topic parameters compile directly into structured outline previews and file downloads.
- 📝 **Syllabus & Planner**: revision scheduler tables and streak/XP gamification leaderboards.
- 📂 **Storage File Manager**: favorites, filters, and uploads vault.

---

## Tech Stack

### Frontend
- **HTML5 & CSS3**: Custom styles containing layout variables, glassmorphic panel tokens, animations, and keyframes.
- **Tailwind CSS via CDN**: Responsive grid utilities.
- **JavaScript (Modular)**: State machine, speech events, files download triggers.
- **Chart.js**: Study hours progressions and difficulty distributions.
- **Lucide Icons**: Premium modern typography indicators.

### Backend REST API
- **Spring Boot 3 (Java 17)** REST API.
- **Spring Security & JWT**: Encryption keys verification filters.
- **Hibernate / Spring Data JPA**: Object-Relational Database schema mapping.
- **H2 In-Memory Database** (Default dev run) & **MySQL** (Production configuration profiles).
- **PowerShell bootstrap runner** (`build.ps1`) for compile tasks.

---

## Project Structure

```text
├── index.html         # Landing page (modals, testimonials, Quick Playground)
├── dashboard.html     # Interactive student workspace (13 modular cards)
├── styles.css         # Styling system (glassmorphism tokens, themes, animations)
├── app.js             # State controllers, charts, voice assistants, and API calls
└── backend/
    ├── pom.xml        # Maven configurations
    ├── build.ps1      # PowerShell Maven bootstrap compile runner
    └── src/
        └── main/
            ├── java/com/eduai/
            │   ├── EduAiApplication.java    # Spring Boot Main Application
            │   ├── config/                  # SecurityConfig, JwtFilter, JwtProvider
            │   ├── model/                   # JPA Entity classes
            │   ├── repository/              # JPA Repository interfaces
            │   ├── service/                 # AIService, UserService
            │   └── controller/              # Auth, Chat, Note, Quiz RestControllers
            └── resources/
                └── application.yml          # Configurations (Port, DB profiles)
```

---

## Getting Started

### 1. Run the Frontend (Standalone / Client-Only)
Double-click or open [index.html](file:///c:/Users/kisho/OneDrive/Documents/Desktop/ai%20project/index.html) in any modern browser. 
> [!NOTE]
> The frontend runs in **Standalone Mock Mode** automatically when the backend server is offline, meaning all features (AI chat streams, adaptive quizzes, compilers, planner calendar compilers, file uploads, and strengths analysis) are fully interactive and saved to browser `localStorage` out-of-the-box!

### 2. Run the Full-Stack Backend Server
Open PowerShell in the `backend/` directory and build the project using the bootstrap script:

```powershell
# 1. Compile the Java REST API classes
.\build.ps1 clean compile

# 2. Start the Spring Boot REST API server
.\build.ps1 spring-boot:run
```

The REST API server will run on [http://localhost:8080](http://localhost:8080).
- **H2 Web Console**: Access [http://localhost:8080/h2-console](http://localhost:8080/h2-console) (JDBC URL: `jdbc:h2:mem:eduai_db`, Username: `sa`, Password: `password`) to query active database tables.
- **OpenAI Key**: To activate the actual ChatGPT API responses in the backend, set the environment variable:
  ```powershell
  $env:OPENAI_API_KEY="your_api_key_here"
  ```
  If not set, the backend will automatically fallback to the rule-based mock AI service.
=======
# EDUAI_CHATBOX
>>>>>>> 3b3ffca38201b458b13a2a8ed22c5748eda8cde1

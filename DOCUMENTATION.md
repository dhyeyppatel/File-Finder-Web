# 📖 File Finder Web — Complete Documentation

**Version**: 2.0.0 (Multi-Tenant Edition)  
**Author**: Dhyey Patel  
**Repository**: [dhyeyppatel/File-Finder-Web](https://github.com/dhyeyppatel/File-Finder-Web)

---

## 📑 Table of Contents
1.  [Project Overview](#-project-overview)
2.  [New Features (Multi-Tenancy)](#-new-features-multi-tenancy)
3.  [System Architecture](#-system-architecture)
4.  [Tech Stack](#-tech-stack)
5.  [Project Structure](#-project-structure)
6.  [Installation & Setup](#-installation--setup)
7.  [User Configuration Guide](#-user-configuration-guide)
8.  [API Reference](#-api-reference)

---

## 🔭 Project Overview

**File Finder Web** is a multi-tenant specialized search engine interface designed to bridge the gap between large-scale Telegram file storage and user accessibility. It allows developers and users to **create an account**, **bring their own database**, and **instantly deploy** a personalized search engine for their files.

The system relies on a **MongoDB** index of the files, allowing for sub-millisecond search queries compared to slow native Telegram search.

---

## � New Features (Multi-Tenancy)

### 1. User Accounts & Dashboard
*   **Register/Login**: Users can sign up for a personal account.
*   **Dashboard**: A dedicated glassmorphism-styled dashboard to manage settings. |
*   **Persistent Config**: Settings are saved in the system database.

### 2. Bring Your Own Database (BYOD)
*   **Custom MongoDB**: Connect to *your* own MongoDB cluster.
*   **Custom Bot**: Configure *your* own Telegram bot username for file delivery.
*   **Flexible Access**: Specify custom Database names and Collection names, ensuring compatibility with any schema.

### 3. Personalized Public Pages
*   **Dynamic Routing**: Your search engine lives at `/<username>`.
*   **Isolation**: Searches on your page only query *your* database.
*   **Context Aware**: "Send" buttons automatically link to *your* configured bot.

### 4. Glassmorphism UI v2
*   **Modern Aesthetic**: Deep blurred backgrounds, mesh gradients, and translucent cards.
*   **Smooth Transitions**: Polished animations for tabs, inputs, and buttons.
*   **Mobile Responsive**: Fully optimized for mobile devices.

---

## 🏗 System Architecture

The application now follows a **Multi-Tenant SaaS** architecture.

```
graph TD
    Client[Web Browser] <-->|HTTP/REST| Server[Flask API]
    Server <-->|Auth & Config| SystemDB[(System DB: commonthread)]
    Server -.->|Dynamic Connection| UserDB[(User's MongoDB)]
    Client -->|Deep Link| UserBot[User's Telegram Bot]
```

*   **System DB**: Stores user accounts (`filefinder` collection).
*   **User DB**: Stores the actual file index (User provides URI).
*   **Dynamic API**: Endpoints like `/api/search` are now scoped to `/<username>/api/search`.

---

## 💻 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JS | Semantic markup + Glassmorphism CSS + Vanilla JS. |
| **Backend** | Python 3.x (Flask) | Serves both the Dashboard and Dynamic User Pages. |
| **Database** | MongoDB | Dual-layer: System DB (Auth) + User DBs (Data). |
| **Security** | Werkzeug | Password hashing and session management. |

---

## 📂 Project Structure

```text
File-Finder-Web/
├── .gitignore          # Git exclusion rules
├── app.py              # Main Flask Application (Auth + Dynamic Routes)
├── README.md           # Quick Start Guide
├── DOCUMENTATION.md    # User & Developer Manual
├── requirements.txt    # Python Dependencies
├── static/             # Frontend Assets
│   ├── style.css       # Global Styles & Themes
│   └── app.js          # Core Logic (Search, UI, API)
└── templates/          # Jinja2 Templates
    ├── dashboard.html  # Login & Config Dashboard
    └── user_search.html# Public Search Page (Dynamic)
```

---

## 🛠 Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/dhyeyppatel/File-Finder-Web.git
    cd File-Finder-Web
    ```

2.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Environment Configuration**
    Create a `.env` file:
    ```ini
    MONGO_URI=mongodb+srv://<system_db_nurl>...   # Connection for storing USERS
    DB_NAME=commonthread                          # System DB Name
    COLLECTION_NAME=filefinder                    # System Collection Name
    SECRET_KEY=super_secret_key                   # For session security
    PORT=8080
    ```

4.  **Run the Application**
    ```bash
    python app.py
    ```

---

## ⚙ User Configuration Guide

Once the app is running:

1.  **Go to Dashboard**: Visit `http://localhost:8080/dashboard`.
2.  **Register**: Create a new account.
3.  **Configure Connection**:
    *   **MongoDB URI**: Your cluster connection string.
    *   **Bot Username**: The username of your Telegram bot (without @).
    *   **Database Name**: The DB containing your files (e.g., `TelegramFiles`).
    *   **Collection Name**: The collection name (e.g., `files_index`).
4.  **Save**: Click "Save Configuration".
5.  **Launch**: Click "View My Page" to see your personal search engine at `/<username>`.

---

## 🔌 API Reference

### Dynamic User Endpoints
All search APIs are now prefixed with the username.

#### `GET /<username>/api/search`
Search within a specific user's database.

**Parameters:**
*   `q` (string): Search query.
*   `page` (int): Page number.
*   `per_page` (int): Limit results.

#### `GET /<username>/api/stats`
Get total file count for the user.

**Response:**
```json
{ "total_files": 15000 }
```

### Auth Endpoints

*   `POST /api/auth/register`: Create account.
*   `POST /api/auth/login`: Authenticate.
*   `POST /api/auth/me`: Get current user config.
*   `POST /api/config`: Update MongoDB/Bot settings.

---

*Documentation generated for File Finder Web v2.*

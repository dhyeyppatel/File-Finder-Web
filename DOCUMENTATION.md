# 📖 File Finder Web — Complete Documentation

**Version**: 1.0.0  
**Author**: Dhyey Patel  
**Repository**: [dhyeyppatel/File-Finder-Web](https://github.com/dhyeyppatel/File-Finder-Web)

---

## 📑 Table of Contents
1.  [Project Overview](#-project-overview)
2.  [System Architecture](#-system-architecture)
3.  [Features Deep Dive](#-features-deep-dive)
4.  [Tech Stack](#-tech-stack)
5.  [Project Structure](#-project-structure)
6.  [Installation & Setup](#-installation--setup)
7.  [Configuration](#-configuration)
8.  [API Reference](#-api-reference)
9.  [Workflow](#-workflow)

---

## 🔭 Project Overview

**File Finder Web** is a specialized search engine interface designed to bridge the gap between large-scale Telegram file storage and user accessibility. It allows users to search, filter, and retrieve files stored in private Telegram channels via a high-performance web interface.

The system relies on a **MongoDB** index of the files, allowing for sub-millisecond search queries compared to slow native Telegram search.

---

## 🏗 System Architecture

The application follows a **Client-Server** architecture with a document-oriented database.

```
graph TD
    Client[Web Browser (Frontend)] <-->|HTTP/REST| Server[Flask API (Backend)]
    Server <-->|Query/Aggregation| DB[(MongoDB Atlas)]
    Client -->|Deep Link| Telegram[Telegram Bot]
```

*   **Frontend**: Single Page Application (SPA) serving static HTML/CSS/JS.
*   **Backend**: Flask (Python) serving RESTful API endpoints.
*   **Database**: MongoDB storing file metadata (ID, attributes, file_name, file_size).

---

## 🚀 Features Deep Dive

### 1. Glassmorphism UI
*   The interface filters content through a "frosted glass" aesthetic using `backdrop-filter: blur()`.
*   Semi-transparent cards floating over dynamic mesh gradients.

### 2. Search Engine
*   **Instant Search**: Uses Javascript `debounce` to trigger API calls 300ms after user stops typing.
*   **Substring Matching**: Custom client-side logic prioritizes items where the query is a direct substring of the filename.
*   **Fuzzy Search**: Levenshtein Distance algorithm handles typos (e.g., "spidr man" finds "Spider Man").

### 3. Dynamic Theming
*   Uses CSS Variables (`var(--primary)`, `var(--bg-card)`) controlled by JS.
*   Themes: **Violet, Emerald, Amber, Rose, Sky**.
*   Preferences persisted in `localStorage`.

### 4. Smart Navigation
*   **Year-wise Grouping**: Results are automatically sorted by year and visually divided.
*   **Keyboard Shortcuts**: Pressing `/` focuses the search bar instantly.

---

## 💻 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3 | Semantic markup + Vanilla CSS (Variables, Flexbox/Grid). |
| **Scripting** | JavaScript (ES6+) | Vanilla JS. No frameworks (React/Vue) for maximum performance. |
| **Backend** | Python 3.x | Flask microframework. |
| **Database** | MongoDB | NoSQL database for flexible metadata storage. |
| **Driver** | PyMongo | Official Python driver for MongoDB. |

---

## 📂 Project Structure

```text
File-Finder-Web/
├── .gitignore          # Git exclusion rules
├── app.py              # Main Flask Application Entry Point
├── README.md           # Quick Start Guide
├── DOCUMENTATION.md    # User & Developer Manual (This File)
├── requirements.txt    # Python Dependencies
├── static/             # Frontend Assets
│   ├── index.html      # Main HTML Document
│   ├── style.css       # Global Styles & Themes
│   └── app.js          # Core Logic (Search, UI, API)
└── .env                # Environment Variables (Not in repo)
```

---

## 🛠 Installation & Setup

### Prerequisites
*   Python 3.8+
*   MongoDB Connection String (Atlas or Local)
*   Git

### Step-by-Step Guide

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/dhyeyppatel/File-Finder-Web.git
    cd File-Finder-Web
    ```

2.  **Create Virtual Environment (Optional but Recommended)**
    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Mac/Linux
    source venv/bin/activate
    ```

3.  **Install Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configuration**
    Create a `.env` file in the root directory:
    ```ini
    MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
    DB_NAME=telegram_files_db
    COLLECTION_NAME=files_index
    SEARCH_FIELD_NAME=file_name
    PORT=8080
    ```

5.  **Run the Application**
    ```bash
    python app.py
    ```
    You should see: `Running on http://0.0.0.0:8080`

---

## ⚙ Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `MONGO_URI` | **Required**. Connection string for MongoDB. | - |
| `DB_NAME` | Name of the database containing file data. | - |
| `COLLECTION_NAME` | Name of the collection. | - |
| `SEARCH_FIELD_NAME` | The document field to search against (e.g. `file_name` or `caption`). | `file_name` |
| `PORT` | The port the web server listens on. | `8080` |

---

## 🔌 API Reference

### 1. Base URL
All API requests are made to the origin server.
Example: `https://find.dhyey.space/api`

### 2. Endpoints

#### `GET /api/search`
Search for files with pagination and filters.

**Parameters:**
*   `q` (string): Search query.
*   `year` (int): Filter by year.
*   `type` (string): Filter by extension (e.g., `mkv`).
*   `page` (int): Page number (default `1`).
*   `per_page` (int): Items per page (default `20`).

**Response:**
```json
{
  "page": 1,
  "items": [
    {
        "id": "67a...",
        "file_name": "Movie.2024.mkv",
        "year": 2024,
        "file_type": "mkv"
    }
  ]
}
```

#### `GET /api/stats`
Returns the estimated total number of files indexed.

**Response:**
```json
{ "total_files": 520400 }
```

#### `GET /api/send_link/<file_id>`
Generates a deep link to the Telegram bot.

**Response:**
```json
{ "link": "https://t.me/bot?start=file_..." }
```

---

## 🔄 Workflow

1.  **User Visits Site**: `index.html` loads, fetching initial "Latest Files" via `/api/latest` (mapped to search with no query).
2.  **User Types**: `app.js` captures input, debounces it, and requests `/api/search?q=...`.
3.  **Display**: JSON results are parsed. `makeCard()` creates DOM elements.
    *   If year changes, a **Year Divider** is injected.
4.  **Sorting**: Backend prioritizes:
    *   Year (Descending)
    *   Match Relevance
5.  **Action**: User clicks "Send". `app.js` opens the Telegram Deep Link, triggering the bot to send the file.

---

*Documentation generated for File Finder Web.*


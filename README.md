# IntervAI 🚀

IntervAI is an AI-powered interview preparation tool designed to help users practice and improve their interview skills. It provides a dynamic platform where users can receive tailored interview questions based on a specified domain and get instant, detailed feedback on their responses. This project leverages modern web technologies and AI capabilities to create an interactive and effective learning experience.

## Features

-   **AI-powered Question Generation**: Dynamically generates relevant and challenging interview questions based on the user's chosen domain (e.g., AI, Software Engineering, Data Science).
-   **Real-time Feedback**: Provides immediate and comprehensive feedback on user answers, including suggestions for improvement and a scoring mechanism.
-   **Speech-to-Text Integration**: Allows users to speak their answers, which are then transcribed for evaluation.
-   **Interview Summary**: Offers a detailed summary of the interview session, including all questions asked, user answers, and AI feedback, enabling users to track their progress.
-   **User-friendly Interface**: A clean and intuitive interface built with React and Tailwind CSS for a seamless user experience.

## Technologies Used

### Frontend
-   **React**: A JavaScript library for building user interfaces.
-   **Vite**: A fast build tool for modern web projects.
-   **Tailwind CSS**: A utility-first CSS framework for rapidly styling applications.
-   **Axios**: A promise-based HTTP client for making API requests.
-   **React Router DOM**: For declarative routing in React applications.

### Backend
-   **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python 3.7+ based on standard Python type hints.
-   **Uvicorn**: An ASGI server for FastAPI.
-   **Requests**: A simple, yet elegant, HTTP library for Python.
-   **OpenAI API**: Used for generating interview questions and evaluating answers.

### Infrastructure
-   **Docker**: For containerization of both frontend and backend services.
-   **Docker Compose**: For defining and running multi-container Docker applications.

## Folder Structure

```
IntervAI/
├── backend/                  # FastAPI backend application
│   ├── app/                  # Core backend logic
│   │   ├── __init__.py
│   │   ├── main.py           # Main FastAPI application entry point
│   │   ├── routes.py         # API routes for question generation and answer evaluation
│   │   └── config.py         # Configuration settings
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Dockerfile for the backend service
├── frontend/                 # React frontend application
│   ├── public/               # Static assets
│   ├── src/                  # Frontend source code
│   │   ├── App.jsx           # Main application component
│   │   ├── index.jsx         # Entry point for the React app
│   │   ├── pages/            # React components for different pages (Setup, Interview, Summary)
│   │   ├── components/       # Reusable React components (Navbar, MicButton, MessageBubble)
│   │   └── index.css         # Global CSS styles
│   ├── package.json          # Frontend dependencies and scripts
│   └── tailwind.config.js    # Tailwind CSS configuration
├── docker-compose.yml        # Docker Compose file for setting up the development environment
├── .env                      # Environment variables (e.g., OpenAI API Key)
└── README.md                 # Project README file
```

## Setup Instructions

To get a local copy up and running, follow these simple steps.

### Prerequisites

Before you begin, ensure you have the following installed:
-   Git
-   Node.js (LTS version recommended) and npm
-   Python 3.8+ and pip
-   Docker and Docker Compose (if you plan to use Docker)

### 1. Clone the repository

```bash
git clone https://github.com/Rajbharti06/IntervAI.git
cd IntervAI
```

### 2. Environment Variables

Create a `.env` file in the root directory of the project (`IntervAI/.env`) and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Backend Setup

Navigate to the `backend` directory, create a virtual environment, activate it, and install the Python dependencies:

```bash
cd backend
python -m venv venv
# On Windows
.\venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Frontend Setup

Navigate to the `frontend` directory and install the Node.js dependencies:

```bash
cd frontend
npm install
```

## Running the Application

You can run the application using Docker Compose for a fully containerized environment or by running the frontend and backend services separately.

### Using Docker Compose (Recommended)

From the root directory of the project (`IntervAI/`), run:

```bash
docker-compose up --build
```

This command will:
-   Build Docker images for both the frontend and backend services.
-   Start the backend service, accessible at `http://localhost:8000`.
-   Start the frontend service, accessible at `http://localhost:5173`.

### Running Frontend and Backend Separately

#### Backend

Navigate to the `backend` directory, activate your virtual environment, and start the FastAPI application:

```bash
cd backend
# Activate virtual environment (if not already active)
# On Windows: .\venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
The backend API will be available at `http://localhost:8000`.

#### Frontend

Navigate to the `frontend` directory and start the React development server:

```bash
cd frontend
npm run dev
```
The frontend application will be accessible at `http://localhost:5173`.

## API Endpoints

The backend provides the following API endpoints:

-   **`/generate-question` (POST)**:
    -   **Description**: Generates an interview question based on a specified domain using the OpenAI API.
    -   **Request Body**:
        ```json
        {
            "api_key": "YOUR_OPENAI_API_KEY",
            "domain": "Software Engineering"
        }
        ```
    -   **Response**:
        ```json
        {
            "question": "What is the difference between a process and a thread?"
        }
        ```

-   **`/evaluate-answer` (POST)**:
    -   **Description**: Evaluates a user's answer to an interview question and provides detailed feedback.
    -   **Request Body**:
        ```json
        {
            "api_key": "YOUR_OPENAI_API_KEY",
            "question": "What is the difference between a process and a thread?",
            "answer": "A process is an instance of a computer program that is being executed, while a thread is a segment of a process."
        }
        ```
    -   **Response**:
        ```json
        {
            "feedback": "Your answer is correct but could be more detailed. A process has its own memory space, while threads within the same process share memory. Score: 8/10"
        }
        ```

## Contributing

Contributions are welcome! Please feel free to fork the repository, create a new branch, and submit a pull request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more details.

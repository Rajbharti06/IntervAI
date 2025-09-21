# IntervAI 🚀

IntervAI is an AI-powered interview preparation tool that helps users practice their interview skills. It provides a platform where users can get interview questions based on a specified domain and receive instant feedback on their answers.

## Features

- **AI-powered Question Generation**: Get relevant interview questions based on your chosen domain.
- **Real-time Feedback**: Receive immediate and detailed feedback on your answers.
- **Interview Summary**: Review your interview performance with a comprehensive summary.

## Folder Structure

```
IntervAI/
├── backend/ - Contains the FastAPI backend application.
├── frontend/ - Contains the React frontend application.
├── docker-compose.yml - Docker Compose file for setting up the development environment.
├── .env - Environment variables for the project.
└── README.md - Project README file.
```

## Setup Instructions

To set up the project locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Rajbharti06/IntervAI.git
    cd IntervAI
    ```

2.  **Backend Setup:**

    Navigate to the `backend` directory and install the dependencies:

    ```bash
    cd backend
    pip install -r requirements.txt
    ```

3.  **Frontend Setup:**

    Navigate to the `frontend` directory and install the dependencies:

    ```bash
    cd frontend
    npm install
    ```

4.  **Environment Variables:**

    Create a `.env` file in the root directory of the project and add your OpenAI API key:

    ```
    OPENAI_API_KEY=your_openai_api_key_here
    ```

## Running the Application

To run the application, you can use Docker Compose or run the frontend and backend separately.

### Using Docker Compose (Recommended)

From the root directory of the project, run:

```bash
docker-compose up --build
```

This will build and start both the frontend and backend services. The frontend will be accessible at `http://localhost:5173` and the backend at `http://localhost:8000`.

### Running Frontend and Backend Separately

**Backend:**

Navigate to the `backend` directory and run:

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**

Navigate to the `frontend` directory and run:

```bash
npm run dev
```

The frontend will be accessible at `http://localhost:5173`.

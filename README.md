# IntervAI 🚀

This is the IntervAI starter template blueprint designed for production.

## Folder Structure (Final Online-Only)

```
IntervAI/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes.py
│   │   └── config.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   ├── pages/
│   │   │   ├── Setup.jsx
│   │   │   ├── Interview.jsx
│   │   │   └── Summary.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── MicButton.jsx
│   │   │   └── MessageBubble.jsx
│   │   └── index.css
│   ├── package.json
│   └── tailwind.config.js
├── docker-compose.yml
├── .env
└── README.md
```

## Fully Online Backend Example

### `app/routes.py`

```python
from fastapi import FastAPI, Form
import requests
import os

app = FastAPI()

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

@app.post("/generate-question")
def generate_question(api_key: str = Form(...), domain: str = Form(...)):
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": f"Ask me one advanced interview question about {domain}."}]
    }
    res = requests.post(OPENAI_API_URL, headers=headers, json=payload)
    question = res.json()['choices'][0]['message']['content']
    return {"question": question}


@app.post("/evaluate-answer")
def evaluate_answer(api_key: str = Form(...), question: str = Form(...), answer: str = Form(...)):
    headers = {"Authorization": f"Bearer {api_key}"}
    prompt = f"Evaluate this interview answer:\nQuestion: {question}\nAnswer: {answer}\nGive detailed feedback + score."
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": prompt}]
    }
    res = requests.post(OPENAI_API_URL, headers=headers, json=payload)
    feedback = res.json()['choices'][0]['message']['content']
    return {"feedback": feedback}
```

## Frontend Core Example

### `pages/Setup.jsx`

```javascript
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Setup() {
  const [apiKey, setApiKey] = useState("");
  const [domain, setDomain] = useState("");
  const navigate = useNavigate();

  const startInterview = () => {
    navigate("/interview", { state: { apiKey, domain } });
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Enter API Key & Subject</h2>
      <input
        type="text"
        placeholder="OpenAI API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="p-2 border rounded w-full"
      />
      <input
        type="text"
        placeholder="Subject (AI, Software Eng, etc.)"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="p-2 border rounded w-full"
      />
      <button onClick={startInterview} className="bg-black text-white p-2 rounded">
        Start Interview
      </button>
    </div>
  );
}
```

### `pages/Interview.jsx`

```javascript
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import MicButton from "../components/MicButton";

export default function Interview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { apiKey, domain } = location.state;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const generateQuestion = () => {
    axios.post("http://localhost:8000/generate-question", {
      api_key: apiKey,
      domain
    }).then(res => {
      setMessages((prev) => [...prev, { role: "assistant", text: res.data.question }]);
    });
  };

  const sendAnswer = () => {
    const lastQuestion = messages[messages.length - 1]?.text || "";

    axios.post("http://localhost:8000/evaluate-answer", {
      api_key: apiKey,
      question: lastQuestion,
      answer: input
    }).then(res => {
      setMessages((prev) => [...prev, { role: "user", text: input }, { role: "assistant", text: res.data.feedback }]);
      setInput("");
    });
  };

  const handleMicTranscription = (transcribedText) => {
    setInput(transcribedText);
  };

  const endInterview = () => {
    navigate("/summary", { state: { domain, messages } });
  };

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">
      <button onClick={generateQuestion} className="bg-indigo-600 text-white p-2 rounded">Generate Question</button>

      {messages.map((m, idx) => (
        <div key={idx} className={`${m.role === "user" ? "text-right" : "text-left"}`}>
          <span className={`inline-block p-2 rounded ${m.role === "user" ? "bg-yellow-200" : "bg-indigo-200"}`}>
            {m.text}
          </span>
        </div>
      ))}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Your answer..."
        className="p-2 border rounded w-full"
      />

      <MicButton onTranscribe={handleMicTranscription} />

      <div className="flex space-x-3">
        <button onClick={sendAnswer} className="bg-black text-white p-2 rounded">Send</button>
        <button onClick={endInterview} className="bg-red-600 text-white p-2 rounded">End Interview</button>
      </div>
    </div>
  );
}
```

## Summary Page Example

```javascript
import { useLocation } from "react-router-dom";

export default function Summary() {
  const location = useLocation();
  const { domain, messages } = location.state;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold">Interview Summary</h2>
      <p><strong>Subject:</strong> {domain}</p>
      <ul className="list-disc ml-6">
        {messages.map((m, idx) => (
          <li key={idx}><strong>{m.role}:</strong> {m.text}</li>
        ))}
      </ul>
    </div>
  );
}
```

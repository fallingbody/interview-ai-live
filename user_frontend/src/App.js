import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";


import UserForm from "./components/UserForm.jsx";
import LiveInterviewRoom from "./components/LiveInterviewRoom.jsx";

import StartInterview from "./components/StartInterview.jsx";
import InterviewCheck from "./components/InterviewCheck.jsx";
import "./App.css"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/interviewcheck/:sessionId" element={<InterviewCheck />} />
        <Route path="/userform/:id" element={<UserForm />} />
        <Route path="/interviewroom" element={<LiveInterviewRoom />} />
        <Route path="/startinterview" element={<StartInterview />} />
        </Routes>
    </Router>
  );
}

export default App;
